const path = require('path');

const Boom = require('boom');

const Utils = require('./utils');

/**
 *
 * Resolves commonly-used project paths
 *
 * @param {string} cwd
 * @param {string} dataPath - data directory
 * @return {Object} absolute paths
 */
exports.getProjectPaths = function getProjectPaths(cwd, dataPath) {
  const paths = Utils.assignWith({}, {
    root: '.',
    data: dataPath,
    uploads: path.join(dataPath, 'uploads'),
    www: './www',
    modules: './node_modules',
  }, (_, srcPath) => path.resolve(cwd, srcPath));

  // Ensure paths exist
  Utils.mkdirp(paths.uploads);
  Utils.mkdirp(paths.www);

  return paths;
};

/**
 * Resolves commonly-used dashboard paths.
 * @return {Object} absolute paths
 */
exports.getDashboardPaths = function getDashboardPaths() {
  const paths = {
    assets: path.resolve(__dirname, '../assets'),
    views: path.resolve(__dirname, '../views'),
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

  if (Utils.includes(['', '.html'], ext)) {
    return false;
  } else if (Utils.includes(['.scss', '.sass'], ext)) {
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

  if (Utils.includes(['_', '.'], char)) {
    throw Boom.notFound('Filenames starting with an underscore or period are private, and cannot be served.');
  }
};
