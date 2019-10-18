const unfurl = require('unfurl.js');

/**
 * Defaults
 *
 * @option {boolean} [unfurl=false] - render links as oEmbeds
 */
const DEFAULTS = {
  options: {
    unfurl: false,
  },
};

const cache = new Map();

module.exports = (BaseDirective) => {
  /**
   * Links that are optionally rendered
   */
  class LinkDirective extends BaseDirective {
    /**
     * @static
     *
     * @return {Object} default attrs and options
     */
    static get DEFAULTS() {
      return DEFAULTS;
    }

    /* eslint-disable class-methods-use-this */
    /**
     * Renders an HTML url input
     *
     * @param {string} name
     * @param {string} [value=this.options.default]
     * @return rendered input
     */
    input(name, value = this.options.default) {
      return `<input type="url" name="${name}" value="${value}">`;
    }

    /**
     * The raw value.
     * Typically, directives escape the value.
     *
     * @param {string} [value=this.options.default]
     * @return {string}
     */
    preview(value = this.options.default) {
      return value;
    }
    /* eslint-enable class-methods-use-this */

    /**
     * Renders the link, or optionally an oEmbed
     *
     * @param {string} [value=this.options.default]
     * @return {string}
     */
    render(value = this.options.default) {
      if (value != null && this.options.unfurl) {
        return _oembed(value);
      }

      return value;
    }
  }

  /**
   * @private
   *
   * Attempt to get the oEmbed info for a given link
   * Falls back to an <a> tag if that's not possible.
   *
   * @param {string} value
   * @return {string}
   */
  async function _oembed(value) {
    let result = cache.get(value);

    if (result) {
      return result;
    }

    try {
      const unfurled = await unfurl(value);
      result = unfurled.oembed.html;
    } catch (err) {
      result = `<a href="${value}">${value}</a>`;
    }

    cache.set(value, result);
    return result;
  }

  return LinkDirective;
};
