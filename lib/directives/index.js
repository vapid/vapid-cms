const glob = require('glob');
const { Utils, Logger } = require('../utils');

const BaseDirective = require('./base');

// TODO: Allow custom directives in site folder?
const vapidDirectives = glob.sync(`${__dirname}/!(base|index).js`);
const availableDirectives = {};

// Populate available directives
vapidDirectives.forEach((file) => {
  /* eslint-disable-next-line global-require, import/no-dynamic-require */
  const klass = require(file)(BaseDirective);
  const name = Utils.kebabCase(klass.name).split('-')[0];

  availableDirectives[name] = klass;
});

/**
 * Lookup function for available directives. Return a new instance if found.
 * Falls back to "text" directive if one can't be found.
 *
 * @params {Object} params - options and attributes
 * @return {Directive} - an directive instance
 */
function find(params = {}) {
  // If no name is given, silently fall back to text.
  const name = params.type === undefined ? `text` : params.type;

  if (availableDirectives[name]) {
    return new availableDirectives[name](params);
  }

  // Only show warning if someone explicity enters a bad name
  if (name) { Logger.warn(`Directive type '${name}' does not exist. Falling back to 'text'`); }

  /* eslint-disable-next-line new-cap */
  return new availableDirectives.text(params);
}

module.exports = {
  find,
};
