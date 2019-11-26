const fs = require('fs');
const {
  join,
  parse,
  relative,
  resolve,
} = require('path');

const glob = require('glob');
const Boom = require('@hapi/boom');

const TemplateCompiler = require('../TemplateCompiler');
const { Logger, Paths } = require('../utils');

const { helper } = require('../directives');

const { views: viewsPath } = Paths.getDashboardPaths();

async function makeHelpers(record, template, pages) {
  const { fields } = template;
  const { content } = record.dataValues;
  const out = {};
  record.template = template // Required for permalink getter
  for (const key of Object.keys(content)) {
    out[key] = helper(content[key], fields[key], pages);
  }

  // TODO: There needs to be a better way to deliver block scoped data to the runtime.
  out.__data__ = {
    permalink: record.permalink,
  };

  return out;
}

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
  // const content = {};
  const { Template, Record } = this.db.models;

  const record = await Paths.getRecordFromPath(uriPath.slice(1), this.db);

  if (!record) {
    throw Boom.notFound('Record not found');
  }

  const template = record.template || await record.getTemplate();
  const templateName = template.name;
  let pagePath = null;
  if (template.type === 'page') {
    const htmlFile = join(this.paths.www, `${templateName}.html`);
    const dirFile = join(this.paths.www, templateName, 'index.html');
    pagePath = (fs.existsSync(htmlFile) && htmlFile) || (fs.existsSync(dirFile) && dirFile) || null;
  } else if (template.type === 'collection') {
    const partial = join(this.paths.www, `_${templateName}.html`);
    const collection = join(this.paths.www, `collections/${templateName}.html`);
    pagePath = (fs.existsSync(collection) && collection) || (fs.existsSync(partial) && partial) || null;
  }

  if (!pagePath) {
    throw Boom.notFound('Template file not found');
  }

  const partials = {};
  for (const partial of glob.sync(resolve(this.paths.www, '**/_*.html'))) {
    const desc = parse(partial);
    const name = join(relative(this.paths.www, desc.dir), desc.name.slice(1));
    partials[name] = fs.readFileSync(partial, 'utf8');
  }

  const compiler = new TemplateCompiler(partials);
  const {
    name,
    type,
    data,
    ast,
  } = compiler.parseFile(pagePath);

  // Fetch all renderable pages.
  const pages = await Record.getPages(uriPath);

  // Generate our navigation menu.
  const navigation = [];
  for (const page of pages) {
    if (!page.isNavigation) { continue; }
    navigation.push(page);
  }

  // Create our page context data.
  const pageData = await makeHelpers(record, template, { pages });
  const context = {};
  for (const key of Object.keys(pageData)) {
    context[key] = pageData[key];
  }

  /* eslint-disable no-await-in-loop */
  for (const model of Object.values(data)) {

    // Fetch all templates where the type and model name match.
    const templates = (await Template.findAll({
      where: { type: model.type, name: model.name },
      include: 'records',
    })) || [];

    const records = await Promise.all(templates.map(t => t.records.map(r => makeHelpers(r, t, { pages }))).flat());

    const firstRecord = records[0] || {};

    context[model.name] = (model.type === 'collection') ? records : firstRecord;
  }
  /* eslint-enable no-await-in-loop */
  return compiler.render(name, type, ast, context, { permalink: uriPath, navigation });
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
    rendered = new TemplateCompiler().renderFile(errorFile, {
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
