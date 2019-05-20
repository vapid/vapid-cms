const directives = require('../directives');
const Utils = require('../utils');

const SPECIAL_FIELDS = {
  _id: null,
  _created_at: { type: 'date', time: true },
  _updated_at: { type: 'date', time: true },
  _permalink: null,
};

const DEFAULT_ORDER = [
  ['position', 'ASC'],
  ['created_at', 'DESC'],
];

module.exports = (sequelize, DataTypes) => {
  /**
   * Primary object for storing content
   */
  const Record = sequelize.define('Record', {
    /**
     * Attributes
     */
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
          const section = this.section || await this.getSection();
          const errors = Utils.reduce(section.fields, (memo, params, name) => {
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

    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    section_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    /**
     * Scopes
     */
    defaultScope: {
      order: DEFAULT_ORDER,
    },

    /**
     * Getter methods
     */
    getterMethods: {
      /**
       * URI path to the individual record
       *
       * @return {string}
       */
      permalink() {
        const section = this.get('section');
        const name = Utils.kebabCase(this.content.title || this.content.name);
        const slug = name ? `${name}-${this.id}` : this.id;

        if (section.multiple) {
          return `/${section.name}/${slug}`;
        }

        return null;
      },
    },

    /**
     * Hooks
     */
    hooks: {
      /**
       * Include section, if not already specified
       * Needed by permalink getter
       *
       * @params {Object} options
       *
       * @todo Maybe there's a way to do this via config?
       */
      beforeFind: (options) => {
        /* eslint-disable-next-line no-param-reassign */
        options.include = options.include || [{ all: true }];
      },

      /**
       * Seralize/convert field values before saving to the DB
       *
       * @params {Record}
       */
      beforeSave: async (record) => {
        Utils.each(record.content, (value, field) => {
          const params = record.section.fields[field];
          const directive = directives.find(params);

          /* eslint-disable-next-line no-param-reassign */
          record.content[field] = directive.serialize(value);
        });
      },
    },

    /**
     * Options
     */
    underscored: true,
    tableName: 'records',
    timestamps: true,
  });

  /*
   * CLASS METHODS
   */

  /**
   * @static
   *
   * Removes special fields, like _permalink
   *
   * @params {Object} fields
   * @return {Object} with special fields removed
   */
  Record.removeSpecialFields = function removeSpecialFields(fields) {
    return Utils.pickBy(fields, (params, token) => !Utils.startsWith(token, '_'));
  };

  /**
   * @static
   *
   * Allows modules to register callbacks
   *
   * @param {array} hooks - hook names
   * @param {function} fn - the callback
   */
  Record.addHooks = function addHooks(hooks, fn) {
    Utils.each(hooks, (hook) => {
      this.addHook(hook, 'registeredHooks', fn);
    });
  };

  /**
   * @static
   *
   * Remove registered callbacks
   *
   * @params {array} hooks - hook names
   */
  Record.removeHooks = function removeHooks(hooks) {
    Utils.each(hooks, (hook) => {
      this.removeHook(hook, 'registeredHooks');
    });
  };

  /*
   * INSTANCE METHODS
   */

  /**
   * Turns template field args into renderable content.
   * Primarily used by the Vapid module.
   *
   * @params {Object} args
   * @return {Object} renderable content
   *
   * @todo This should probably be its own class.
   */
  Record.prototype.contentFor = async function contentFor(args) {
    const content = {};

    /* eslint-disable no-restricted-syntax */
    for (const [token, field] of Object.entries(args)) {
      const { name } = field;
      let { params } = field;
      let value;
      let directive;

      if (Utils.has(SPECIAL_FIELDS, name)) {
        value = this.get(name.slice(1));
        params = Utils.assign({}, SPECIAL_FIELDS[name], params);

        if (params.type) {
          directive = directives.find(params);
          content[token] = directive.render(value);
        } else {
          content[token] = value;
        }
      } else {
        value = this.content[name];
        directive = directives.find(params);

        // TODO: Fix the need for eslint-disable
        /* eslint-disable-next-line no-await-in-loop */
        content[token] = await directive.render(value);
      }
    }
    /* eslint-enable no-restricted-syntax */

    return content;
  };

  /**
   * Renders previews of content
   * Primarily used by the dashboard
   *
   * @param {string} fieldName
   * @param {Section} section
   * @return {string} rendered HTML
   *
   * @todo This should probably be in a different class.
   */
  Record.prototype.previewContent = function previewContent(fieldName, section) {
    const directive = directives.find(section.fields[fieldName]);
    const rendered = directive.preview(this.content[fieldName]);

    return Utils.truncate(rendered, { length: 140 });
  };

  /*
   * CLASS CONSTANTS
   */

  Record.SPECIAL_FIELDS = SPECIAL_FIELDS;
  Record.DEFAULT_ORDER = DEFAULT_ORDER;

  return Record;
};
