const directives = require('../../directives');

module.exports = class LinkHelper {
  static run(value, options) {
    const link = directives.get('link').normalize((typeof value === 'function') ? value() : value);
    const context = { blockParams: [link] };
    if (!link.url || !link.name) { return options.inverse ? options.inverse(this) : ''; }
    return link ? options.fn(this, context) : '';
  }

  static get isField() { return true; }
  static getType() { return 'link'; }

  static blockParam() { return undefined; }
};
