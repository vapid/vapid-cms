const directives = require('../../directives');

module.exports = class LinkHelper {
  static run(value, options) {
    const image = directives.get('image').normalize((typeof value === 'function') ? value() : value);
    const context = { blockParams: [image] };
    // if (!image.url || !link.name) { return options.inverse ? options.inverse(this) : ''; }
    return image ? options.fn(this, context) : '';
  }

  static get isField() { return true; }
  static getType() { return 'image'; }

  static blockParam() { return undefined; }
};
