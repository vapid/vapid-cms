const fs = require('fs');
const ejs = require('ejs');
const { extname, join, dirname } = require('path');
const checksum = require('md5-file');
const pluralize = require('pluralize');
const mkdirp = require('mkdirp');
const escape = require('lodash.escape');
const merge = require('lodash.merge');

// Ref: https://github.com/30-seconds/30-seconds-of-code
const STR_SPLIT_REG = /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g;

/**
 * Helper functions, mostly an extension of Lodash
 */
const Utils = {

  // The last couple remnants of lodash!
  merge,
  escape,

  /**
   * Simplified isEmpty. Returns `true` for `{}`, `[]`, `""` or `false`.
   *
   * @param {Object | Array | string | boolean} value - value to test
   * @return {boolean}
   */
  isEmpty(value) {
    if (value === null || value === undefined) { return true; }
    if (typeof value === 'boolean') { return !value; }
    if (typeof value === 'string' || Array.isArray(value)) { return !value.length; }
    return !Object.values(value).length;
  },

  // Ref: https://github.com/30-seconds/30-seconds-of-code
  snakeCase: (str) => str && str.match(STR_SPLIT_REG).map((x) => x.toLowerCase()).join('_'),
  kebabCase: (str) => str && str.match(STR_SPLIT_REG).map((x) => x.toLowerCase()).join('-'),
  startCase: (str) => str && str.match(STR_SPLIT_REG).map((x) => x.slice(0, 1).toUpperCase() + x.slice(1)).join(' '),
  camelCase: (str) => {
    const s = str && str.match(STR_SPLIT_REG).map((x) => x.slice(0, 1).toUpperCase() + x.slice(1).toLowerCase()).join('');
    return s.slice(0, 1).toLowerCase() + s.slice(1);
  },

  /**
   * Checks if an object hasOwnProperty.
   *
   * @param {object} obj - Object to test
   * @param {string} key - Key to test
   * @return {boolean}
   */
  hasProperty: (obj, key) => Object.hasOwnProperty.call(obj, key),

  /**
   * Checksums a file
   *
   * @param {string} file - path to file
   * @return {string} checksum
   */
  checksum: checksum.sync,

  /**
   * Attempts to cast value to the correct type
   *
   * @param {string} val
   * @return {string|number|boolean}
   */
  coerceType: (val) => {
    try { return JSON.parse(val); } catch (err) { return val; }
  },


  /**
   * Returns the first matching file found in the supplied paths, if any.
   *
   * @param {string} name
   * @param {array} [paths=[]]
   * @return {string|false}
   */
  findFirst(name, paths = []) {
    for (const p of paths) {
      const filePath = join(p, name);
      if (fs.existsSync(filePath)) { return filePath; }
    }
    return false;
  },

  /**
   * Tests to see if the string is pluralized
   *
   * @param {string} str
   * @return {boolean}
   */
  isPlural: pluralize.isPlural,

  /**
   * An empty function
   */
  noop: () => {},

  /**
   * Pluralizes a word
   *
   * @param {string} word
   * @param {number} count - helps determine what, if any, plural to return
   * @return {string}
   */
  pluralize,

  /**
   * Singularize a word
   *
   * @param {string} word
   * @return {string}
   */
  singularize: function singularize(word) {
    return this.pluralize(word, 1);
  },

  /**
   * Copy a single file
   * and render variables via EJS
   *
   * @param {string} from - the originating path, where to copy from
   * @param {string} to - the destination path, where to copy to
   * @param {Object} data - replacement data for EJS render
   */
  copyFile(from, to, data = {}) {
    // TODO: Should be smarter about how it determines encoding
    const encoding = Utils.isEmpty(data) ? null : 'utf-8';
    let content = fs.readFileSync(from, encoding);
    let toPath = to;

    mkdirp.sync(dirname(to));

    if (extname(from) === '.ejs') {
      toPath = to.replace(/\.ejs$/, '');
      content = ejs.render(content, data);
    }

    fs.writeFileSync(toPath, content, encoding);
  },

  /**
   * Recursively copy files from one directory to another,
   * and render variables via EJS
   *
   * @param {string} from - the originating path, where to copy from
   * @param {string} to - the destination path, where to copy to
   * @param {Object} data - replacement data for EJS render
   */
  copyFiles(from, to, data = {}) {
    const filesToCopy = fs.readdirSync(from);

    mkdirp.sync(to);

    filesToCopy.forEach((file) => {
      const toPath = `${to}/${file}`;
      const fromPath = `${from}/${file}`;
      const stats = fs.statSync(fromPath);

      if (stats.isFile()) {
        this.copyFile(fromPath, toPath, data);
      } else if (stats.isDirectory()) {
        this.copyFiles(fromPath, toPath, data);
      }
    });
  },

  /**
   * Recursively remove a path
   *
   * @param {string} path
   */
  removeFiles(path) {
    fs.readdirSync(path).forEach((file) => {
      const filePath = join(path, file);

      if (fs.lstatSync(filePath).isDirectory()) {
        this.removeFiles(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });

    fs.rmdirSync(path);
  },
};

module.exports = Utils;
