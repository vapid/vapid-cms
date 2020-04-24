const { Utils } = require('../utils');

/**
 * Defaults
 *
 * @attrs {number} [maxlength] - Maximum number of input characters
 * @options {boolean} [long] - determines text or textarea input
 */
const DEFAULTS = {
  attrs: {
    maxlength: undefined,
  },

  options: {
    prefix: '',
  },
};

module.exports = (BaseDirective) => {
  /*
   * Plain text
   */
  class UrlDirective extends BaseDirective {
    /**
     * @static
     *
     * @return {Object} default attrs and options
     */
    static get DEFAULTS() {
      return DEFAULTS;
    }

    /**
     * Renders either a text or textarea input
     *
     * @param {string} name
     * @param {string} [value=this.options.default]
     * @return {string} rendered input
     */
    input(name, value = '') {

      if (value === this.options.default) {
        value = '';
      }

      return `<div class="input__url"><span>${this.options.prefix || ''}</span><input type="url" name="${name}" placeholder="${Utils.escape(this.options.default)}" value="${Utils.escape(value)}" ${this.htmlAttrs}></div>`;
    }
  }

  return UrlDirective;
};
