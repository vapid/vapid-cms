const strftime = require('strftime');
const { Utils } = require('../utils');

/**
 * Defaults
 *
 * @option {string} [format='%B %e, %Y'] - strftime format
 * @option {boolean} [time=false] - ability to specify a time too
 */
const DEFAULTS = {
  options: {
    format: '%B %e, %Y',
    time: false,
  },
};

module.exports = (BaseDirective) => {
  /**
   * Dates and times
   */
  class DateDirective extends BaseDirective {
    /**
     * @static
     *
     * @return {Object} default attrs and options
     */
    static get DEFAULTS() {
      return DEFAULTS;
    }

    /**
     * Renders either a 'date' or 'datetime-local' input
     *
     * @param {string} name
     * @param {string} value
     * @return {string} rendered input
     */
    input(name, value = '') {
      const type = this.options.time ? 'datetime-local' : 'date';
      return `<input type="${type}" name="${name}" value="${value}" ${this.htmlAttrs}>`;
    }


    /**
     * Parses into a Date object, and formats
     * Formatting options provided via strftime.
     *
     * @param {string} value - a string representation of a date
     * @return {string} formatted date
     */
    render(value) {
      const strftimeUTC = strftime.timezone('0000');
      const date = new Date(`${value} UTC`);
      const utc = new Date(date.getTime());
      let { format } = this.options;

      if (this.options.time && this.options.format === this.constructor.DEFAULTS.options.format) {
        format += ' at %l:%M %p';
      }

      // TODO: Not super excited that I'll have to remember to escape anytime this is overridden
      //       Maybe don't override, and instead universally apply a set of defined "filters"?
      return isNaN(date.getTime()) ? Utils.escape(value) : strftimeUTC(format, utc);
    }
  }

  return DateDirective;
};
