const fs = require('fs');
const { randomBytes } = require('crypto');
const { basename, resolve } = require('path');
const Boom = require('@hapi/boom');

const Utils = require('./utils');
const pjson = require('../package.json');

const templateDir = resolve(__dirname, '../site_template');

/**
 * Creates new site directories from a template
 */
class Generator {
  /*
   * @static
   *
   * Copies files for a new website
   *
   * @param {string} target - a file path
   */
  static copyTo(target) {
    if (fs.existsSync(target)) {
      throw new Boom('Target directory already exists.');
    }

    Utils.copyFiles(templateDir, target, {
      name: basename(target),
      package: pjson.name,
      version: pjson.version,
      secretKey: randomBytes(64).toString('hex'),
    });
  }

  /*
   * @static
   *
   * Regenerates .env file
   *
   * @param {string} target - a file path
   */
  static copyEnv(target) {
    const targetFile = resolve(target, '.env');
    const templateFile = resolve(templateDir, '.env.ejs');

    if (fs.existsSync(targetFile)) return;

    Utils.copyFile(templateFile, targetFile, {
      secretKey: randomBytes(64).toString('hex'),
    });
  }
}

module.exports = Generator;
