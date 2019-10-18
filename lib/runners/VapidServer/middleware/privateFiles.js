const { Paths } = require('../../../utils');

/**
 * Throw 404 if the path starts with an underscore or period
 *
 * @params {Object} ctx
 * @params {function} next
 * @return {function}
 *
 * @throws {Boom.notFound}
 */
module.exports = async function privateFiles(ctx, next) {
  Paths.assertPublicPath(ctx.path);
  await next();
};
