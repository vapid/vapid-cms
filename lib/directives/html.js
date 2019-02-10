const markdown = require('markdown-it');
const sanitizeHtml = require('sanitize-html');
const Utils = require('../utils');

/**
 * Defaults
 *
 * @option {string|boolean} [editor='wysiwyg'] - determines the input type
 */
const DEFAULTS = {
  options: {
    editor: 'wysiwyg',
    images: false,
  },
};

module.exports = (BaseDirective) => {
  /*
   * HTML and/or Markdown
   */
  class HTMLDirective extends BaseDirective {
    /**
     * @static
     *
     * @return {Object} default attrs and options
     */
    static get DEFAULTS() {
      return DEFAULTS;
    }

    /**
     * Returns a Trix or ACE editor, depending on the options
     *
     * @param {string} name
     * @param {string} [value='']
     * @return rendered input
     */
    input(name, value = this.options.default) {
      // TODO: Maybe a help link to a Markdown cheat sheet?
      switch (this.options.editor) {
        case 'wysiwyg':
          return `
            <div class="wysiwyg" data-images="${this.options.images}">${value}</div>
            <input id="${name}" type="hidden" name="${name}" value="${Utils.escape(value)}">`;
        default:
          return `
            <div class="ace_editor"></div>
            <textarea name="${name}">${value}</textarea>`;
      }
    }

    /**
     * Renders HTML
     * Allows Markdown if given the option
     *
     * @param {string} value
     * @return {string} rendered HTML
     */
    render(value = this.options.default) {
      switch (this.options.editor) {
        case 'wysiwyg':
          return value.replace('<p><br></p>', '');
        case 'markdown':
          return markdown({
            html: true,
            breaks: true,
          }).render(value);
        default:
          return value;
      }
    }

    /**
     * Strips HTML out for simple preview
     *
     * @param {string} value
     * @return {string} plain text
     */
    preview(value) {
      const dirty = this.render(value);
      return sanitizeHtml(dirty, { allowedTags: [] });
    }
  }

  return HTMLDirective;
};
