const fs = require('fs');
const { basename, join } = require('path');
const { Utils } = require('../../../utils');

fs.readdirSync(__dirname).forEach((file) => {
  if (file === 'index.js') return;
  if (file.startsWith('.')) return;

  const name = Utils.camelCase(basename(file, '.js'));
  /* eslint-disable-next-line global-require, import/no-dynamic-require */
  module.exports[name] = require(join(__dirname, file));
});
