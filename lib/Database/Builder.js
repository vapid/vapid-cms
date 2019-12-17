const { basename, dirname, resolve } = require('path');
const fs = require('fs');
const glob = require('glob');
const assert = require('assert');

const TemplateCompiler = require('../TemplateCompiler');

const vapidCompiler = new TemplateCompiler();

/**
 * Helps keep the database data structure in sync with the site templates
 */
class Builder {
  /*
   * @param {{Template, templatesDir: string}} options - Template model and template directory
   *
   * @todo Remove {options}, and use regular ol' passed in variables
   */
  constructor(templatesDir) {
    this.dir = templatesDir;
    this._lastTree = null;
  }

  /**
   * Initializes the _lastTree from Template entries
   */
  async init(Template) {
    const templates = await Template.findAll();

    this._lastTree = templates.reduce((memo, template) => {
      /* eslint-disable-next-line no-param-reassign */
      memo[`${template.type}:${template.name}`] = {
        id: template.id,
        type: template.type,
        name: template.name,
        options: template.options,
        fields: template.fields,
      };

      return memo;
    }, {});
  }
  /* eslint-enable class-methods-use-this */

  /**
   * Parses templates and updates the database
   */
  async build(Template) {
    const { tree } = this;

    // For every template file
    let existing = [];
    for (const [, params] of Object.entries(tree)) {
      existing.push(Template.rebuild(params.type, params.name, params));
    }
    existing = await Promise.all(existing);

    await Template.destroyExceptExisting(existing);

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
   */
  get tree() {
    const tree = {};
    const templates = glob.sync(resolve(this.dir, '**/*.html'));
    for (const tpl of templates) {
      const parsed = vapidCompiler.parseFile(tpl).data;
      for (const [sectionName, sectionValues] of Object.entries(parsed)) {
        // Get or create this data section as needed.
        const section = tree[sectionName] || {
          type: null,
          name: null,
          options: {},
          fields: {},
        };
        tree[sectionName] = section;

        // Ensure the section name and type are set.
        section.name = section.name || sectionValues.name;
        section.type = section.type || sectionValues.type;

        // Merge section options
        Object.assign(section.options, sectionValues.options);

        // For every field discovered in the content block, track them in the section.
        for (const [, fieldAttrs] of Object.entries(sectionValues.fields)) {
          section.fields[fieldAttrs.key] = Object.assign(
            // Default to `type: text` if not specified.
            { type: 'text' },
            // Merge with previous values if this field has been seen already.
            section.fields[fieldAttrs.key] || {},
            // Include all hash params for this field.
            fieldAttrs.hash,
          );
          // console.log(section.fields[fieldAttrs.key]);
        }
      }
    }

    return tree;
  }
}


module.exports = Builder;
