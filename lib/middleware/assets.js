const mount = require('koa-mount');
const serve = require('koa-static');
const { extname } = require('path');
const Boom = require('@hapi/boom');
const Utils = require('../utils');

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
    const ext = extname(ctx.path);

    if (Utils.includes(['', '.html'], ext)) {
      await next();
    } else if (Utils.includes(['.scss', '.sass'], ext)) {
      const suggestion = ctx.path.replace(/\.(scss|sass)$/, '.css');
      throw Boom.notFound(`Sass files cannot be served. Use "${suggestion}" instead.`);
    } else {
      await mount(prefix, serve(path))(ctx, next);
    }
  };
};
