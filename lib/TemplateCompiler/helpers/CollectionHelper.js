
const { DATA_SYMBOL } = require('../constants');

module.exports = class CollectionHelper {
  static get isBranch() { return true; }

  static getType() { return 'collection'; }

  static run(data, options) {
    const items = (Array.isArray(data) ? data : [data]).filter(Boolean);
    const limit = (options.hash && options.hash.limit) || Infinity;

    // If collection is empty, and the helper provides an empty state, render the empty state.
    if (items.length === 0 && options.inverse) return options.inverse(this) || '';

    // Otherwise, render each item!
    let out = '';
    let count = 0;

    for (const item of items) {
      if (count >= limit) { break; }
      count += 1;
      out += options.fn(this, {
        data: {
          record: item[DATA_SYMBOL],
        },
        blockParams: [item],
      });
    }
    return out;
  }

  static blockParam(idx, node) {
    if (idx > 0) { return undefined; }
    return {
      name: node.params[0].original,
      type: 'collection',
      isPrivate: node.params[0].data,
    };
  }
};
