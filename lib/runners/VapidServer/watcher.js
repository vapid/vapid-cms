const lr = require('livereload');
const { extname } = require('path');
const { Logger, Utils } = require('../../utils');

const reSass = /\.s[ac]ss$/;

/**
 * Watches filesystem for changes,
 * and WebSocket LiveReload
 *
 * @example
 * let watcher = new Watcher('path/to/watch')
 *
 * @example
 * let watcher = new Watcher(['path/to/watch', 'another/path'])
 */
class Watcher {
  /**
   * @param {string|array} [paths=[]] - one or more paths to watch
   * @return {Watcher}
   */
  constructor(paths = []) {
    this.paths = Array.isArray(paths) ? paths : [paths];
  }

  /**
   * Starts the file watcher and WebSocket server
   *
   * @param {{server: Server, port: number, liveReload: boolean}} config
   * @param {function} [callback=Utils.noop] - function to execute when files are changed
   */
  listen(config, callback = Utils.noop) {
    this.callback = callback;
    this.server = lr.createServer(config);

    if (!config.liveReload) return;

    this.server.watch(this.paths)
      .on('add', _eventHandler.bind(this))
      .on('change', _eventHandler.bind(this))
      .on('unlink', _eventHandler.bind(this));

    Logger.info(`Watching for changes in ${this.paths}`);
  }

  /**
   * Safely shuts down the server
   */
  close() {
    if (this.server) this.server.close();
  }

  /**
   * Broadcasts reload-all command to WebSocket clients
   *
   * @param {string} [filePath=*] - path to refresh
   */
  refresh(filePath = '*') {
    if (!this.server) return;

    const refreshPath = filePath.replace(reSass, '.css');
    this.server.refresh(refreshPath);
    Logger.info(`LiveReload: ${filePath}`);
  }

  /**
   * Broadcasts data to all WebSocket clients
   *
   * @param {Object} [data={}]
   */
  broadcast(data = {}) {
    this.server.sendAllClients(JSON.stringify(data));
  }
}

/**
 * @private
 *
 * Called whenever files are added, changed, or deleted
 *
 * @param {string} filePath - path to changed file
 */
function _eventHandler(filePath) {
  // Ignore hidden files
  if (/^\..*/.test(filePath)) return;

  if (extname(filePath).match(reSass)) {
    setTimeout(() => {
      this.callback();
      this.refresh(filePath);
    });
    return;
  }

  this.callback();
  Logger.info(`LiveReload: ${filePath}`);
}

module.exports = Watcher;
