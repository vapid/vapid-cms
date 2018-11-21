const Boom = require('boom');
const mount = require('koa-mount');
const serve = require('koa-static');
const { isAssetPath } = require('../paths');
/**
 * Looks for static assets
 *
 * @params {string} path
 * @params {string} [prefix='/'] mount path
 * @return {function}
 *
 * @throws {Boom.notFound}
 */
module.exports = function assets(path, prefix = '/') {
  return async (ctx, next) => {
    const stat = isAssetPath(ctx.path);

    // If it returns an error message, throw the error.
    if (typeof stat === 'string') { throw Boom.notFound(stat); }

    // Otherwise, serve or skip accordingly.
    await (stat ? mount(prefix, serve(path))(ctx, next) : next());
  };
};
