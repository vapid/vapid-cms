const fs = require('fs');
const ejs = require('ejs');
const { resolve } = require('path');
const Boom = require('@hapi/boom');
const { Op } = require('sequelize');

const Form = require('../form');
const Utils = require('../utils');

// TODO: Figure out why subQuery in contentFor *needs* a limit
const DEFAULTS = {
  name: 'general',
  limit: 1000,
  offset: 0,
  priority: 2147483647,
};

const FORM_ALLOWED_TYPES = [
  'choice',
  'date',
  'text',
  'link',
  'number',
];

module.exports = (sequelize, DataTypes) => {
  /*
   * Allows Vapid to organize content into groups
   * Retains info about the data model.
   */
  const Section = sequelize.define('Section', {
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

    form: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    multiple: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
       * Table column
       * Primarily used by dashboard index page
       *
       * @return {array} first three fields
       */
      tableColumns: function tableColumns() {
        return Utils.keys(this.fields).slice(0, 3);
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
       * Quick way to check if Section has any fields
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
        return Utils.chain(this.fields)
          .reduce((result, value, key) => [...result, {
            ...value,
            _name: key,
          }], [])
          .sortBy(f => parseInt(f.priority, 10))
          .value();
      },
    },

    /**
     * Scopes
     */
    scopes: {
      /**
       * @return {Section[]} Sections that are mean to render content
       */
      content: {
        where: { form: false },
      },

      /**
       * @return {Section[]} Sections that are used for forms
       */
      forms: {
        where: { form: true },
      },
    },

    /**
     * Options
     */
    underscored: true,
    tableName: 'sections',
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
  Section.findGeneral = async function findGeneral() {
    const [section] = await this.findOrCreate({ where: { name: DEFAULTS.name } });
    return section;
  };

  /**
   * @static
   *
   * Find a section by name
   *
   * @return {Section}
   */
  Section.findByName = async function findByName(name, options = {}) {
    const query = Object.assign(options, { where: { name } });
    return this.findOne(query);
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
  Section.rebuild = async function rebuild(name, params) {
    const [section] = await this.findOrCreate({ where: { name } });
    const fields = this.sequelize.models.Record.removeSpecialFields(params.fields);
    const multiple = params.options.multiple || Utils.isPlural(name);
    const { sortable } = params.options;

    return section.update({
      form: params.form,
      options: { priority: DEFAULTS.priority, ...params.options },
      multiple,
      sortable,
      fields,
    });
  };

  /**
   * @static
   *
   * Turns template section args into renderable content.
   * Primarily used by the Vapid module class.
   *
   * @params {Object} args
   * @params {number} [recordId] - optional if only need a specific record
   * @return {Object} renderable content
   *
   * @todo Break this up into subroutines.
   * @todo This should probably be in a different class.
   */
  Section.contentFor = async function contentFor(args, recordId) {
    const [limit, where, order] = (() => {
      if (recordId) {
        return [1, { id: recordId }, null];
      }

      return [Utils.toNumber(args.params.limit) || DEFAULTS.limit, {}, _orderBy(args.params.order)];
    })();
    const offset = Utils.toNumber(args.params.offset) || DEFAULTS.offset;

    const section = await this.findByName(args.name, {
      include: [{
        association: 'records',
        where,
        limit,
        offset,
        order,
      }],
    });

    if (args.keyword === 'form') {
      const options = args.params;
      const formTemplate = fs.readFileSync(resolve(__dirname, '../../views/records/_form_email.ejs'), 'utf8');
      const fields = Utils.reduce(args.fields, (memo, value) => {
        // Only allow certain directives
        if (value.params.type && !Utils.includes(FORM_ALLOWED_TYPES, value.params.type)) {
          /* eslint-disable-next-line no-param-reassign */
          delete value.params.type;
        }

        /* eslint-disable-next-line no-param-reassign */
        memo[value.name] = value.params;
        return memo;
      }, {});
      let { recipient } = options;

      if (!recipient) {
        const user = await this.sequelize.models.User.findOne();
        recipient = user ? user.email : '';
      }

      // TODO: This should iterate over args.fields, not section.fields,
      //       so livereload works
      return ejs.render(formTemplate, {
        section: this,
        action: options.action || `https://formspree.io/${recipient}`,
        subject: options.subject,
        next: options.next,
        submit: options.submit,
        fields,
        Form,
      });
    }

    const records = (section && section.records) || [];

    if (recordId && records.length === 0) {
      throw Boom.notFound(`Record #${recordId} not found`);
    }

    return Promise.all(records.map(async record => record.contentFor(args.fields)));
  };

  /**
   * @static
   *
   * Destroy all sections except for the ones passed in.
   * Never delete the "general" section.
   *
   * @param {array} [existing=[]] - array of section names to preserve
   */
  Section.destroyExceptExisting = function destroyExceptExisting(existing = []) {
    this.destroy({
      where: {
        id: { [Op.notIn]: existing },
        name: { [Op.ne]: DEFAULTS.name },
      },
    });
  };

  /*
   * PRIVATE METHODS
   */

  /**
   * @private
   *
   * Turn a template orderBy string into something that Sequelize understands
   *
   * @param {string} [str='']
   * @return {array}
   *
   * @example
   * _orderBy('-name,state,city');
   */
  function _orderBy(str = '') {
    const order = str ? [] : sequelize.models.Record.DEFAULT_ORDER;

    str.split(/,/).filter(s => s).forEach((s) => {
      const [, negate, fieldName] = s.match(/(-?)(.*)/);
      const direction = negate ? 'DESC' : 'ASC';
      order.push([sequelize.json(`content.${fieldName}`), direction]);
    });

    return order;
  }

  /*
   * CLASS CONSTANTS
   */

  Section.DEFAULT_NAME = DEFAULTS.name;
  Section.FORM_ALLOWED_TYPES = FORM_ALLOWED_TYPES;

  return Section;
};
