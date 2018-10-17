const _ = require('lodash');
const fs = require('fs');
const ejs = require('ejs');
const { extname, join, dirname } = require('path');
const checksum = require('md5-file');
const mkdirp = require('mkdirp');
const pluralize = require('pluralize');

const Utils = _;

/**
 * Helper functions, mostly an extension of Lodash
 */
Object.assign(Utils, {
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
    try {
      return JSON.parse(val);
    } catch (err) {
      return val;
    }
  },

  /**
   * Tests to see if the string is pluralized
   *
   * @param {string} str
   * @return {boolean}
   */
  isPlural: pluralize.isPlural,

  /**
   * Create new directories recursively
   *
   * @param {string} path
   * @return {string} err - an error if necessary
   */
  mkdirp: mkdirp.sync,

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

    this.mkdirp(dirname(to));

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

    this.mkdirp(to);

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
   * Pascal Case
   *
   * @param {string}
   * @return {string}
   */
  pascalCase: _.flow(_.camelCase, _.upperFirst),

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
});

module.exports = Utils;
