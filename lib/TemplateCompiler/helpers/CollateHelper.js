const Handlebars = require('handlebars');

const { Utils } = require('../../utils');

module.exports = class CollateHelper {
  static get isBranch() { return true; }

  static getType() { return 'collection'; }

  static run(collection, options) {
    const values = new Set();
    let out = '';
    const prop = (options.hash || {}).key;

    if (!prop) {
      throw new Error('You must provide a key to the `{{collate}}` helper.');
    }

    for (const record of collection) {
      let value = typeof record[prop] === 'function' ? record[prop]() : record[prop];
      if (!Array.isArray(value)) { value = value ? [value] : []; }
      if (!value.length && options.hash.default) {
        values.add(undefined);
      }
      for (let v of value) {
        if (v instanceof Handlebars.SafeString) { v = v.string; }
        values.add(v);
      }
    }

    for (const value of values) {
      const context = {
        blockParams: [{
          value,
          name: value || options.hash.default,
          slug: value ? Utils.kebabCase(value) : Utils.kebabCase(options.hash.default),
        }],
      };
      out += options.fn(this, context);
    }
    return out;
  }

  static blockParam() { return undefined; }
};
