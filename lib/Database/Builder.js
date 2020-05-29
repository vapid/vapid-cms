const { resolve } = require('path');
const glob = require('glob');
const assert = require('assert');

const TemplateCompiler = require('../TemplateCompiler');

/**
 * Helps keep the database data structure in sync with the site templates
 */
class Builder {
  /*
   * @param {{Section, templatesDir: string}} options - Section model and template directory
   *
   * @todo Remove {options}, and use regular ol' passed in variables
   */
  constructor(templatesDir) {
    this.dir = templatesDir;
    this._lastTree = null;
  }

  /**
   * Initializes the _lastTree from Section entries
   */
  async init(Section) {
    const sections = await Section.findAll();

    this._lastTree = sections.reduce((memo, section) => {
      /* eslint-disable-next-line no-param-reassign */
      memo[section.name] = {
        form: section.form,
        options: section.options,
        fields: section.fields,
      };

      return memo;
    }, {});
  }
  /* eslint-enable class-methods-use-this */

  /**
   * Parses templates and updates the database
   */
  async build(Section) {
    const { tree } = this;

    // For every template file
    const sectionPromises = [];
    for (const [name, params] of Object.entries(tree)) {
      sectionPromises.push(Section.rebuild(name, params));
    }

    const existing = await Promise.all(sectionPromises);
    await Section.destroyExceptExisting(existing);

    this._lastTree = tree;
  }

  /**
   * Determines if tree has changed since last build
   *
   * @todo Cache so this isn't as taxing on the load time
   */
  get isDirty() {
    // TODO: Should remove _permalink and other special fields
    try {
      assert.deepStrictEqual(this.tree, this._lastTree);
      return false;
    } catch (_err) {
      return true;
    }
  }

  /**
   * Crawls templates, and creates object representing the data model
   *
   * @param {array} templates - array of file paths
   * @return {Object} template tree
   *
   * @todo Yuck, this is nasty. Clean it up.
   */
  /* eslint-disable no-restricted-syntax */
  get tree() {
    const tree = {};
    const templates = glob.sync(resolve(this.dir, '**/*.{html,xml,rss,json}'));

    for (const tpl of templates) {
      const parsed = TemplateCompiler.fromFile(tpl).parse();

      for (const [, sectionAttrs] of Object.entries(parsed)) {
        const sectionName = sectionAttrs.name;

        tree[sectionName] = tree[sectionName] || { form: false, options: {}, fields: {} };
        Object.assign(tree[sectionName].options, sectionAttrs.params);
        tree[sectionName].form = tree[sectionName].form || sectionAttrs.keyword === 'form';

        for (const [, fieldAttrs] of Object.entries(sectionAttrs.fields)) {
          const fieldName = fieldAttrs.key;

          // Resolve the section we're targeting if there is a context specified.
          const resolvedSection = fieldAttrs.context || sectionName;
          tree[resolvedSection] = tree[resolvedSection] || { form: false, options: {}, fields: {} };

          tree[resolvedSection].fields[fieldName] = { type: 'text', ...tree[resolvedSection].fields[fieldName] || {}, ...fieldAttrs.params };
        }
      }
    }

    return tree;
  }
  /* eslint-enable no-restricted-syntax */
}


module.exports = Builder;
