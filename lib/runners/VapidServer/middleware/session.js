const sess = require('koa-session');
const convert = require('koa-convert');

const key = 'vapid:sess';

/**
 * Initializes the session
 *
 * @param {Object} app
 * @return {function}
 */
module.exports = app => convert(sess(app, { key }));
