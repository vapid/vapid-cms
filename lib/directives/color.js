const DEFAULTS = {
  attrs: {},
  options: {},
};

module.exports = (BaseDirective) => {
  /*
   * Color Input
   */
  class TextDirective extends BaseDirective {
    /**
     * @static
     *
     * @return {Object} default attrs and options
     */
    static get DEFAULTS() { return DEFAULTS; }

    /**
     * Renders either a text or textarea input
     *
     * @param {string} name
     * @param {string} [value=this.options.default]
     * @return {string} rendered input
     */
    input(name, value = '') {
      return `<input type=color name="${name}" value="${value || this.options.default}" ${this.htmlAttrs}>`;
    }
  }

  return TextDirective;
};
