const directives = require('./directives');
const { Utils } = require('./utils');

/**
 * Renders forms, both for the dashboard and user-facing contact forms
 *
 */
class Form {
  /**
   * @static
   *
   * Render an individual form field/input
   *
   * @param {string} name
   * @param {Object} params
   * @param {string} value
   * @param {string} [error]
   * @return {string} rendered HTML
   */
  static field(name, label, params, value, error, meta) {
    const directive = directives.find(params, meta);
    const requiredClass = (directive.attrs.required && !params.default) ? 'required ' : '';
    const errorClass = error ? 'error ' : '';
    const errorMessage = error ? `<small class="error-message" aria-role="alert">${error}</small>` : '';
    const help = params.help ? `<small id="help-${name}" class="help">${params.help}</small>` : '';
    if (params.help) {
      directive.attrs['aria-describedby'] = `help-${name}`;
    }
    const input = directive.input(name, value);

    return `
      <div class="${requiredClass}${errorClass}field field__${params.type || 'text'}">
        <label for="${name}">
          ${params.label || Utils.startCase(label)}
          ${help}
        </label>
        ${input}
        ${errorMessage}
      </div>`;
  }
}

module.exports = Form;
