const { Utils } = require('../utils');
const sizeOf = require('image-size');
const fs = require('fs');
const path = require('path');

/**
 * Defaults
 *
 * @attr {string} [class=''] - <img> class attribute
 * @attr {string} [alt=''] - <img> alt attribute
 * @options {boolean} [tag=true] - render <img> or return raw src
 */
const DEFAULTS = {
  attrs: {
    class: '',
    alt: '',
    width: '',
    height: '',
  },
  options: {
    tag: true,
    default: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  },
};

module.exports = (BaseDirective) => {
  /*
   * Upload and render images
   */
  class ImageDirective extends BaseDirective {
    /**
     * @static
     *
     * @return {Object} default attrs and options
     */
    static get DEFAULTS() {
      return DEFAULTS;
    }

    static normalize(value = DEFAULTS.options.default) {
      if (typeof value === 'string') {
        return {
          src: value,
          width: 1,
          height: 1,
          type: 'gif',
          aspectRatio: 1,
        };
      }
      return {
        src: value.src,
        width: value.width,
        height: value.height,
        type: value.type,
        aspectRatio: value.aspectRatio,
      };
    }

    /**
     * Renders inputs necessary to upload, preview, and optionally remove images
     *
     * @param {string} name
     * @param {string} [value=this.options.default]
     * @return {string} rendered HTML
     *
     * eslint-disable class-methods-use-this
     */
    input(name, value = '') {
      const inputs = `<input type="file" name="${name}" accept="image/*" >
                    <input type="hidden" name="${name}" value="${value}">`;
      const src = value ? `/uploads/${value}` : '';
      const preview = `<img class="preview" src="${src}" id="${name}">`;
      const destroyName = name.replace('content', '_destroy');
      const destroy = !this.attrs.required
        ? `<div class="ui checkbox">
             <input type="checkbox" name="${destroyName}" id="${destroyName}">
             <label for="${destroyName}">Remove</label>
           </div>`
        : '';

      return `
        <div class="previewable">
          ${inputs}
          ${preview}
          ${destroy}
          <button id="edit-image-button" data-name="${name}">Edit</button>
        </div>`;
    }
    /* eslint-enable class-methods-use-this */

    /**
     * Renders <img> tag or raw src
     *
     * @param {string} fileName
     * @return {string}
     */
    render(fileName) {
      const src = fileName
        ? `/uploads/${fileName}${this._queryString}`
        : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

      const onDisk = fileName ? path.join(process.cwd(), 'data/uploads', fileName) : null;
      const size = (onDisk && fs.existsSync(onDisk) && sizeOf(onDisk)) || { width: 1, height: 1, type: 'gif' };

      return {
        src,
        width: size.width,
        height: size.height,
        type: size.type,
        aspectRatio: size.height / size.width,
        toString: () => (src && this.options.tag) ? `<img src="${src}" ${this._tagAttrs}>` : src,
      };
    }

    /**
     * A preview of the image
     *
     * @param {string} fileName
     * @return {string}
     */
    preview(fileName) {
      // Always render a tag
      this.options.tag = true;
      return this.render(fileName);
    }

    /**
     * @private
     *
     * Converts attrs to img tag attrs
     *
     * @return {string}
     */
    get _tagAttrs() {
      return Object.keys(this.attrs)
        .map((key) => {
          const val = this.attrs[key];
          return val && `${key}="${Utils.escape(val)}"`;
        })
        .filter(Boolean)
        .join(' ');
    }

    /**
     * @private
     *
     * Converts width/height to a query string
     *
     * @return {string}
     */
    get _queryString() {
      const qs = (['width', 'height'])
        .map((key) => {
          const val = this.attrs[key];
          return val && `${key[0]}=${Number(val)}`;
        })
        .filter(Boolean)
        .join('&');
      return qs ? `?${qs}` : '';
    }
  }

  return ImageDirective;
};
