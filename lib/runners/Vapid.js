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
   * @param {boolean} isProd - force a production environment
   * @return {Vapid}
   */
  constructor(cwd, isProd = false) {
    // User-defined options
    /* eslint-disable-next-line import/no-dynamic-require, global-require */
    const { vapid: options = {}, name, homepage } = require(path.resolve(cwd, 'package.json'));

    _loadEnv(cwd);

    this.name = options.name || name;
    this.env = isProd ? 'production' : process.env.NODE_ENV || 'development'; // Used by cli.js
    this.isDev = (this.env === 'development' || this.env === 'test');
    this.config = Utils.merge({}, _defaults.call(this), options);
    this.url = this.isDev ? `localhost:${this.config.port}` : (options.url || homepage);
    this.prodUrl = options.url || homepage;
    this.paths = Paths.getProjectPaths(cwd, this.config.dataPath);

    // Initialize database.
    const dbConfig = this.config.database;
    if (dbConfig.dialect === 'sqlite') {
      dbConfig.storage = path.resolve(this.paths.data, 'vapid.sqlite');
    }
    dbConfig.templatesPath = this.paths.www;
    this.db = new Database(dbConfig);
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

module.exports = Vapid;
