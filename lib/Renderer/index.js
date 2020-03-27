const fs = require('fs');
const { resolve } = require('path');

const glob = require('glob');
const Boom = require('@hapi/boom');

const services = require('../services');
const TemplateCompiler = require('../TemplateCompiler');
const { Logger, Paths, Utils } = require('../utils');

const { views: viewsPath } = Paths.getDashboardPaths();

/**
 *
 * Renders content into site template
 *
 * @param {string} uriPath
 * @param {string} extension
 * @return {string} rendered HTML
 *
 * @todo Use Promise.all when fetching content
 */
exports.renderContent = async function renderContent(uriPath, extension) {
  const content = {};
  const { Section } = this.db.models;
  const pathAnalyzer = new services.UriPathAnalyzer(uriPath, extension, this.paths.www);
  const [file, pathSection, pathRecordId] = pathAnalyzer.perform();

  if (!file) {
    throw Boom.notFound('Template not found');
  }

  const partials = glob.sync(resolve(this.paths.www, '**/_*.html'));
  const template = TemplateCompiler.fromFile(
    file,
    this.paths.www,
    partials,
  );
  const tree = template.parse();
  const entries = Object.entries(tree);

  const sections = {};
  for (const [, section] of entries) {
    for (const [fieldToken, field] of Object.entries(section.fields)) {
      const ctx = field.context || section.name;
      sections[ctx] = sections[ctx] || {};
      sections[ctx][fieldToken] = field;
    }
    section.fields = sections[section.name];
  }

  for (const [sectionToken, section] of entries) {
    const recordId = pathSection === section.name && section.params.multiple !== 'true'
      ? pathRecordId
      : null;

    /* eslint-disable-next-line no-await-in-loop */
    let recordContent = await Section.contentFor(section, recordId);

    if (this.config.placeholders) {
      recordContent = _addPlaceholders(recordContent, section, this.db);
    }

    content[sectionToken] = recordContent;
  }

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
    rendered = TemplateCompiler.fromFile(errorFile).render({
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

function _getPrefix(Section, field, section) {
  const sectionName = field.context || section.name;
  return sectionName !== Section.DEFAULT_NAME ? `${sectionName}::` : '';
}

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

  if (content.length === 0) {
    const placeholders = Object.entries(section.fields || {}).reduce((memo, [token, params]) => {
      const prefix = _getPrefix(Section, params, section);
      if (!Utils.hasProperty(Record.SPECIAL_FIELDS, params.key)) {
        /* eslint-disable-next-line no-param-reassign */
        memo[token] = `{{${prefix}${params.key}}}`;
      }
      return memo;
    }, {});
    content.push(placeholders);
  } else if (section.keyword !== 'form') {
    for (const record of Object.values(content)) {
      for (const [id, value] of Object.entries(record)) {
        const field = section.fields[id];
        const { key } = field;

        if (Utils.isEmpty(value) && key) {
          const prefix = _getPrefix(Section, field, section);
          /* eslint-disable-next-line no-param-reassign */
          record[id] = `{{${prefix}${key}}}`;
        }
      }
    }
  }

  return content;
}
