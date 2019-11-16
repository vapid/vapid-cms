const Sequelize = require('sequelize');

const directives = require('../../directives');
const { Utils } = require('../../utils');

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
    }, {
      sequelize,

      underscored: true,
      tableName: 'records',
      timestamps: true,

      getterMethods: {
        name() {
          const { template } = this;
          const templateName = template.name === 'index' ? 'Home' : template.name;
          if (template.type === 'page') {
            return Utils.startCase(this.get('metadata').name || templateName);
          }
          return Utils.startCase(this.get('metadata').name || this.get('slug') || templateName);
        },
      },

      hooks: {
        /**
         * Include template, if not already specified
         * Needed by permalink getter
         *
         * @params {Object} options
         *
         * @todo Maybe there's a way to do this via config?
         */
        beforeFind(options) {
          /* eslint-disable-next-line no-param-reassign */
          options.include = options.include || [{ all: true }];
        },

        /**
         * Seralize/convert field values before saving to the DB
         *
         * @params {Record}
         */
        async beforeSave(record) {
          const template = record.template || await record.getTemplate();
          for (const [field, value] of Object.entries(record.content)) {
            const params = template.fields[field];
            const directive = directives.find(params);

            /* eslint-disable-next-line no-param-reassign */
            record.content[field] = directive.serialize(value);
          }
        },
      },
    });
  }

  async safeSlug() {
    const template = await this.getTemplate({ include: ['records'] });
    let slug = this.getDataValue('slug') || null;
    let fallback = null;

    if (template.type === 'collection') {
      const name = Utils.kebabCase(this.dataValues.title || this.dataValues.name);
      fallback = `${template.name}/${name ? `${name}-${this.id}` : this.id}`;
    } else if (template.type === 'page') {
      const minId = (await this.sequelize.query(`SELECT MIN(id) as id from records WHERE template_id = ${template.id}`))[0][0].id;
      fallback = this.id === minId ? template.name : `${template.name}-${this.id}`;
    } else {
      slug = null;
    }

    return typeof slug === 'string' ? slug : fallback;
  }

  /**
   * URI path to the individual record
   *
   * @return {string}
   */
  async permalink() {
    let slug = await this.safeSlug();
    if (!slug) { return slug; }
    slug = (slug === 'index') ? '' : slug;
    return `/${slug}`;
  }

  previewContent(fieldName, template) {
    const directive = directives.find(template.fields[fieldName]);
    const rendered = directive.preview(this.content[fieldName]);
    return rendered.length > 140 ? `${rendered.slice(0, 140)}...` : rendered;
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
}

Record.SPECIAL_FIELDS = SPECIAL_FIELDS;

module.exports = Record;
