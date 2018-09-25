const { resolve } = require('path');
const glob = require('glob');

const Template = require('./template');
const Utils = require('./utils');

let models;
let lastTree;

/**
 * Helps keep the database data structure in sync with the site templates
 */
class Builder {
  /*
   * @param {{models, templatesDir: string}} options - models and template directory
   *
   * @todo Remove {options}, and use regular ol' passed in variables
   */
  constructor(options = { models: undefined, templatesDir: undefined }) {
    ({ models } = options);
    this.dir = options.templatesDir;
  }

  /**
   * Initializes the lastTree
   */
  /* eslint-disable class-methods-use-this */
  async init() {
    await _initLastTree();
  }
  /* eslint-enable class-methods-use-this */

  /**
   * Parses templates and updates the database
   */
  async build() {
    const { tree } = this;
    const existing = [];

    // TODO: Use Promise.all
    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const [name, params] of Object.entries(tree)) {
      const section = await models.Section.rebuild(name, params);
      existing.push(section.id);
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */

    await models.Section.destroyExceptExisting(existing);
    lastTree = tree;
  }

  /**
   * Determines if tree has changed since last build
   *
   * @todo Cache so this isn't as taxing on the load time
   */
  get isDirty() {
    const cleanedTree = _cleanTree(this.tree);
    const cleanedLastTree = _cleanTree(lastTree);
    return !Utils.isEqual(cleanedTree, cleanedLastTree);
  }

  /**
   * Creates the template tree
   *
   * @return {Object}
   */
  get tree() {
    const templates = glob.sync(resolve(this.dir, '**/*.html'));
    return _createTemplateTree(templates);
  }
}

/**
 * @private
 *
 * Crawls templates, and creates object representing the data model
 *
 * @param {array} templates - array of file paths
 * @return {Object} template tree
 *
 * @todo Yuck, this is nasty. Clean it up.
 */
/* eslint-disable no-restricted-syntax */
function _createTemplateTree(templates) {
  const tree = {};

  for (const tpl of templates) {
    const parsed = Template.fromFile(tpl).parse();

    for (const [, sectionAttrs] of Object.entries(parsed)) {
      const sectionName = sectionAttrs.name;

      tree[sectionName] = tree[sectionName] || { form: false, options: {}, fields: {} };
      Object.assign(tree[sectionName].options, sectionAttrs.params);
      tree[sectionName].form = tree[sectionName].form || sectionAttrs.keyword === 'form';

      for (const [, fieldAttrs] of Object.entries(sectionAttrs.fields)) {
        const fieldName = fieldAttrs.name;
        tree[sectionName].fields[fieldName] = Object.assign({ type: 'text' }, tree[sectionName].fields[fieldName] || {}, fieldAttrs.params);
      }
    }
  }

  return tree;
}
/* eslint-enable no-restricted-syntax */

/**
 * @private
 *
 * Removes special fields from the tree
 *
 * @param {Object} tree
 * @return {Object} cleaned tree
 */
/* eslint-disable no-param-reassign */
function _cleanTree(tree) {
  const specialFields = Utils.keys(models.Record.SPECIAL_FIELDS);

  return Utils.reduce(tree, (memo, params, name) => {
    params.fields = Utils.omit(params.fields, specialFields);
    memo[name] = params;
    return memo;
  }, {});
}
/* eslint-enable no-param-reassign */

/**
 * @private
 *
 * Initializes the lastTree from Section entries
 *
 * @return {Object}
 */
async function _initLastTree() {
  const sections = await models.Section.findAll();

  lastTree = Utils.reduce(sections, (memo, section) => {
    /* eslint-disable-next-line no-param-reassign */
    memo[section.name] = {
      form: section.form,
      options: section.options,
      fields: section.fields,
    };

    return memo;
  }, {});
}

module.exports = Builder;
