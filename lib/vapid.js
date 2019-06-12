const dotenv = require('dotenv');
const fs = require('fs');
const glob = require('glob');
const http = require('http');
const { join, resolve } = require('path');
const Boom = require('@hapi/boom');
const Koa = require('koa');

const Builder = require('./builder');
const Cache = require('./cache');
const Dashboard = require('./dashboard');
const Database = require('./db');
const Generator = require('./generator');
const Logger = require('./logger');
const Template = require('./template');
const Utils = require('./utils');
const Watcher = require('./watcher');
const middleware = require('./middleware');
const services = require('./services');

const app = new Koa();
const cache = new Cache();

let Section;
let Record;
let User;
let dashboard;

/**
 * This is the main class that powers Vapid.
 * It instantiates most of the classes, and runs the core web server.
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
    const { vapid: options = {}, name: siteName } = require(resolve(cwd, 'package.json'));

    _loadEnv(cwd);

    this.env = process.env.NODE_ENV || 'development'; // Used by cli.js
    this.local = Utils.includes(['test', 'development'], this.env);
    this.config = Utils.merge({}, _defaults.call(this), options);
    this.paths = _paths(cwd, this.config.dataPath);
    this.db = _db(this.config.database, this.paths.data);
    this.builder = new Builder({ Section: this.db.models.Section, templatesDir: this.paths.www });
    this.watcher = this.local && new Watcher(this.paths.www);
    this.liveReload = this.watcher && this.config.liveReload;
    this.buildOnStart = !this.local;

    // Convenience
    ({ Section, Record, User } = this.db.models);

    // Share with dashboard
    dashboard = new Dashboard({
      Section,
      Record,
      User,
      local: this.local,
      builder: this.builder,
      uploadsDir: this.paths.uploads,
      siteName: Utils.startCase(siteName),
      liveReload: this.liveReload,
    });

    // Set secret key
    app.keys = [process.env.SECRET_KEY];

    // Errors
    app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        [ctx.status, ctx.body] = _renderError.call(this, err, ctx.request);

        if (this.liveReload) { _injectLiveReload(ctx, this.config.port); }
      }
    });

    // Middleware
    app.use(middleware.security)
      .use(middleware.session(app))
      .use(middleware.webpack(this.local, [dashboard.paths.assets, this.paths.www], this.paths.modules)) // eslint-disable-line max-len
      .use(middleware.imageProcessing(this.paths))
      .use(middleware.assets(this.paths.uploads, '/uploads'))
      .use(middleware.privateFiles)
      .use(middleware.assets(this.paths.www))
      .use(middleware.assets(dashboard.paths.assets))
      .use(middleware.favicon([this.paths.www, dashboard.paths.assets]))
      .use(middleware.logs)
      .use(dashboard.routes);

    // Main route
    app.use(async (ctx) => {
      const cacheKey = ctx.path;

      ctx.body = this.config.cache
        ? cache.get(cacheKey) || cache.put(cacheKey, await _renderContent.call(this, ctx.path))
        : await _renderContent.call(this, ctx.path);

      if (this.liveReload) { _injectLiveReload(ctx, this.config.port); }
    });
  }

  /**
   * Starts core services (db, watcher, web server)
   * and registers callbacks
   *
   * @listens {server}
   * @listens {watcher}
   * @listens {Record.addHooks}
   */
  async start() {
    cache.clear();
    await this.db.connect();
    await this.builder.init();
    this.server = http.createServer(app.callback());

    // Build if necessary
    if (this.buildOnStart) {
      this.builder.build();
    }

    // If watcher is present, attach its WebSocket server
    // and register the callback
    if (this.watcher) {
      const watcherOptions = {
        liveReload: this.liveReload,
        server: this.server,
        port: this.config.port,
      };

      this.watcher.listen(watcherOptions, () => {
        cache.clear();

        if (this.builder.isDirty) {
          this.watcher.broadcast({ command: 'dirty' });
        }
      });
    } else {
      this.server.listen(this.config.port);
    }

    // Clear the cache, and liveReload (optional), when DB changes
    Record.addHooks(['afterSave', 'afterDestroy'], () => {
      cache.clear();
      if (this.liveReload) { this.watcher.refresh(); }
    });
  }

  /**
   * Safely stops the services
   */
  stop() {
    if (this.server) { this.server.close(); }
    this.db.disconnect();
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
    cache: !this.local,
    database: {
      dialect: 'sqlite',
      logging: false,
    },
    dataPath: './data',
    liveReload: this.local,
    placeholders: this.local,
    port: process.env.PORT || 3000,
  };
}

/**
 * @private
 *
 * Resolves commonly-used paths
 *
 * @param {string} cwd
 * @param {string} dataPath - data directory
 * @return {Object} absolute paths
 */
function _paths(cwd, dataPath) {
  const paths = Utils.assignWith({}, {
    root: '.',
    data: dataPath,
    cache: join(dataPath, 'cache'),
    uploads: join(dataPath, 'uploads'),
    www: './www',
    modules: './node_modules',
  }, (_, srcPath) => resolve(cwd, srcPath));

  // Ensure paths exist
  Utils.mkdirp(paths.cache);
  Utils.mkdirp(paths.uploads);
  Utils.mkdirp(paths.www);

  return paths;
}

/**
 * @private
 *
 * Loads ENV via dotenv
 *
 * @param {string} cwd
 */
function _loadEnv(cwd) {
  const envPath = resolve(cwd, '.env');

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
 * @return {Database} a new database instance
 */
function _db(dbConfig, dataPath) {
  if (dbConfig.dialect === 'sqlite') {
    /* eslint-disable-next-line no-param-reassign */
    dbConfig.storage = resolve(dataPath, 'vapid.sqlite');
  }

  return new Database(dbConfig);
}

/**
 * @private
 *
 * Renders content into site template
 *
 * @param {string} uriPath
 * @return {string} rendered HTML
 *
 * @todo Use Promise.all when fetching content
 */
async function _renderContent(uriPath) {
  const pathAnalyzer = new services.UriPathAnalyzer(uriPath, this.paths.www);
  const [file, pathSection, pathRecordId] = pathAnalyzer.perform();
  const content = {};

  if (!file) {
    throw Boom.notFound('Template not found');
  }

  const partials = glob.sync(resolve(this.paths.www, '**/_*.html'));
  const template = Template.fromFile(file, this.paths.www, partials, { parseConditionals: true });
  const tree = template.parse();

  /* eslint-disable no-restricted-syntax */
  for (const [token, args] of Object.entries(tree)) {
    const recordId = pathSection === args.name && args.params.multiple !== 'true'
      ? pathRecordId
      : null;
    /* eslint-disable-next-line no-await-in-loop */
    let recordContent = await Section.contentFor(args, recordId);

    if (this.config.placeholders) {
      recordContent = _addPlaceholders(recordContent, args);
    }

    content[token] = recordContent;
  }
  /* eslint-enable no-restricted-syntax */

  return template.render(content);
}

/**
 * @private
 *
 * Renders error, first by looking in the site directory,
 * then falling back to Vapid own error template.
 *
 * @param {Error} err
 * @param {Object} request
 * @return {[status, rendered]} HTTP status code, and rendered HTML
 */
function _renderError(err, request) {
  const error = Boom.boomify(err);
  let status = error.output.statusCode;
  let rendered;
  let errorFile;

  if (this.local && status !== 404) {
    errorFile = resolve(dashboard.paths.views, 'errors', 'trace.html');
    rendered = Template.fromFile(errorFile).render({
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
    errorFile = status === 404 && fs.existsSync(siteFile) ? siteFile : resolve(dashboard.paths.views, 'errors', `${status}.html`);
    rendered = fs.readFileSync(errorFile, 'utf-8');
  }

  if (status !== 404) {
    Logger.extra(error.stack);
  }

  return [status, rendered];
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
function _addPlaceholders(content, section) {
  const prefix = section.name !== Section.DEFAULT_NAME ? `${section.name}::` : '';

  if (content.length === 0) {
    const placeholders = Utils.reduce(section.fields, (memo, params, token) => {
      if (!Utils.has(Record.SPECIAL_FIELDS, params.name)) {
        /* eslint-disable-next-line no-param-reassign */
        memo[token] = `{{${prefix}${params.name}}}`;
      }
      return memo;
    }, {});
    content.push(placeholders);
  } else if (section.keyword !== 'form') {
    Utils.each(content, (record) => {
      Utils.each(record, (value, key) => {
        const { name } = section.fields[key];

        if (Utils.isEmpty(value) && name) {
          /* eslint-disable-next-line no-param-reassign */
          record[key] = `{{${prefix}${name}}}`;
        }
      });
    });
  }

  return content;
}

/**
 * @private
 *
 * Injects LiveReload script into HTML
 *
 * @param {Object} ctx
 * @param {number} port - server port number
 */
function _injectLiveReload(ctx, port) {
  const { hostname } = ctx.request;
  const wsPort = _websocketPort(ctx, port);
  const script = `<script src="/dashboard/javascripts/livereload.js?snipver=1&port=${wsPort}&host=${hostname}"></script>`;

  ctx.body = ctx.body.replace(/(<\/body>(?![\s\S]*<\/body>[\s\S]*$))/i, `${script}\n$1`);
}

/**
 * @private
 *
 * Hack to help determine Glitch WebSocket port
 *
 * @param {Object} ctx
 * @param {number} port - server port number
 * @return {number} WebSocket port number
 */
function _websocketPort(ctx, port) {
  const forwarded = ctx.header['x-forwarded-proto'];
  const protocol = forwarded ? forwarded.split(',')[0] : undefined;
  return protocol === 'https' ? 443 : port;
}

module.exports = Vapid;
