const unfurl = require('unfurl.js');

/**
 * Defaults
 *
 * @option {boolean} [unfurl=false] - render links as oEmbeds
 */
const DEFAULTS = {
  options: {
    format: 'url',
    unfurl: false,
    default: {
      id: undefined,
      url: '',
      name: '',
      page: undefined,
      isActive: false,
      isNavigation: false,
    },
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
    static get DEFAULTS() { return DEFAULTS; }

    static normalize(value = DEFAULTS.options.default) {
      if (typeof value === 'string') {
        return {
          url: value,
          name: value,
          page: undefined,
          isActive: false,
          isNavigation: false,
        };
      }
      return {
        url: value.url || DEFAULTS.options.default.url,
        name: value.name || '',
        page: +value.page || undefined,
        isActive: value.isActive || DEFAULTS.options.default.isActive,
        isNavigation: value.isNavigation || DEFAULTS.options.default.isNavigation,
      };
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
      const link = LinkDirective.normalize(value);
      let namePlaceholder = link.url || '';
      let selectedPage = null;
      const options = this.meta.pages.reduce((memo, p) => {
        const selected = link.page === p.id ? 'selected' : '';
        const option = `<option value="${p.id}" ${selected}>${p.name}</option>`;
        if (selected) {
          selectedPage = p;
          namePlaceholder = p.name;
        }
        return memo + option;
      }, '');

      return `
        <fieldset class="fieldset" id="${name}">
          <label for="${name}[name]">Text</label>
          <small class="help">Human readable link text</small>
          <input type="text" id="${name}[name]" name="${name}[name]" value="${link.name}" placeholder="${namePlaceholder}">

          <label for="${name}[url]">Link</label>
          <small class="help">The Page or URL to link to</small>
          <select name="${name}[page]" id="${name}[page]" class="${selectedPage ? 'selected' : ''}">
            <option value="">Select a Page</option>
            ${options}
          </select>
          <span>or</span>
          <input type="url" name="${name}[url]" value="${link.url}" placeholder="Enter a URL">
        </fieldset>
      `;
    }

    /**
     * The raw value.
     * Typically, directives escape the value.
     *
     * @param {string} [value=this.options.default]
     * @return {string}
     */
    preview(value = this.options.default) {
      return LinkDirective.normalize(value).url;
    }
    /* eslint-enable class-methods-use-this */

    /**
     * Renders the link, or optionally an oEmbed
     *
     * @param {string} [value=this.options.default]
     * @return {string}
     */
    render(value = this.options.default) {
      let link = LinkDirective.normalize(value);

      if (link.url && this.options.unfurl) {
        return _oembed(link.url);
      }

      if (link.page !== undefined) {
        const { name } = link;
        link = this.meta.pages.find(p => p.id === link.page);
        // If they've provided an explicit name value, use it instead of the page name.
        link = { ...link, name: name || link.name };
      }

      return {
        ...link,
        name: link.name || link.url,
        // When used as a bare handlebars mustache, we just print the URL.
        toString() { return link.url; },
      };
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
