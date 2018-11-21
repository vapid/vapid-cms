const http = require('http');

const Koa = require('koa');

const Builder = require('./builder');
const Cache = require('./cache');
const Dashboard = require('./dashboard');
const middleware = require('./middleware');
const { renderContent, renderError } = require('./renderer');
const Utils = require('./utils');
const Watcher = require('./watcher');
const Vapid = require('./Vapid');

const app = new Koa();
const cache = new Cache();

let Section;
let Record;
let User;
let dashboard;

/**
 * This is the Vapid development server.
 * The `VapidServer` class extends the base `Vapid` project class
 * to provide a developer server that enables easy site development
 * and content creation through the admin dashboard.
 */
class VapidServer extends Vapid {
  /**
   * This module works in conjunction with a site directory.
   *
   * @param {string} cwd - path to site
   * @return {Vapid}
   */
  constructor(cwd) {
    super(cwd);

    this.builder = new Builder({ Section: this.db.models.Section, templatesDir: this.paths.www });
    this.watcher = this.isDev && new Watcher(this.paths.www);
    this.liveReload = this.watcher && this.config.liveReload;
    this.buildOnStart = !this.isDev;

    // Convenience
    ({ Section, Record, User } = this.db.models);

    // Share with dashboard
    dashboard = new Dashboard({
      Section,
      Record,
      User,
      local: this.isDev,
      builder: this.builder,
      uploadsDir: this.paths.uploads,
      siteName: Utils.startCase(this.name),
      liveReload: this.liveReload,
    });

    // Set secret key
    app.keys = [process.env.SECRET_KEY];

    // Errors
    app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        [ctx.status, ctx.body] = renderError.call(this, err, ctx.request);

        if (this.liveReload) { _injectLiveReload(ctx, this.config.port); }
      }
    });

    // Middleware
    app.use(middleware.security)
      .use(middleware.session(app))
      .use(middleware.webpack(this.isDev, [dashboard.paths.assets, this.paths.www], this.paths.modules)) // eslint-disable-line max-len
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
        ? cache.get(cacheKey) || cache.put(cacheKey, await renderContent.call(this, ctx.path))
        : await renderContent.call(this, ctx.path);

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

module.exports = VapidServer;
