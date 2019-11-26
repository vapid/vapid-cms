const path = require('path');
const Sequelize = require('sequelize');
const Umzug = require('umzug');
const { Utils } = require('../utils');

const Builder = require('./Builder');
const RecordModel = require('./models/Record');
const TemplateModel = require('./models/Template');

/**
 * @private
 *
 * Define the ORM models and associations
 *
 * @return {{Template, Record, User}} instantiated database models
 */
function _defineModels() {
  const Template = TemplateModel.init(this.sequelize, Sequelize, this.config);
  const Record = RecordModel.init(this.sequelize, Sequelize, this.config);
  const User = this.sequelize.import('./models/User');

  Template.RecordRel = Template.hasMany(Record, {
    as: 'records',
    foreignKey: 'template_id',
  });
  Template.Record = Record;

  Record.TemplateRel = Record.belongsTo(Template, {
    as: 'template',
    foreignKey: 'template_id',
  });
  Record.Template = Template;

  return {
    Template,
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
    this.builder = config.templatesPath ? new Builder(config.templatesPath) : null;
  }

  /**
   * Run pending migrations
   */
  async connect() {
    const { Template, Record } = this.models;
    await this.migrations.up();

    // Ensure we have at least one index page record.
    const indexTemplate = await Template.findIndex();
    await Record.findOrCreate({ where: { template_id: indexTemplate.id }, validate: false });

    // Ensure we have at least once general settings record.
    const generalTemplate = await Template.findGeneral();
    await Record.findOrCreate({ where: { template_id: generalTemplate.id }, validate: false });

    if (!this.builder) { return; }
    await this.builder.init(Template);
  }

  /**
   * Safely close the DB connection
   */
  async disconnect() {
    await this.sequelize.close();
  }

  async rebuild() {
    if (!this.builder) { return; }
    await this.builder.build(this.models.Template);
  }

  /**
   * Determines if tree has changed since last build
   *
   * @todo Cache so this isn't as taxing on the load time
   */
  get isDirty() {
    if (!this.builder) { return false; }
    return this.builder.isDirty;
  }
}

module.exports = Database;
