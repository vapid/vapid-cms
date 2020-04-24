const Sequelize = require('sequelize');

const directives = require('../../directives');
const { Utils } = require('../../utils');

const { Op } = Sequelize;

const SPECIAL_FIELDS = {
  _id: null,
  _created_at: { type: 'date', time: true },
  _updated_at: { type: 'date', time: true },
  _permalink: null,
};

/**
 * Primary object for storing content
 */
class Record extends Sequelize.Model {
  static init(sequelize, DataTypes) {
    return super.init({
      /* Attributes */
      content: {
        type: DataTypes.JSON,
        defaultValue: {},
        validate: {
          /**
            * Ensures that required fields have content values
            *
            * @param {Object} content
            * @return {Object} error messages
            */
          async fields(content) {
            const template = this.template || await this.getTemplate();

            const errors = Object.entries(template.fields).reduce((memo, [name, params]) => {
              const directive = directives.find(params);

              // Ensure empty values are pre-populated with default values.
              if (params.default && (content[name] === undefined || content[name] === null || content[name] === '')) {
                content[name] = params.default;
              }

              if (directive.attrs.required && !content[name]) {
                /* eslint-disable-next-line no-param-reassign */
                memo[name] = 'required field';
              }

              return memo;
            }, {});

            if (!Utils.isEmpty(errors)) {
              throw new Error(JSON.stringify(errors));
            }
          },
        },
      },

      metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
      },

      position: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },

      template_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      slug: {
        type: DataTypes.TEXT,
        defaultValue: null,
      },

      isFirst: {
        type: DataTypes.VIRTUAL,
      },

    }, {
      sequelize,

      underscored: true,
      tableName: 'records',
      timestamps: true,

      indexes: [
        {
          unique: true,
          fields: ['slug'],
        },
      ],

      getterMethods: {

        defaultName() {
          const { template } = this;
          const defaultName = template.name === 'index' ? 'Home' : template.name;
          return this.isFirst ? defaultName : `${defaultName} ${this.id}`;
        },

        name() {
          const { template } = this;
          if (template.type === 'page') {
            return Utils.startCase(this.get('metadata').name || this.defaultName);
          }
          return Utils.startCase(this.get('metadata').name || this.get('slug') || this.defaultName);
        },

        defaultSlug() {
          const { template } = this;
          const name = Utils.kebabCase(this.dataValues.content.title || this.dataValues.content.name);
          if (this.isFirst && template.name === 'index') { return ''; }
          // if (this.isFirst && name) { return name; }
          return `${name || template.name}-${this.id}`;
        },

        safeSlug() {
          const { template } = this;
          const customSlug = this.getDataValue('slug');
          if (this.isFirst && template.name === 'index') { return 'index'; }
          return customSlug || this.defaultSlug;
        },

        /**
         * URI path to the individual record
         *
         * @return {string}
         */
        permalink() {
          const { template } = this;
          let { safeSlug: slug } = this;
          slug = (slug === 'index' || slug === '') ? '' : slug;
          return template.type === 'collection' ? `/${template.name}/${slug}` : `/${slug}`;
        },

        /**
         * Singularized name
         *
         * @return {string}
         */
        nameSingular() {
          return Utils.singularize(this.name);
        },
      },

      hooks: {

        /**
         * Include template, if not already specified
         * Needed by permalink getter
         *
         * @params {Object} options
         */
        beforeFind(options) {
          /* eslint-disable-next-line no-param-reassign */
          options.include = options.include || [{ all: true }];
          options.attributes = options.attributes || {};
          options.attributes.include = [[sequelize.literal('(SELECT MIN(id) == record.id FROM records WHERE template_id = template.id)'), 'isFirst']];
        },

        /**
         * Seralize/convert field values before saving to the DB
         *
         * @params {Record}
         */
        async beforeSave(record) {
          const template = record.template || await record.getTemplate();
          for (const field of Object.keys(template.fields)) {
            const params = template.fields[field];
            const directive = directives.find(params);
            const content = record.content;
            const value = directive.serialize(content[field]);
            const previous = (record.previous('content') || {})[field];
            /* eslint-disable-next-line no-param-reassign */
            content[field] = value;

            // If the value *is* the default value, un-set it.
            if (params.default && content[field] === params.default) {
              content[field] = undefined;
            }

            // If this is a choice field type, and custom values are allowed,
            // ensure the template field type options contain this value.
            if (params.type === 'choice' && params.custom) {
              const options = new Set((params.options || '').split(',').filter(Boolean));
              const siblings = await template.getRecords({
                where: {
                  id: { [Op.ne]: record.id },
                  content: { [field]: previous },
                }
              });
              if (siblings.length === 0) {
                options.add(value);
                options.delete(previous);
              }
              params.options = [...options].sort().join(',');

            }
          }

          // Persist any template modifications.
          await template.update({ fields: template.fields });

          // Save the metadata slug field in to the slug column to ensure uniqueness.
          record.metadata.slug = record.metadata.slug ? record.metadata.slug.replace(/^\/+/, '') : null;
          if (record.metadata.slug && template.type === 'collection') {
            record.metadata.slug = record.metadata.slug.replace(`${template.name}/`, '');
          }

          record.slug = record.metadata.slug;

        },
      },
    });
  }

  previewContent(fieldName, template) {
    const directive = directives.find(template.fields[fieldName]);
    const rendered = directive.preview(this.content[fieldName]);
    return rendered.length > 140 ? `${rendered.slice(0, 140)}...` : rendered;
  }

  getMetadata(currentUrl = '/') {
    return {
      id: this.id,
      name: this.name,
      url: this.template.hasView ? this.permalink : null,
      slug: this.template.hasView ? this.safeSlug : null,
      isNavigation: !!this.metadata.isNavigation,
      isActive: this.permalink === '/' ? (this.permalink === currentUrl || currentUrl === 'index') : currentUrl.indexOf(this.permalink) === 0,
      title: this.metadata.title,
      description: this.metadata.description,
      redirectUrl: this.metadata.redirectUrl,
      hasSubNav: !!(this.collection && this.collection.records.length && this.collection.hasView),
      subNav: ((this.collection || {}).records || []).map(r => r.getMetadata(currentUrl)),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      hasCollection: !!this.collection,
      template: this.template.name,
    };
  }

  /**
   * @static
   *
   * Removes special fields, like `_permalink` or parent template references like `general.field`
   *
   * @params {Object} fields
   * @return {Object} with special fields removed
   */
  static removeSpecialFields(fields = {}) {
    const out = {};
    for (const [key, value] of Object.entries(fields)) {
      if (key[0] === '_' || key.includes('.')) { continue; }
      out[key] = value;
    }
    return out;
  }

  /**
   * @static
   *
   * Allows modules to register callbacks
   *
   * @param {array} hooks - hook names
   * @param {function} fn - the callback
   */
  static addHooks(hooks, fn) {
    for (const hook of hooks) {
      this.addHook(hook, 'registeredHooks', fn);
    }
  }

  /**
   * @static
   *
   * Remove registered callbacks
   *
   * @params {array} hooks - hook names
   */
  static removeHooks(hooks) {
    for (const hook of hooks) {
      this.removeHook(hook, 'registeredHooks');
    }
  }

  static async getPages() {
    return Record.findAll({
      include: {
        model: Record.Template,
        as: 'template',
        where: { type: 'page' },
      },
      order: [
        ['position', 'ASC'],
        [Sequelize.literal(`CASE WHEN template.name = '${Record.Template.DEFAULT_PAGE}' THEN 1 ELSE 0 END`), 'DESC'],
      ],
    });
  }
}

Record.SPECIAL_FIELDS = SPECIAL_FIELDS;

module.exports = Record;
