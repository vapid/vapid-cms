const fs = require('fs');
const { relative, resolve } = require('path');
const got = require('got');
const writePkg = require('write-pkg');
const netrc = require('netrc');
const pLimit = require('p-limit');
const tmp = require('tmp');
const url = require('url');
const glob = require('glob');
const FormData = require('form-data');
const Webpack = require('webpack');

const Logger = require('./logger');
const Utils = require('./utils');
const webPackConfig = require('./middleware/webpack/config');

const userNetrc = netrc();

let pjson;
let pjsonPath;
let credentials;
let apiURL;
let apiHostname;

/**
 * Deploys to the Vapid hosting service
 */
/* eslint-disable class-methods-use-this */
class Deployer {
  /**
   * @param {string} cwd - path to website
   */
  constructor(paths) {
    this.paths = paths;
    pjsonPath = resolve(paths.root, 'package.json');
    pjson = require(pjsonPath); // eslint-disable-line global-require, import/no-dynamic-require
    apiURL = process.env.API_URL || 'https://api.vapid.com';
    apiHostname = url.parse(apiURL).hostname;
    credentials = userNetrc[apiHostname];
  }

  /**
   * Determines if user has stored Vapid credentials
   *
   * @return {boolean}
   */
  get loggedIn() {
    return !Utils.isEmpty(credentials);
  }

  get hasSite() {
    const { site: siteId } = pjson.vapid;
    return siteId !== undefined;
  }

  /**
   * Login to Vapid, and store the assigned API key
   *
   * @param {string} email
   * @param {password} password
   */
  async login(email, password) {
    const endpoint = url.resolve(apiURL, '/auth/me');
    const body = { email, password };
    const response = await got.post(endpoint, { body, json: true });

    credentials = {
      login: email,
      password: response.body.api_key,
    };

    userNetrc[apiHostname] = credentials;
    netrc.save(userNetrc);
  }

  /**
   * Deploy the site
   */
  async deploy(tree, Section, deployContent = false) {
    const wwwDir = this.paths.www;
    const { name: tmpDir } = tmp.dirSync();
    let { site: siteId } = pjson.vapid;
    let content = {};

    // Compile tmp files
    Utils.copyFiles(wwwDir, tmpDir);
    await _compileAssets(wwwDir, tmpDir);
    const siteChecksums = _checksums(tmpDir);

    // Create site if necessary
    if (!siteId) {
      siteId = await _createSite();
      _updatePjson(siteId);

      if (deployContent) {
        content = await _content(Section);

        if (fs.existsSync(this.paths.uploads)) {
          Utils.copyFiles(this.paths.uploads, resolve(tmpDir, 'uploads'));
        }
      }
    }

    // Upload
    Logger.info('Preparing upload...');
    const siteAndUploadsChecksums = _checksums(tmpDir);
    const presignedPosts = await _getPresignedPosts(siteId, siteAndUploadsChecksums);

    Logger.info('Uploading...');
    const hadUploads = await _uploadFiles(tmpDir, presignedPosts);

    // Update site
    const manifest = _generateManifest(siteChecksums, presignedPosts);
    const site = await _updateSite(siteId, tree, manifest, content);

    if (hadUploads) {
      Logger.info('Upload complete.');
    }

    Logger.extra(`View your website at ${site.url}`);

    // Clean up
    Utils.removeFiles(tmpDir);
  }
}

/**
 * @private
 *
 * Create a new site
 *
 * @return {string} site - UUID of the website
 */
async function _createSite() {
  const endpoint = url.resolve(apiURL, '/sites');
  const response = await got.post(endpoint, { json: true, headers: _bearer() });

  return response.body.site.id;
}

/**
 * Save the site UUID into package.json
 *
 * @param {string} siteId
 */
function _updatePjson(siteId) {
  pjson.vapid.site = siteId;
  writePkg.sync(pjsonPath, pjson);
}

/**
 * Generate a manifest
 * @param {Object} siteChecksums
 * @param {Object} presignedPosts
 * @return {Object} manifest
 */
function _generateManifest(siteChecksums, presignedPosts) {
  return Utils.reduce(siteChecksums, (memo, checksum, path) => {
    /* eslint-disable-next-line no-param-reassign */
    memo[path] = presignedPosts[path].digest;
    return memo;
  }, {});
}

/**
 * Generates a legend of file paths to checksums
 *
 * @param {string} dir
 * @return {Object}
 */
function _checksums(dir) {
  const checksums = {};

  glob.sync(resolve(dir, '**/!(*.pack.+(s[ac]ss|js))'), { mark: true }).forEach((file) => {
    if (Utils.endsWith(file, '/')) { return; }

    const relativePath = relative(dir, file);
    checksums[relativePath] = Utils.checksum(file);
  });

  return checksums;
}

/**
 * Gets presigned posts
 *
 * @param {string} siteId
 * @param {Object} checksums
 * @return {Object}
 */
async function _getPresignedPosts(siteId, checksums) {
  const endpoint = url.resolve(apiURL, `/sites/${siteId}/presigned_posts`);
  const body = { checksums };
  const response = await got.post(endpoint, { body, json: true, headers: _bearer() });

  return response.body.presignedPosts;
}

/**
 * Upload files to S3
 *
 * @param {Object} paths
 * @param {Object} presignedPosts
 */
async function _uploadFiles(dir, presignedPosts) {
  const promises = [];
  const limit = pLimit(5);
  let uploaded = false;

  Object.keys(presignedPosts).forEach(async (path) => {
    const { post } = presignedPosts[path];

    if (!post) {
      Logger.tagged('exists', path, 'blue');
    } else {
      const filePath = resolve(dir, path);
      const form = new FormData();

      Utils.forEach(post.fields, (value, key) => { form.append(key, value); });
      form.append('file', fs.createReadStream(filePath));

      const promise = limit(() => got.post(post.url, { body: form }).then(() => {
        Logger.tagged('upload', path);
      }));

      promises.push(promise);
      uploaded = true;
    }
  });

  await Promise.all(promises);
  return uploaded;
}

/**
 * Update the site
 *
 * @param {string} siteId
 * @param {Object} manifest
 */
async function _updateSite(siteId, tree, manifest, content) {
  const endpoint = url.resolve(apiURL, `/sites/${siteId}`);
  const body = { tree, content, manifest };
  const response = await got.post(endpoint, { body, json: true, headers: _bearer() });
  return response.body.site;
}

/**
 * Gathers content
 *
 * @param {Object} Section
 * @return {Object} content
 */
async function _content(Section) {
  const { Record } = Section.sequelize.models;
  const order = Utils.map(Record.DEFAULT_ORDER, (o) => { o.unshift('records'); return o; });
  const contentSections = await Section.scope('content').findAll({ include: 'records', order });
  return Utils.reduce(contentSections, (memo, section) => {
    /* eslint-disable-next-line no-param-reassign */
    memo[section.name] = Utils.map(section.records, record => record.get('content'));
    return memo;
  }, {});
}

/**
 * Compiles Webpack assets
 */
async function _compileAssets(wwwDir, tmpDir) {
  const nodeDir = resolve(wwwDir, '../node_modules');
  const moduleDirs = (function _moduleDirs() {
    const dirs = [wwwDir];
    if (fs.existsSync(nodeDir)) dirs.push(nodeDir);
    return dirs;
  }());

  const config = webPackConfig('production', tmpDir, moduleDirs, tmpDir);
  if (Utils.isEmpty(config.entry)) return;

  const compiler = Webpack(config);
  await new Promise((_resolve, _reject) => {
    compiler.run((err, stats) => {
      if (stats.hasErrors()) {
        _reject(new Error('Failed to compile assets'));
      }

      _resolve();
    });
  });
}

/**
 * Headers
 */
function _bearer() {
  return {
    authorization: `Bearer ${credentials.password}`,
  };
}

module.exports = Deployer;
