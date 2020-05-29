const http = require('http');
const path = require('path');

const Koa = require('koa');

const Dashboard = require('./Dashboard');
const middleware = require('./middleware');
const { renderContent, renderError } = require('../../Renderer');
const { Utils } = require('../../utils');
const Watcher = require('./watcher');
const Vapid = require('../Vapid');

const app = new Koa();
const cache = new Map();

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

    this.watcher = this.isDev && new Watcher(this.paths.www);
    this.liveReload = this.watcher && this.config.liveReload;
    this.buildOnStart = !this.isDev;

    // Share with dashboard
    const dashboard = new Dashboard({
      local: this.isDev,
      db: this.db,
      uploadsDir: this.paths.uploads,
      siteName: Utils.startCase(this.name),
      liveReload: this.liveReload,
    });
    this.dashboard = dashboard;

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
      const cacheValue = this.config.cache && cache.get(cacheKey);

      // Get file name extension from path to set content type accordingly
      // TODO: Make this not hardcoded
      const ext = path.extname(ctx.path);

      switch (ext) {
        case '':
          ctx.type = 'text/html';
          break;
        case '.html':
          ctx.type = 'text/html';
          break;
        case '.xml':
          ctx.type = 'application/xml';
          break;
        case '.rss':
          ctx.type = 'application/rss+xml';
          break;
        case '.json':
          ctx.type = 'application/json';
          break;
        default:
          break;
      }

      ctx.body = cacheValue || await renderContent.call(this, ctx.path);

      if (this.config.cache && !cacheValue) {
        cache.set(cacheKey, ctx.body);
      }

      // Only inject liveReload into HTML files if it is enabled
      if (this.liveReload && ctx.type === 'text/html') { _injectLiveReload(ctx, this.config.port); }
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
    this.server = http.createServer(app.callback());

    // Build if necessary
    if (this.buildOnStart) {
      this.db.rebuild();
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

        if (this.db.isDirty) {
          this.watcher.broadcast({ command: 'dirty' });
        }
      });
    } else {
      this.server.listen(this.config.port);
    }

    // Clear the cache, and liveReload (optional), when DB changes
    this.db.models.Record.addHooks(['afterSave', 'afterDestroy'], () => {
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
