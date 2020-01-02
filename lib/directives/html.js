const markdown = require('markdown-it');
const sanitizeHtml = require('sanitize-html');
const { Utils } = require('../utils');

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

const ICONS = {
  hr: '<svg width="25px" height="25px"><g fill-rule="evenodd"><path d="M8.45 12H5.3c-.247 0-.45.224-.45.5 0 .274.203.5.45.5h5.4c.247 0 .45-.226.45-.5 0-.276-.203-.5-.45-.5H8.45z"></path><path d="M17.45 12H14.3c-.247 0-.45.224-.45.5 0 .274.203.5.45.5h5.4c.248 0 .45-.226.45-.5 0-.276-.202-.5-.45-.5h-2.25z"></path></g></svg>',
  img: '<svg width="25px" height="25px"><g fill-rule="evenodd"><path d="M4.042 17.05V8.857c0-1.088.842-1.85 1.935-1.85H8.43C8.867 6.262 9.243 5 9.6 5.01L15.405 5c.303 0 .755 1.322 1.177 2 0 .077 2.493 0 2.493 0 1.094 0 1.967.763 1.967 1.85v8.194c-.002 1.09-.873 1.943-1.967 1.943H5.977c-1.093.007-1.935-.85-1.935-1.937zm2.173-9.046c-.626 0-1.173.547-1.173 1.173v7.686c0 .625.547 1.146 1.173 1.146h12.683c.625 0 1.144-.53 1.144-1.15V9.173c0-.626-.52-1.173-1.144-1.173h-3.025c-.24-.63-.73-1.92-.873-2 0 0-5.052.006-5 0-.212.106-.87 2-.87 2l-2.915.003z"></path><path d="M12.484 15.977a3.474 3.474 0 0 1-3.488-3.49A3.473 3.473 0 0 1 12.484 9a3.474 3.474 0 0 1 3.488 3.488c0 1.94-1.55 3.49-3.488 3.49zm0-6.08c-1.407 0-2.59 1.183-2.59 2.59 0 1.408 1.183 2.593 2.59 2.593 1.407 0 2.59-1.185 2.59-2.592 0-1.406-1.183-2.592-2.59-2.592z"></path></g></svg>',
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
            <ul class="wysiwyg-blocks" tabindex="-1">
              <li><a href="#" class="wysiwyg-blocks__block wysiwyg-blocks__block--img">Image${ICONS.img}</a></li>
              <li><a href="#" class="wysiwyg-blocks__block wysiwyg-blocks__block--hr">Divider${ICONS.hr}</a></li>
            </ul>
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
