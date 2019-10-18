/**
 * Defaults
 *
 * @option {string} [input] - override what type of input is used
 * @option {boolean} [multiple=false] - for multi-select dropdowns
 * @options {string} [options=''] - choices available to the user
 */
const DEFAULTS = {
  options: {
    input: undefined,
    multiple: false,
    options: '',
  },
};

/**
 * Available input types
 * See _determineInputType()
 */
const INPUT_TYPES = {
  'checkbox': 1,
  'toggle': 1,
  'radio': 1,
  'dropdown': 1,
};

module.exports = (BaseDirective) => {
  /**
   * Provides a away to choose from one or more options
   * e.g. checkbox, radio toggle, dropdown, or multi-select
   * Contains its own logic to help determine what input type is most appropriate
   */
  class ChoiceDirective extends BaseDirective {
    /**
     * @param {Object} params
     */
    constructor(params) {
      super(params);
      this.possibilities = _possibilites(this.options.options);
      this.options.input = _determineInputType.call(this);
      this.attrs.required = this.possibilities.length > 1 && this.attrs.required;
    }

    /**
     * @static
     *
     * @return {Object} default attrs and options
     */
    static get DEFAULTS() {
      return DEFAULTS;
    }

    /**
     * Renders the appropritate input, given the possible choices,
     * and what options have been passed in.
     *
     * @param {string} name
     * @param {string} [value=this.options.default]
     * @return {string} rendered input
     *
     * @todo This is nasty
     */
    input(name, value = this.options.default) {
      if (this.options.input === 'dropdown') {
        return this._dropdown(name, value);
      } else if (this.possibilities <= 1) {
        return this._checkbox(name, value, true);
      }

      return this.possibilities.reduce((memo, p) => memo + this._checkbox(name, value, p, p), '');
    }

    /**
     * Renders value(s) into a comma-separated, spaced string
     *
     * @param {array|string} [value=this.options.default]
     * @return {string}
     *
     * @todo Maybe an option to render something other than a comma-separated string?
     */
    /* eslint-disable class-methods-use-this */
    render(value = this.options.default) {
      return Array.isArray(value) ? value.join(', ') : value;
    }
    /* eslint-enable class-methods-use-this */

    /**
     * Helps print the HTML attribute for a required field
     *
     * @return {string}
     */
    get required() {
      return this.attrs.required ? 'required=true' : '';
    }

    /**
     * @private
     *
     * Renders checkbox, toggle, or radio input(s)
     * Based on Semantic UI markup and classes
     *
     * @param {string} name
     * @param {string} value - the value from the database
     * @param {string} inputValue - the value used in the input field
     * @param {string} [label='']
     * @return {string} rendered HTML
     */
    _checkbox(name, value, inputValue, label = '') {
      const klass = this.options.input === 'checkbox' ? '' : this.options.input;
      const type = this.options.input === 'toggle' ? 'checkbox' : this.options.input;
      const checked = (type === 'checkbox' && value) || (value && value === label) ? 'checked' : '';

      return `
        <div class="ui ${klass} checkbox">
          <input type="${type}" name="${name}" value="${inputValue}" ${checked} ${this.required}>
          <label>${label}</label>
        </div>`;
    }

    /**
     * @private
     *
     * Renders a dropdown select menu
     * Based on Semantic UI markup
     *
     * @param {string} name
     * @param {string} [value='']
     * @return {string} rendered HTML
     */
    _dropdown(name, value = '') {
      const { placeholder } = this.attrs;
      const multiple = this.options.multiple ? 'multiple' : '';
      const values = Array.isArray(value) ? value : value.split(',');

      const options = this.possibilities.reduce((memo, p) => {
        const selected = !!~values.indexOf(p) ? 'selected' : '';
        const option = `<option value="${p}" ${selected}>${p}</option>`;
        return memo + option;
      }, '');

      return `
        <select name="${name}" class="ui dropdown" ${multiple} ${this.required}>
          <option value="">${placeholder}</option>
          ${options}
        </select>`;
    }
  }

  /**
   * @private
   *
   * Turns a comma-separated list of choices into an array
   *
   * @param {string} str
   * @return {array}
   *
   * @todo Needs a better parser that takes into account quotes, escaped chars etc
   */
  function _possibilites(str='') {
    return str.split(',').map(p => p.trim()).filter(Boolean);
  }

  /**
   * @private
   *
   * Logic for determining what type of input should be used
   * Based on number of choices, and user-specific options
   *
   * @return {string} input type
   */
  function _determineInputType() {
    let input = INPUT_TYPES[this.options.input] ? this.options.input : null;
    const numPossibilities = this.possibilities.length;


    if (numPossibilities <= 1) {
      return input === 'toggle' ? 'toggle' : 'checkbox';
    } else if (this.options.multiple) {
      return 'dropdown';
    }

    // If we've gotten this far, radio and dropdown are the only options
    input = (input === 'radio' || input === 'dropdown') ? input : null;

    if (numPossibilities <= 3 && !this.options.multiple) {
      return input || 'radio';
    }

    return input || 'dropdown';
  }

  return ChoiceDirective;
};
