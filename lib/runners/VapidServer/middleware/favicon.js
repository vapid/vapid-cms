const fs = require('fs');
const { Utils } = require('../../../utils');

const FAVICON_PATH = '/favicon.ico';

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
      const filePath = Utils.findFirst(FAVICON_PATH, paths);
      ctx.set('Cache-Control', cacheControl);
      ctx.type = 'image/x-icon';
      ctx.body = filePath ? fs.readFileSync(filePath) : '';
    }

    return true;
  };
};
