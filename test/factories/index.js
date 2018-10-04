const fs = require('fs');
const { join, resolve } = require('path');
const Database = require('../../lib/db');
const Utils = require('../../lib/utils');

const dbFile = resolve(__dirname, '../test.sqlite');

try {
  fs.unlinkSync(dbFile);
} catch (err) {
  // Do nothing
}

const db = new Database({
  dialect: 'sqlite',
  logging: false,
  storage: dbFile,
});

Object.keys(db.models).forEach((modelName) => {
  const factoryName = Utils.pascalCase(`${modelName}Factory`);
  module.exports[factoryName] = async (props = {}, options = {}) => {
    /* eslint-disable-next-line global-require, import/no-dynamic-require */
    const defaultProps = require(join(__dirname, modelName.toLowerCase()))();
    const data = Object.assign({}, defaultProps, props);

    await db.connect();
    return db.models[modelName].create(data, options);
  };
});
