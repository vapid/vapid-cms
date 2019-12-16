
module.exports = class SectionHelper {
  static get isBranch() { return true; }

  static getType(leaf) { return leaf.hash.multiple ? 'collection' : 'setting'; }

  static run(data = [], options) {
    let out = '';
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      out += options.fn(item, { data: options.data });
    }
    return out;
  }

  static blockParam(idx, node) {
    if (idx > 0) { return undefined; }
    return {
      name: node.params[0].original,
      type: 'section',
      isPrivate: node.params[0].data,
    };
  }
};
