const { Op } = require('sequelize');
const { Utils } = require('../../utils');

// TODO: Figure out why subQuery in contentFor *needs* a limit
const DEFAULTS = {
  page: 'index',
  setting: 'general',
  limit: 1000,
  offset: 0,
  priority: 2147483647,
};

const FORM_ALLOWED_TYPES = {
  choice: 1,
  date: 1,
  text: 1,
  link: 1,
  number: 1,
};

const DEFAULT_ORDER = [
  ['position', 'ASC'],
  ['created_at', 'DESC'],
];

module.exports = (sequelize, DataTypes) => {
  /*
   * Allows Vapid to organize content into groups
   * Retains info about the data model.
   */
  const Template = sequelize.define('Template', {
    /**
     * Attributes
     */
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    sortable: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    options: {
      type: DataTypes.JSON,
      defaultValue: {},
    },

    fields: {
      type: DataTypes.JSON,
      defaultValue: {},
    },

    type: {
      type: DataTypes.ENUM('setting', 'collection', 'page', 'form'),
      allowNull: false,
      defaultValue: 'setting',
    },
  }, {
    /**
     * Getter methods
     */
    getterMethods: {
      /**
       * Generates a user-friendly label
       * Allows template to override default behavior
       *
       * @return {string}
       */
      label: function label() {
        if (this.type === 'page' && this.name === 'index') { return 'Home'; }
        return this.options.label || Utils.startCase(this.name);
      },

      /**
       * Singularized label
       *
       * @return {string}
       */
      labelSingular: function labelSingular() {
        return Utils.singularize(this.label);
      },

      /**
       * Singularized type
       *
       * @return {string}
       */
      typeSingular: function typeSingular() {
        return Utils.singularize(this.type);
      },

      /**
       * Pluralized type
       *
       * @return {string}
       */
      typePlural: function typePlural() {
        return Utils.pluralize(this.type);
      },

      /**
       * Table column
       * Primarily used by dashboard index page
       *
       * @return {array} first three fields
       */
      tableColumns: function tableColumns() {
        return Object.keys(this.fields).slice(0, 3);
      },

      /**
       * User-friendly headers for table columns
       *
       * @return {array}
       */
      tableColumnsHeaders: function tableColumnsHeaders() {
        return this.tableColumns.map(key => this.fields[key].label || Utils.startCase(key));
      },

      /**
       * Quick way to check if Template has any fields
       *
       * @return {boolean}
       */
      hasFields: function hasFields() {
        return Object.keys(this.fields).length > 0;
      },

      /**
       * Sort fields by priority
       *
       * @return {array}
       */
      sortedFields: function sortedFields() {
        return Object.entries(this.fields)
          .reduce((result, [key, value]) => [...result, {
            ...value,
            _name: key,
          }], [])
          .sort((a, b) => (parseInt(a.priority, 10) < parseInt(b.priority, 10) ? -1 : 1));
      },
    },

    /**
     * Scopes
     */
    scopes: {
      /**
       * @return {Template[]} Templates that are used for settings sections
       */
      settings: {
        where: { type: 'setting' },
      },

      /**
       * @return {Template[]} Templates that are used for forms
       */
      forms: {
        where: { type: 'form' },
      },

      /**
       * @return {Template[]} Templates that are used for collections
       */
      collections: {
        where: { type: 'collection' },
      },

      /**
       * @return {Template[]} Templates that are used for pages
       */
      pages: {
        where: { type: 'page' },
      },
    },

    /**
     * Options
     */
    underscored: true,
    tableName: 'templates',
    timestamps: true,
  });

  /*
   * CLASS METHODS
   */

  /**
   * @static
   *
   * Convenience method for finding the default "general" section
   *
   * @return {Section}
   */
  Template.findIndex = async function findIndex() {
    const [template] = await this.findOrCreate({ where: { name: DEFAULTS.page, type: 'page' } });
    return template;
  };

  /**
   * @static
   *
   * Convenience method for finding the default "general" section
   *
   * @return {Section}
   */
  Template.findGeneral = async function findGeneral() {
    const [template] = await this.findOrCreate({ where: { name: DEFAULTS.setting, type: 'setting' } });
    return template;
  };

  /**
   * @static
   *
   * Update a section's attributes
   * Primarily used by the Vapid module when rebuilding the site
   *
   * @param {string} name - section name
   * @param {Object} params
   * @return {Section}
   */
  Template.rebuild = async function rebuild(type, name, params) {
    const [template] = await this.findOrCreate({ where: { type, name } });
    const fields = this.sequelize.models.Record.removeSpecialFields(params.fields);
    return template.update({
      fields,
      options: { priority: DEFAULTS.priority, ...params.options },
      sortable: params.options.sortable,
    });
  };

  /**
   * @static
   *
   * Destroy all sections except for the ones passed in.
   * Never delete the "general" section or the "index" page.
   *
   * @param {array} [existing=[]] - array of Sections to preserve
   */
  Template.destroyExceptExisting = function destroyExceptExisting(existing = []) {
    this.destroy({
      where: {
        id: { [Op.notIn]: existing.map((s => s.id)) },
        name: { [Op.and]: [{ [Op.ne]: DEFAULTS.setting }, { [Op.ne]: DEFAULTS.page }] },
      },
    });
  };

  /*
   * CLASS CONSTANTS
   */

  Template.DEFAULT_SETTING = DEFAULTS.setting;
  Template.DEFAULT_PAGE = DEFAULTS.page;
  Template.FORM_ALLOWED_TYPES = FORM_ALLOWED_TYPES;
  Template.DEFAULT_ORDER = DEFAULT_ORDER;

  return Template;
};
