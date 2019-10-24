const path = require('path');
const Sequelize = require('sequelize');
const Umzug = require('umzug');
const Utils = require('./utils');

/**
 * Database
 */
class Database {
  /**
   * @param {Object} config
   */
  constructor(config) {
    this.config = Utils.merge({}, config);
    this.sequelize = _initSequelize.call(this);
    this.models = _defineModels.call(this);
    this.migrations = _initMigrations.call(this);
  }

  /**
   * Run pending migrations
   */
  async connect() {
    await this.migrations.up();
  }

  /**
   * Safely close the DB connection
   */
  async disconnect() {
    await this.sequelize.close();
  }
}

/**
 * @private
 *
 * Define the ORM models and associations
 *
 * @return {{Section, Record, User}} instantiated database models
 */
function _defineModels() {
  const Section = this.sequelize.import('./models/section');
  const Record = this.sequelize.import('./models/record');
  const User = this.sequelize.import('./models/user');

  Section.hasMany(Record, { as: 'records' });
  Record.belongsTo(Section, { as: 'section' });

  return {
    Section,
    Record,
    User,
  };
}

/**
 * @private
 *
 * Initializes Sequelize ORM
 *
 * @return {Sequelize}
 */
function _initSequelize() {
  if (process.env.DATABASE_URL) {
    const dbURL = process.env.DATABASE_URL;
    const dialect = dbURL.split(':')[0];
    const config = Utils.merge(this.config, { dialect });

    return new Sequelize(dbURL, config);
  }

  return new Sequelize(this.config);
}

/**
 * @private
 *
 * Setup migrations
 */
function _initMigrations() {
  return new Umzug({
    storage: 'sequelize',
    storageOptions: {
      sequelize: this.sequelize,
    },
    migrations: {
      params: [this.sequelize.getQueryInterface(), Sequelize],
      path: path.join(__dirname, 'migrations'),
      pattern: /\.js$/,
    },
  });
}

module.exports = Database;
