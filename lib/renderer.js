const fs = require('fs');
const { resolve } = require('path');

const glob = require('glob');
const Boom = require('boom');

const Logger = require('./logger');
const { getDashboardPaths } = require('./paths');
const services = require('./services');
const Template = require('./template');
const Utils = require('./utils');

const { views: viewsPath } = getDashboardPaths();

/**
 *
 * Renders content into site template
 *
 * @param {string} uriPath
 * @return {string} rendered HTML
 *
 * @todo Use Promise.all when fetching content
 */
exports.renderContent = async function renderContent(uriPath) {
  const pathAnalyzer = new services.UriPathAnalyzer(uriPath, this.paths.www);
  const [file, pathSection, pathRecordId] = pathAnalyzer.perform();
  const content = {};
  const { Section } = this.db.models;

  if (!file) {
    throw Boom.notFound('Template not found');
  }

  const partials = glob.sync(resolve(this.paths.www, '_*.html'));
  const template = Template.fromFile(file, partials, { parseConditionals: true });
  const tree = template.parse();

  /* eslint-disable no-restricted-syntax */
  for (const [token, args] of Object.entries(tree)) {
    const recordId = pathSection === args.name ? pathRecordId : null;
    /* eslint-disable-next-line no-await-in-loop */
    let recordContent = await Section.contentFor(args, recordId);

    if (this.config.placeholders) {
      recordContent = _addPlaceholders(recordContent, args, this.db);
    }

    content[token] = recordContent;
  }
  /* eslint-enable no-restricted-syntax */

  return template.render(content);
};

/**
 *
 * Renders error, first by looking in the site directory,
 * then falling back to Vapid own error template.
 *
 * @param {Error} err
 * @param {Object} request
 * @return {[status, rendered]} HTTP status code, and rendered HTML
 */
exports.renderError = function renderError(err, request) {
  const error = Boom.boomify(err);
  let status = error.output.statusCode;
  let rendered;
  let errorFile;

  if (this.isDev && status !== 404) {
    errorFile = resolve(viewsPath, 'errors', 'trace.html');
    rendered = Template.fromFile(errorFile).render({
      error: {
        status,
        title: error.output.payload.error,
        message: error.message,
        stack: error.stack,
      },
      request,
    });
  } else {
    const siteFile = resolve(this.paths.www, '_error.html');
    status = status === 404 ? 404 : 500;
    errorFile = status === 404 && fs.existsSync(siteFile) ? siteFile : resolve(viewsPath, 'errors', `${status}.html`);
    rendered = fs.readFileSync(errorFile, 'utf-8');
  }

  if (status !== 404) {
    Logger.extra(error.stack);
  }

  return [status, rendered];
};

/**
 * @private
 *
 * Adds placeholders if no content is present
 *
 * @param {Object} content
 * @param {Object} section
 * @return {Object} content containing placeholders
 */
function _addPlaceholders(content, section, db) {
  const { Section, Record } = db.models;
  const prefix = section.name !== Section.DEFAULT_NAME ? `${section.name}::` : '';

  if (content.length === 0) {
    const placeholders = Utils.reduce(section.fields, (memo, params, token) => {
      if (!Utils.has(Record.SPECIAL_FIELDS, params.name)) {
        /* eslint-disable-next-line no-param-reassign */
        memo[token] = `{{${prefix}${params.name}}}`;
      }
      return memo;
    }, {});
    content.push(placeholders);
  } else if (section.keyword !== 'form') {
    Utils.each(content, (record) => {
      Utils.each(record, (value, key) => {
        const { name } = section.fields[key];

        if (Utils.isEmpty(value) && name) {
          /* eslint-disable-next-line no-param-reassign */
          record[key] = `{{${prefix}${name}}}`;
        }
      });
    });
  }

  return content;
}
