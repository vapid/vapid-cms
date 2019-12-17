// TODO: Clean this up. Lots of hacky stuff in here
const { readFileSync } = require('fs');
const { basename, dirname } = require('path');
const Boom = require('@hapi/boom');
const Handlebars = require('handlebars');
const { Utils } = require('../utils');

const SectionHelper = require('./helpers/SectionHelper');
const CollectionHelper = require('./helpers/CollectionHelper');

const IfHelper = require('./helpers/IfHelper');
const UnlessHelper = require('./helpers/UnlessHelper');
const CollateHelper = require('./helpers/CollateHelper');
const EachHelper = require('./helpers/EachHelper');
const EqHelper = require('./helpers/EqHelper');

const LinkHelper = require('./helpers/LinkHelper');
const DateHelper = require('./helpers/DateHelper');

const { DATA_SYMBOL } = require('./constants');

function unwrap(func) {
  return function helperWrapper(...args) {
    const values = [];
    for (let arg of args) {
      arg = (typeof arg === 'function') ? arg() : arg;
      arg = (arg instanceof Handlebars.SafeString) ? arg.string : arg;
      values.push(arg);
    }
    return func.apply(this, values);
  };
}

/* eslint-enable no-param-reassign */
function parseHash(hash = {}) {
  const out = {};
  for (const pair of hash.pairs || []) {
    out[pair.key] = pair.value.original;
  }
  return out;
}

function missingData(context = {}) {
  return (context.hash && context.hash.default) || `{{${context._context || 'general'}:${context.name}}}`;
}

/**
 * TemplateCompiler class
 * Used in conjunction with a modified version of Mustache.js (Goatee)
 */
class TemplateCompiler {
  /**
   * @param {object} partials – The partials to make available in this project.
   * @param {array} helpers - Additional helpers to make available in this project.
   */
  constructor(partials = {}, helpers = {}) {
    this.helpers = {};

    // Set up our Handlebars instance.
    // Vapid does not support the default helpers.
    this.Handlebars = Handlebars.create();
    this.Handlebars.helpers = {};
    this.Handlebars.partials = partials;

    // Register the ones we *do* support!
    this.registerHelper('collection', CollectionHelper);
    this.registerHelper('section', SectionHelper);

    this.registerHelper('if', IfHelper);
    this.registerHelper('unless', UnlessHelper);
    this.registerHelper('collate', CollateHelper);
    this.registerHelper('each', EachHelper);
    this.registerHelper('eq', EqHelper);

    this.registerHelper('link', LinkHelper);
    this.registerHelper('date', DateHelper);

    // Special helper for logging missing data.
    this.Handlebars.registerHelper('helperMissing', missingData);

    // Register 3rd party helpers
    for (const [name, helper] of Object.entries(helpers)) {
      this.registerHelper(name, helper);
    }
  }

  static get DATA_SYMBOL() { return DATA_SYMBOL; }

  // Wrap all helpers so we unwrap function values and SafeStrings
  registerHelper(name, helper) {
    this.Handlebars.registerHelper(name, unwrap(helper.run));
    this.helpers[name] = helper;
  }

  // Get if a given string is a registered helper name.
  isHelper(name) {
    return !!this.Handlebars.helpers[name];
  }

  /**
   * Parses the HTML, and creates a template tree
   *
   * @return {Object} - a representation of the content
   */
  parse(name, type, html, data = {}) {
    let ast;
    try {
      ast = Handlebars.parse(html);
    } catch (err) {
      throw Boom.boomify(err, { message: 'Bad template syntax' });
    }

    if (type !== 'partial') {
      /* eslint-disable-next-line no-param-reassign */
      data[`${type}:${name}`.toLowerCase()] = {
        name,
        type,
        options: {},
        fields: {},
      };
    }

    this.walk(data, ast, {
      '': { name: 'general', type: 'setting' },
      'this': { name, type },
    });

    return {
      name,
      type,
      data,
      ast,
    };
  }

  /**
   * Applies content to the template
   *
   * @param {Object} content
   * @return {string} - HTML that has tags replaced with content
   */
  parseFile(filePath) {
    const html = readFileSync(filePath, 'utf8');
    const name = basename(filePath, '.html');
    let type = 'page';
    if (dirname(filePath).endsWith('collections')) {
      type = 'collection';
    } else if (dirname(filePath).endsWith('collections')) {
      type = 'collection';
    } else if (name.startsWith('_') || dirname(filePath).endsWith('partials')) {
      type = 'partial';
    }
    return this.parse(name, type, html);
  }

  /**
   * Applies content to the template
   *
   * @param {Object} content
   * @return {string} - HTML that has tags replaced with content
   */
  render(name, type, html, context = {}, data = {}) {
    const ast = typeof html === 'string' ? this.parse(name, type, html) : html;
    return this.Handlebars.compile(ast, { knownHelpersOnly: false, explicitPartialContext: false })(
      context,
      { data },
    );
  }

  /**
   * Applies content to the template
   *
   * @param {Object} content
   * @return {string} - HTML that has tags replaced with content
   */
  renderFile(filePath, content = {}, data = {}) {
    const { name, type, ast } = this.parseFile(filePath);
    return this.render(name, type, ast, content, data);
  }

  /**
   * @private
   *
   * Recursively walks Mustache tokens, and creates a tree that Vapid understands.
   *
   * @param {Object} tree - a memo that holds the total tree value
   * @param {array} branch - Mustache tokens
   * @return {Object} tree of sections, fields, params, etc.
   */
  /* eslint-disable no-param-reassign */
  walk(data, node, aliases = {}) {
    
    // Create a new copy of local aliases lookup object each time we enter a new block.
    aliases = Object.create(aliases);

    switch (node.type) {
      case 'Program':
        node.body.forEach((n) => {
          this.walk(data, n, aliases);
        });
        break;

      case 'DecoratorBlock': throw new Error('Vapid does not support Decorators.');
      case 'Decorator': throw new Error('Vapid does not support Decorators.');

      case 'ContentStatement':
        // TODO: Components?
        break;

      case 'PathExpression': {
        const [leaf, path] = this.parseExpression(node);
        addToTree(data, leaf, path, aliases);
        break;
      }

      case 'MustacheStatement':
      case 'SubExpression': {
        // If this mustache has params, it must be a helper.
        // Crawl all its params as potential data values.
        if (node.params && node.params.length) {
          for (const param of node.params) {
            this.walk(data, param, aliases);
          }

        // Otherwise, this is a plain data value reference. Add it to the current object.
        } else {
          const [leaf, path] = this.parseExpression(node);
          addToTree(data, leaf, path, aliases);
        }
        break;
      }

      case 'BlockStatement': {
        // All Block statements are helpers. Grab the helper we're evaluating.
        const helper = this.helpers[node.path.original];
        
        // Crawl all its params as potential data values in scope.
        if (node.params.length && !helper.isBranch) {
          for (const param of node.params) {
            this.walk(data, param, aliases);
          }
        }
        
        // If this helper denotes the creation of a field, add it to the current model.
        if (helper.isField) {
          const [leaf, path] = this.parseExpression(node);
          leaf.hash.type = helper.getType ? (helper.getType(leaf) || leaf.type) : leaf.type;
          addToTree(data, leaf, path, aliases);
        }

        // If this helper denotes the creation of a new model type, ensure the model.
        if (helper.isBranch) {
          this.ensureBranch(data, node, helper);
        }

        // Assign any yielded block params to the aliases object.
        node.program.blockParams = node.program.blockParams || [];
        for (let idx = 0; idx < node.program.blockParams.length; idx += 1) {
          const param = node.program.blockParams[idx];
          aliases[param] = helper.blockParam(idx, node) || {
            name: param,
            type: 'private',
            isPrivate: true,
          };
        }

        // Section tags change the `this` scope... This is special cased for now.
        if (node.path.original === 'section') {
          aliases[''] = {
            name: node.params[0].original,
            type: parseHash(node.hash).multiple === true ? 'collection' : 'setting',
            isPrivate: node.params[0].data,
          };
        }

        if (node.program) this.walk(data, node.program, aliases);
        if (node.inverse) this.walk(data, node.inverse, aliases);
        break;
      }

      case 'PartialStatement':
      case 'PartialBlockStatement':
        // TODO: Ban partials?
        if (this.Handlebars.partials[node.name.original]) {
          this.Handlebars.partials[node.name.original] = this.parse(
            aliases.this.name,
            aliases.this.type,
            this.Handlebars.partials[node.name.original],
            data,
            aliases,
          ).ast;
        }
        if (node.program) this.walk(data, node.program, aliases);
        break;

      default: {
        /*
          Do nothing for:
            - CommentStatement
            - StringLiteral
            - NumberLiteral
            - BooleanLiteral
            - UndefinedLiteral
            - NullLiteral
        */
        break;
      }
    }

    return data;
  }

  /* eslint-disable prefer-destructuring */
  parseExpression(node) {
    let path;
    let hash;

    switch (node.type) {
      case 'PathExpression':
        path = node;
        hash = {};
        break;
      case 'BlockStatement':
        path = this.parseExpression(node.params[0])[1];
        hash = parseHash(node.hash);
        break;
      case 'MustacheStatement':
      case 'SubExpression':
        if (node.params.length) {
          const tmp = this.parseExpression(node.params[0]);
          path = tmp[1];
          hash = tmp[0].hash;
        } else {
          path = node.path;
          hash = parseHash(node.hash);
        }
        break;
      default: {
        return [null, null];
      }
    }

    if (path.original[0] === '_') {
      console.warn('[DEPRECATION] Private fields must be prefixed with an `@` instead of `_');
      path.original = path.original.replace('_', '@');
      path.parts = [path.original];
      path.data = true;
    }

    const context = path.original.indexOf('this') === 0 ? 'this' : '';
    const key = path.parts.length === 1 ? path.parts[0] : path.parts.slice(1).join('.');

    // TODO: Handle literal values
    return [{
      original: path.original,
      key,
      context: path.parts.length === 1 ? context : path.parts[0],
      path: path.original,
      parts: path.parts,
      hash,
      isPrivate: path.data,
    }, path];
  }
  /* eslint-enable prefer-destructuring */

  ensureBranch(data, node, helper) {
    const [expr] = this.parseExpression(node);

    // If this is not an expression we care about, move on.
    if (!expr) { return; }

    // If this block is referencing a data property, don't add it to our data model.
    if (node.params.length && (node.params[0].data || expr.isPrivate)) { return; }

    // Record the type of this section appropriately
    const type = helper.getType(expr);

    const name = expr.context || expr.key;
    const sectionKey = `${type}:${name}`.toLowerCase();
    const newBranch = {
      name,
      type,
      options: expr.hash,
      fields: {},
    };
    const branch = data[sectionKey] || newBranch;
    Utils.merge(branch.options, newBranch.options);
    Utils.merge(branch.fields, newBranch.fields);

    /* eslint-disable-next-line no-param-reassign */
    data[sectionKey] = branch;
  }
}

/**
 * @private
 *
 * Parses a leaf token, and merges into the branch
 *
 * @params {string} leaf;
 * @params {string} path;
 * @params {string} tree;
 * @params {Object} aliases
 * @return {Object}
 */
function addToTree(data, leaf, path, aliases) {
  // If this is a private path, no-op.
  if (!leaf || leaf.isPrivate) { return data; }
  
  // If this is a private section, no-op.
  const isPrivateSection = aliases[leaf.context] ? aliases[leaf.context].isPrivate : false;
  if (isPrivateSection) { return data; }

  // If this is a private key, no-op.
  const isPrivateKey = (!leaf.context && aliases[leaf.key]) ? aliases[leaf.key].isPrivate : false;
  if (isPrivateKey) { return data; }

  // Log a warning if we're referencing the default general context without an explicit reference.
  // Update the original path node so we can actually render the template.
  if (!leaf.context && !leaf.isPrivate && aliases[''] && aliases[''].name === 'general') {
    console.warn(`[DEPRECATION] Referencing values without a context is deprecated. Found: {{${leaf.original}}}`);
    leaf.context = 'general';
    path.parts.unshift('general');
    path.original = `general.${path.original}`;
  }

  // Get our section reference descriptor.
  const name = (aliases[leaf.context] ? aliases[leaf.context].name : leaf.context) || 'general';
  const type = (aliases[leaf.context] ? aliases[leaf.context].type : 'setting') || 'setting';
  const sectionKey = `${type}:${name}`.toLowerCase();

  // Ensure the model object reference exists.
  data[sectionKey] = data[sectionKey] || {
    name,
    type,
    options: {},
    fields: {},
  };

  // Ensure the field descriptor exists. Merge settings if already exists.
  const leafValue = Utils.merge(data[sectionKey].fields[leaf.key] || {}, leaf);
  data[sectionKey].fields[leaf.key] = leafValue;

  return data;
}

module.exports = TemplateCompiler;
