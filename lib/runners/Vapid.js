const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');

const Database = require('../Database');
const Generator = require('../generator');
const { Paths, Utils } = require('../utils');

/**
 * This is the main class that powers Vapid projects.
 * It fetches projected environment variables, configuration options,
 * project paths and data storage information. Project runners, like
 * `VapidBuilder` or `VapidServer`, may extend this base class to easily
 * access project configuration and structure data.
 */
class Vapid {
  /**
   * This module works in conjunction with a site directory.
   *
   * @param {string} cwd - path to site
   * @return {Vapid}
   */
  constructor(cwd) {
    // User-defined options
    /* eslint-disable-next-line import/no-dynamic-require, global-require */
    const { vapid: options = {}, name } = require(path.resolve(cwd, 'package.json'));

    _loadEnv(cwd);

    this.name = name;
    this.env = process.env.NODE_ENV || 'development'; // Used by cli.js
    this.isDev = (this.env === 'development' || this.env === 'test');
    this.config = Utils.merge({}, _defaults.call(this), options);
    this.paths = Paths.getProjectPaths(cwd, this.config.dataPath);
    this.db = _db(this.config.database, this.paths.data, this.paths.www);
  }
}

/**
 * @private
 *
 * Default options
 *
 * @return {Object}
 */
function _defaults() {
  return {
    cache: !this.isDev,
    database: {
      dialect: 'sqlite',
      logging: false,
    },
    dataPath: './data',
    liveReload: this.isDev,
    placeholders: this.isDev,
    port: process.env.PORT || 3000,
  };
}

/**
 * @private
 *
 * Loads ENV via dotenv
 *
 * @param {string} cwd
 */
function _loadEnv(cwd) {
  const envPath = path.resolve(cwd, '.env');

  if (!process.env.SECRET_KEY && !fs.existsSync(envPath)) {
    Generator.copyEnv(cwd);
  }

  dotenv.config({ path: envPath });
}

/**
 * @private
 *
 * Instantiates the database
 *
 * @param {Object} dbConfig - database config
 * @param {string} dataPath - data directory
 * @param {string | undefined} templatesPath - templates directory
 * @return {Database} a new database instance
 */
function _db(dbConfig, dataPath, templatesPath) {
  if (dbConfig.dialect === 'sqlite') {
    /* eslint-disable-next-line no-param-reassign */
    dbConfig.storage = path.resolve(dataPath, 'vapid.sqlite');
  }

  dbConfig.templatesPath = templatesPath;

  return new Database(dbConfig);
}

module.exports = Vapid;
