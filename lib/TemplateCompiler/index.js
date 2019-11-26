// TODO: Clean this up. Lots of hacky stuff in here
const { readFileSync } = require('fs');
const { basename, dirname } = require('path');
const Boom = require('@hapi/boom');
const Handlebars = require('handlebars');
const { Utils } = require('../utils');
const directives = require('../directives');

/*
  ContentStatement,
  CommentStatement,
  StringLiteral,
  NumberLiteral,
  BooleanLiteral,
  UndefinedLiteral,
  NullLiteral
*/

function formHelper(...args) {
  const options = args.pop();
  return options.fn && options.fn(this);
}

function linkHelper(value, options) {
  const link = directives.get('link').normalize((typeof value === 'function') ? value() : value);
  const context = { blockParams: [link] };
  if (!link.url || !link.name) { return options.inverse ? options.inverse(this) : ''; }
  return link ? options.fn(this, context) : '';
}

function ifHelper(...args) {
  const options = args.pop();
  let [condition, ifValue, elseValue] = args;

  condition = (typeof condition === 'function') ? condition() : condition;
  if (`${condition}`.startsWith('data:')) { condition = false; }
  ifValue = (typeof ifValue === 'function') ? ifValue() : ifValue;
  elseValue = (typeof elseValue === 'function') ? elseValue() : elseValue;
  console.log(condition, ifValue, elseValue)
  if (condition instanceof Handlebars.SafeString) { condition = !!condition.string; }
  if (!options.fn) { return condition ? ifValue : elseValue; }
  return condition ? options.fn(this) : (options.inverse ? options.inverse(this) : '');
}

function unlessHelper(input, ...args) {
  let condition = (typeof input === 'function') ? input() : input;
  if (typeof condition === 'string' && condition.startsWith('data:')) { condition = false; }
  if (condition instanceof Handlebars.SafeString) { condition = !!condition.string; }
  return ifHelper.call(this, !condition, ...args);
}

function collectionHelper(input, options) {
  const data = (typeof input === 'function') ? input() : input;
  let out = '';
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    out += options.fn(this, {
      data: item.__data__,
      blockParams: [item],
    });
  }

  return out;
}

function sectionHelper(input = [], options) {
  let out = '';
  const data = (typeof input === 'function') ? input() : input;
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    out += options.fn(item, { data: options.data });
  }
  return out;
}

function missingData(context = {}, _options = {}) {
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
    this.Handlebars = Handlebars.create();
    this.Handlebars.partials = partials;

    for (const [name, helper] of Object.entries(helpers)) {
      this.Handlebars.registerHelper(name, helper);
    }

    // Vapid does not support these default helpers
    delete this.Handlebars.helpers.each;
    delete this.Handlebars.helpers.with;
    delete this.Handlebars.helpers.lookup;
    delete this.Handlebars.helpers.if;
    delete this.Handlebars.helpers.unless;

    this.Handlebars.registerHelper('if', ifHelper);
    this.Handlebars.registerHelper('unless', unlessHelper);
    this.Handlebars.registerHelper('collection', collectionHelper);
    this.Handlebars.registerHelper('section', sectionHelper);
    this.Handlebars.registerHelper('form', formHelper);
    this.Handlebars.registerHelper('link', linkHelper);
    this.Handlebars.registerHelper('helperMissing', missingData);
  }

  /**
   * Parses the HTML, and creates a template tree
   *
   * @return {Object} - a representation of the content
   */
  parse(name, type, html, tree = {}) {
    let ast;
    try {
      ast = Handlebars.parse(html);
    } catch (err) {
      throw Boom.boomify(err, { message: 'Bad template syntax' });
    }

    if (type !== 'partial') {
      tree[`${type}:${name}`.toLowerCase()] = { name, type, options: {}, fields: {} };
    }

    const data = _walk.call(this, tree, ast, 'general', {
      '': { name: 'general', type: 'setting' },
      this: { name, type },
    });

    return { name, type, data, ast };
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
    const type = name.startsWith('_') ? 'partial' : dirname(filePath).endsWith('collections') ? 'collection' : 'page';
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
}


/**
 * @private
 *
 * Recursively walks Mustache tokens, and creates a tree that Vapid understands.
 *
 * @param {Object} tree - a memo that holds the total tree value
 * @param {array} branch - Mustache tokens
 * @param {string} branchToken - current branch name and params
 * @return {Object} tree of sections, fields, params, etc.
 */
/* eslint-disable no-param-reassign */
function _walk(tree, program, branchToken, aliases = {}) {
  if (program.type !== 'Program') { throw new Error('Whoops! Something went wrong...'); }

  program.body.forEach((node) => {
    switch (node.type) {
      case 'DecoratorBlock': throw new Error('Vapid does not support Decorators.');
      case 'Decorator': throw new Error('Vapid does not support Decorators.');
      case 'ContentStatement':
        // TODO: Components?
        break;
      case 'MustacheStatement': {
        switch (node.path.original) {
          case 'if':
          case 'unless':
            node.params[0] && addToTree(tree, branchToken, node.params[0], aliases);
            node.params[1] && addToTree(tree, branchToken, node.params[1], aliases);
            node.params[2] && addToTree(tree, branchToken, node.params[2], aliases);
            break;
          default:
            addToTree(tree, branchToken, node, aliases);
            break;
        }
        break;
      }
      case 'PartialStatement':
        // TODO: Ban `this` in partials?
        if (this.Handlebars.partials[node.name.original]) {
          this.Handlebars.partials[node.name.original] = this.parse(aliases.this.name, aliases.this.type, this.Handlebars.partials[node.name.original], tree).ast;
        }
        break;
      case 'PartialBlockStatement':
        // TODO: Ban `this` in partials?
        if (this.Handlebars.partials[node.name.original]) {
          this.Handlebars.partials[node.name.original] = this.parse(aliases.this.name, aliases.this.type, this.Handlebars.partials[node.name.original], tree).ast;
        }
        if (node.program) _walk.call(this, tree, node.program, branchToken, aliases);
        break;
      case 'BlockStatement': {
        switch (node.path.original) {
          case 'link':
            addToTree(tree, branchToken, node, aliases);
            aliases = Object.assign({}, aliases, {
              [node.program.blockParams[0]]: {
                name: node.params[0].original,
                type: 'private',
                isPrivate: true,
              },
            });
            if (node.program) _walk.call(this, tree, node.program, branchToken, aliases);
            if (node.inverse) _walk.call(this, tree, node.inverse, branchToken, aliases);
            break;
          case 'if':
          case 'unless':
            addToTree(tree, branchToken, node, aliases);
            if (node.program) _walk.call(this, tree, node.program, branchToken, aliases);
            if (node.inverse) _walk.call(this, tree, node.inverse, branchToken, aliases);
            break;
          case 'collection':
            ensureBranch(tree, node);
            if (node.program.blockParams && node.program.blockParams[0]) {
              aliases = Object.assign({}, aliases, {
                [node.program.blockParams[0]]: {
                  name: node.params[0].original,
                  type: 'collection',
                  isPrivate: node.params[0].data,
                },
              });
            }
            if (node.program) _walk.call(this, tree, node.program, branchToken, aliases);
            if (node.inverse) _walk.call(this, tree, node.inverse, branchToken, aliases);
            break;
          case 'section':
            ensureBranch(tree, node);
            aliases = Object.assign({}, aliases, {
              '': {
                name: node.params[0].original,
                type: parseHash(node.hash).multiple === true ? 'collection' : 'setting',
                isPrivate: node.params[0].data,
              },
            });
            if (node.program) _walk.call(this, tree, node.program, node.params[0].original, aliases);
            if (node.inverse) _walk.call(this, tree, node.inverse, node.params[0].original, aliases);
            break;
          case 'form':
            ensureBranch(tree, node);
            aliases = Object.assign({}, aliases, {
              '': {
                name: node.params[0].original,
                type: 'form',
                isPrivate: node.params[0].data,
              },
            });
            if (node.program) _walk.call(this, tree, node.program, node.params[0].original, aliases);
            break;
          default: break;
        }
        break;
      }
      default: {
        // Do nothing
        break;
      }
    }
  });

  return tree;
}
/* eslint-enable no-param-reassign */

function parseHash(hash = {}) {
  const out = {};
  for (const pair of hash.pairs || []) {
    out[pair.key] = pair.value.original;
  }
  return out;
}

/* eslint-disable prefer-destructuring */
function parseExpression(node) {
  let path;
  let hash;

  switch (node.type) {
    case 'PathExpression':
      path = node;
      hash = {};
      break;
    case 'BlockStatement':
      path = node.params[0];
      hash = parseHash(node.hash);
      // TODO: Don't special case
      if (node.path.original === 'link') {
        hash.type = 'link';
      }
      break;
    case 'MustacheStatement':
      path = node.path;
      hash = parseHash(node.hash);
      break;
    case 'SubExpression':
      path = node.path;
      hash = parseHash(node.hash);
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
    params: hash,
    isPrivate: path.data,
  }, path];
}
/* eslint-enable prefer-destructuring */

function ensureBranch(tree, node) {
  const [expr] = parseExpression(node);

  // If this is not an expression we care about, move on.
  if (!expr) { return; }

  // If this block is referencing a data property, don't add it to our data model.
  if (node.params.length && node.params[0].data) { return; }

  // Record the type of this section appropriately
  let type = node.path.original;
  if (type === 'section' && expr.params.multiple) {
    type = 'collection';
  } else if (type === 'section') {
    type = 'setting';
  }
  const name = expr.context || expr.key;
  const sectionKey = `${type}:${name}`.toLowerCase();
  const newBranch = {
    name,
    type,
    options: expr.params,
    fields: {},
  };
  const branch = tree[sectionKey] || newBranch;
  Utils.merge(branch.options, newBranch.options);
  Utils.merge(branch.fields, newBranch.fields);

  /* eslint-disable-next-line no-param-reassign */
  tree[sectionKey] = branch;
}

/**
 * @private
 *
 * Parses a leaf token, and merges into the branch
 *
 * @params {Object} tree
 * @params {string} branchToken
 * @params {string} leftToken;
 * @return {Object}
 */
function addToTree(tree, branchToken, node, aliases, options) {
  /* eslint-disable max-len, no-param-reassign */
  const [leaf, path] = parseExpression(node);
  if (!leaf || leaf.isPrivate) { return tree; }
  if (!leaf.context && aliases[''].name === 'general' && !leaf.isPrivate) {
    console.warn(`[DEPRECATION] Referencing values without a context is deprecated. Found: {{${leaf.original}}}`);
    leaf.context = 'general';
    path.parts.unshift('general');
    path.original = `general.${path.original}`;
  }
  const isPrivateSection = aliases[leaf.context] ? aliases[leaf.context].isPrivate : false;
  if (leaf.isPrivate || isPrivateSection) { return tree; }
  const name = (aliases[leaf.context] ? aliases[leaf.context].name : (leaf.context || branchToken));
  const type = (aliases[leaf.context] ? aliases[leaf.context].type : 'setting');
  const sectionKey = `${type}:${name}`.toLowerCase();
  tree[sectionKey] = tree[sectionKey] || { name, type, options: {}, fields: {} };
  Object.assign(tree[sectionKey].options, options);
  const leafValue = Utils.merge(tree[sectionKey].fields[leaf.key] || {}, leaf);
  tree[sectionKey].fields[leaf.key] = leafValue;
  /* eslint-enable max-len, no-param-reassign */

  return tree;
}

module.exports = TemplateCompiler;
