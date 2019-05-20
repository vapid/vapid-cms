const { basename } = require('path');
const Boom = require('@hapi/boom');

const Utils = require('../utils');

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
  const fileName = basename(ctx.path);
  const char = fileName.slice(0, 1);

  if (Utils.includes(['_', '.'], char)) {
    throw Boom.notFound('Filenames starting with an underscore or period are private, and cannot be served.');
  } else {
    await next();
  }
};
