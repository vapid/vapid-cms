const path = require('path');
const Boom = require('@hapi/boom');
const mkdirp = require('mkdirp');
const Sequelize = require('sequelize');

const { Op } = Sequelize;

const HTML_FILE_EXTS = { '': 1, '.html': 1 };
const SASS_FILE_EXTS = { '.scss': 1, '.sass': 1 };

/**
 *
 * Get the absolute path to Vapid's install location
 *
 * @return {Object} The absolute path to this module's root.
 */
exports.packageRoot = () => path.resolve(__dirname, '../..');

/**
 *
 * Resolves commonly-used project paths
 *
 * @param {string} cwd
 * @param {string} dataPath - data directory
 * @return {Object} absolute paths
 */
exports.getProjectPaths = function getProjectPaths(cwd, dataPath) {
  const paths = {
    pjson: path.resolve(cwd, 'package.json'),
    root: path.resolve(cwd, '.'),
    data: path.resolve(cwd, dataPath),
    cache: path.resolve(cwd, path.join(dataPath, 'cache')),
    uploads: path.resolve(cwd, path.join(dataPath, 'uploads')),
    www: path.resolve(cwd, './www'),
    modules: path.resolve(cwd, './node_modules'),
  };

  // Ensure paths exist
  mkdirp.sync(paths.uploads);
  mkdirp.sync(paths.www);

  return paths;
};

/**
 * Resolves commonly-used dashboard paths.
 * @return {Object} absolute paths
 */
exports.getDashboardPaths = function getDashboardPaths() {
  const paths = {
    assets: path.resolve(__dirname, '../../assets'),
    views: path.resolve(__dirname, '../../views'),
  };

  return paths;
};

/**
 * Validates if a given path is a template partial.
 *
 * @param {string} path
 * @returns {boolean} True or false if path is a template partial.
 */
exports.isTemplatePartial = function isTemplatePartial(filePath) {
  const ext = path.extname(filePath);
  const name = path.basename(filePath);
  return ext === '.html' && name[0] === '_';
};

/**
 * Validates that a given path is a valid asset path. HTML and s[c|a]ss files are excluded.
 * TODO: Its weird that this will return a string for the human readable error. Fix it.
 *
 * @param {string} path
 * @returns {boolean | string} Will return a string if there is a human readable error.
 */
exports.isAssetPath = function isAssetPath(filePath) {
  const ext = path.extname(filePath);

  if (HTML_FILE_EXTS[ext] || filePath.match(/.pack\.[js|scss|sass]/)) {
    return false;
  } else if (SASS_FILE_EXTS[ext]) {
    const suggestion = filePath.replace(/\.(scss|sass)$/, '.css');
    return `Sass files cannot be served. Use "${suggestion}" instead.`;
  }

  return true;
};


/**
 * Asserts that a given path is a public asset path. Throws if is private.
 *
 * @param {string} path
 */
exports.assertPublicPath = function assertPublicPath(filePath) {
  const fileName = path.basename(filePath);
  const char = fileName.slice(0, 1);

  if (char === '_' || char === '.') {
    throw Boom.notFound('Filenames starting with an underscore or period are private, and cannot be served.');
  }
};

exports.getRecordFromPath = async function getRecordFromPath(permalink, db) {
  const { Record, Template } = db.models;
  let type;
  let id;
  let collection;
  let name;
  let template;

  // If we have an exact match, opt for that.
  const record = await Record.findOne({ where: { slug: permalink }, include: ['template'] });
  if (record) { return record; }

  if (permalink.includes('/')) {
    type = 'collection';
    const segments = permalink.split('/');
    collection = segments.shift();
    const slug = segments.join('/');
    template = await Template.findOne({ where: { type, name: collection } });
    if (!template) { return null; }

    // Try to get the plain old slug value if it exists.
    template.records = await template.getRecords(slug ? { where: { slug } } : {});
    if (template.records.length) { return template.records[0]; }

    // Otherwise, this must be a {template_name}-{record_id} slug. Grab the ID.
    id = slug.split('-').pop();

  } else {
    type = 'page';
    collection = null;
    const parts = permalink.split('-');
    id = parts.length > 1 ? parts.pop() : null;
    name = parts.join('-') || 'index';
    template = await Template.findOne({ where: { type, name }, order: [['id', 'ASC']] });
    if (!template) { return null; }
  }

  // TODO: This seems to be the only way to get the defaultScope/ordering to work
  template.records = await template.getRecords(id ? { where: { id } } : {});
  return template.records[0] || null;

};
