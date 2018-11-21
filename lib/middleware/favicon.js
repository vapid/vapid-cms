const fs = require('fs');
const path = require('path');

const FAVICON_PATH = '/favicon.ico';

/**
 * Returns the first favicon found in the supplied paths, if any.
 *
 * @param {array} [paths=[]]
 * @return {string|false}
 */
function findFavicon(paths = []) {
  for (const p of paths) {
    const filePath = path.join(p, FAVICON_PATH);
    if (fs.existsSync(filePath)) { return filePath; }
  }
  return false;
}

/**
 * Serves the first favicon found in the supplied paths
 *
 * @param {array} [paths=[]]
 * @parms {Object} options
 * @return {function|boolean}
 */
module.exports = function favicon(paths = [], options = {}) {
  const maxAge = options.maxAge === null
    ? 86400000
    : Math.min(Math.max(0, options.maxAge), 31556926000);
  const cacheControl = `public, max-age=${maxAge / 1000 | 0}`; // eslint-disable-line no-bitwise

  return (ctx, next) => {
    if (ctx.path !== FAVICON_PATH) {
      return next();
    }

    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      ctx.status = ctx.method === 'OPTIONS' ? 200 : 405;
      ctx.set('Allow', 'GET, HEAD, OPTIONS');
    } else {
      const filePath = findFavicon(paths);
      ctx.set('Cache-Control', cacheControl);
      ctx.type = 'image/x-icon';
      ctx.body = filePath ? fs.readFileSync(filePath) : '';
    }

    return true;
  };
};

module.exports.findFavicon = findFavicon;
