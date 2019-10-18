/**
 * Defaults
 *
 * @attrs {number} [min] - Minimum value
 * @attrs {number} [max] - Maximum value
 * @attrs {number} [step] - Step value up or down by this number
 */
const DEFAULTS = {
  attrs: {
    min: undefined,
    max: undefined,
    step: undefined,
  },

  options: {
    range: false,
  },
};

module.exports = (BaseDirective) => {
  /*
   * Number
   */
  class NumberDirective extends BaseDirective {
    /**
     * @static
     *
     * @return {Object} default attrs and options
     */
    static get DEFAULTS() {
      return DEFAULTS;
    }

    /**
     * Renders either a number
     *
     * @param {string} name
     * @param {string} [value=this.options.default]
     * @return {string} rendered input
     */
    input(name, value = this.options.default) {
      const type = this.options.range ? 'range' : 'number';
      const label = this.options.range ? `<div class="ui left pointing basic label">${value || '—'}</div>` : '';

      return `<input type="${type}" name="${name}" value="${value}" ${this.htmlAttrs}>${label}`;
    }

    /**
     * Convert strings to numbers
     *
     * @param {string} value
     * @return {number}
     */
    /* eslint-disable class-methods-use-this */
    serialize(value) {
      return Number(value);
    }
    /* eslint-enable class-methods-use-this */
  }

  return NumberDirective;
};
