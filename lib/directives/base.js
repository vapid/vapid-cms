const Utils = require('../utils');

/**
 * Defaults
 *
 * @option {string} [label] - form label
 * @option {string} [help] - help text under form field
 * @attr {string} [placeholder=''] - input placeholder
 * @attr {boolean} [required=true] - all fields are required by default
 */
const DEFAULTS = {
  options: {
    label: undefined,
    help: undefined,
    priority: undefined,
    default: '',
  },

  attrs: {
    placeholder: '',
    required: true,
  },
};

/**
 * The base class that all directives inherit from.
 * These are the crux of Vapid, allowing templates to specify input attributes and render content.
 */
class BaseDirective {
  /**
   * Separates options and attributes, and discards ones that aren't explicity specified
   *
   * @param {Object} params
   */
  constructor(params) {
    const defaults = Utils.merge({}, DEFAULTS, this.constructor.DEFAULTS || {});
    const [options, attrs] = _parseParams(params, defaults);

    this.options = Utils.merge(defaults.options, options);
    this.attrs = Utils.merge(defaults.attrs, attrs);
  }

  /**
   * Converts attrs object into HTML key=value attributes
   * Typically used by the input method
   *
   * @return {string}
   */
  get htmlAttrs() {
    const pairs = Utils.transform(this.attrs, (memo, value, key) => {
      if (value !== undefined && value !== false) {
        memo.push(`${key}="${Utils.escape(value)}"`);
      }
    }, []);

    return pairs.join(' ');
  }

  /**
   * Renders an HTML text input
   * Typically used in the dashboard forms, or front-end contact forms
   *
   * @param {string} name
   * @param {string} [value=this.options.default]
   * @return {string}
   */
  input(name, value = this.options.default) {
    return `<input type="text" name="${name}" value="${Utils.escape(value)}" ${this.htmlAttrs}>`;
  }

  /**
   * Escaped value
   * Typically used when rendering front-end templates
   *
   * @param {string} [value=this.options.default]
   * @return {string}
   */
  /* eslint-disable class-methods-use-this */
  render(value = this.options.default) {
    return Utils.escape(value);
  }
  /* eslint-enable class-methods-use-this */

  /**
   * A preview of the value.
   * Typically used by the dashboard, to preview content.
   *
   * @param {string} value
   * @return {string}
   */
  preview(value) {
    return this.render(value);
  }

  /**
   * Helps convert the value before it's stored in the database
   *
   * @param {string} value
   * @return {string}
   */
  /* eslint-disable class-methods-use-this */
  serialize(value) {
    return value;
  }
  /* eslint-enable class-methods-use-this */
}

/**
 * @private
 *
 * Sifts constructor params into two buckets: attrs and options
 * Discards anything not specifed in defaults
 *
 * @param {Object} params
 * @param {Object} defaults
 * @return {[options: Object, attrs: Object]}
 */
function _parseParams(params, defaults) {
  const options = {};
  const attrs = {};

  Utils.each(params, (value, key) => {
    const coerced = Utils.coerceType(value);

    if (Utils.has(defaults.options, key)) {
      options[key] = coerced;
    } else if (Utils.has(defaults.attrs, key)) {
      attrs[key] = coerced;
    }
  });

  return [options, attrs];
}

module.exports = BaseDirective;
