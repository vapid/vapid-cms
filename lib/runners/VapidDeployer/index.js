const fs = require('fs');
const path = require('path');
const url = require('url');

const glob = require('glob');
const got = require('got');
const inquirer = require('inquirer');
const netrc = require('netrc');
const pLimit = require('p-limit');
const tmp = require('tmp');
const writePkg = require('write-pkg');
const FormData = require('form-data');
const Webpack = require('webpack');

const { Logger, Utils } = require('../../utils');
const makeWebpackConfig = require('../../webpack_config');

const Vapid = require('../Vapid');

/**
 * This is the Vapid hosting service deployer.
 * The `VapidDeployer` class extends the base `Vapid` project class
 * to deploy the website to Vapid's hosting service. Its single method,
 * `deploy` will compile assets and synrchonize assets, templates,
 * and content (on first deploy) with the remote hosting server.
 */
class VapidDeployer extends Vapid {
  /**
   * Deploys the website to Vapid's hosting service
   */
  async deploy() {
    this.apiURL = process.env.API_URL || 'https://api.vapid.com';
    this.apiHostname = url.parse(this.apiURL).hostname;
    this.credentials = this.getCredentials();
    this.deployContent = false;
    this.tmpDir = tmp.dirSync().name;
    this.content = undefined;
    this.siteId = undefined;

    // Make sure the user is logged in
    await this.ensureLogin();

    // Create a new hosted site, if necessary.
    this.siteId = await this.ensureSite();

    Utils.copyFiles(this.paths.www, this.tmpDir);

    Logger.info('Connecting to Database');
    await this.db.connect();

    Logger.info('Compiling assets');
    await this.compileAssets();
    const siteChecksums = this.getChecksums();

    // Upload
    Logger.info('Preparing upload');
    const siteAndUploadsChecksums = this.getChecksums();
    const presignedPosts = await this.getPresignedPosts(siteAndUploadsChecksums);

    Logger.info('Uploading');
    const hadUploads = await this.uploadFiles(presignedPosts);

    // Update site
    const manifest = this.generateManifest(siteChecksums, presignedPosts);
    const site = await this.updateSite(manifest);

    if (hadUploads) {
      Logger.info('Upload complete');
    }

    Logger.extra(`View your website at ${site.url}`);

    // Clean up
    Utils.removeFiles(this.tmpDir);
  }

  /*
   * Checks to see if the user is logged in. If not,
   * prompts them to log in.
   */
  async ensureLogin() {
    const loggedIn = !Utils.isEmpty(this.credentials);

    if (loggedIn) return;

    Logger.info('Please enter your Vapid credentials, or visit vapid.com to signup.');
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Email:',
      },

      {
        type: 'password',
        name: 'password',
        message: 'Password:',
      },
    ]);

    const endpoint = url.resolve(this.apiURL, '/auth/me');
    const body = { email: answers.email, password: answers.password };
    const response = await got.post(endpoint, { body, json: true });
    const userNetrc = netrc();

    this.credentials = {
      login: answers.email,
      password: response.body.api_key,
    };

    userNetrc[this.apiHostname] = this.credentials;
    netrc.save(userNetrc);
  }

  /*
   * Check to see if site already has a corresponding hosting siteID.
   * If not, ask them a few questions.
   */
  async ensureSite() {
    const { site } = this.config;
    let answers;

    if (site) {
      return site;
    }

    // Ask questions
    answers = await inquirer.prompt({
      type: 'confirm',
      name: 'newSite',
      message: 'Is this a new website?',
    });

    if (!answers.newSite) {
      Logger.extra([
        'Please add your site\'s ID to package.json.',
        // TODO: See vapid.com/blah-blah for more info
      ]);
    }

    answers = await inquirer.prompt({
      type: 'confirm',
      name: 'deployContent',
      message: 'Would you like to deploy the existing content too?',
    });

    // Create a new site
    const { deployContent } = answers;
    const endpoint = url.resolve(this.apiURL, '/sites');
    const response = await got.post(endpoint, { json: true, headers: this.getHeaders() });
    this.siteId = response.body.site.id;

    // Update package.json
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const pjson = require(this.paths.pjson);
    pjson.vapid.site = this.siteId;
    writePkg.sync(this.paths.pjson, pjson);

    if (deployContent) {
      Logger.info('Preparing content');
      this.content = await this.getContent();

      if (fs.existsSync(this.paths.uploads)) {
        Utils.copyFiles(this.paths.uploads, path.resolve(this.tmpDir, 'uploads'));
      }
    }

    return response.body.site.id;
  }

  /*
   * Get the credentials from the ~/.netrc file
   */
  getCredentials() {
    const userNetrc = netrc();
    return userNetrc[this.apiHostname];
  }

  /**
   * Compiles Webpack assets
   */
  async compileAssets() {
    const config = makeWebpackConfig(
      'production',
      [this.paths.www],
      this.paths.modules,
      this.tmpDir,
    );

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
   * Generates a legend of file paths to checksums
   */
  getChecksums() {
    const checksums = {};

    glob.sync(path.resolve(this.tmpDir, '**/!(*.pack.+(s[ac]ss|js))'), { mark: true }).forEach((file) => {
      if (file.endsWith('/')) { return; }
      const relativePath = path.relative(this.tmpDir, file);
      checksums[relativePath] = Utils.checksum(file);
    });

    return checksums;
  }

  /**
   * Headers
   */
  getHeaders() {
    return {
      authorization: `Bearer ${this.credentials.password}`,
    };
  }

  /**
   * Gathers content
   */
  async getContent() {
    const { Section } = this.db.models;
    const order = Section.DEFAULT_ORDER.map((o) => { o.unshift('records'); return o; });
    const contentSections = await Section.scope('content').findAll({ include: 'records', order });
    return contentSections.reduce((memo, section) => {
      /* eslint-disable-next-line no-param-reassign */
      memo[section.name] = section.records.map(record => record.get('content'));
      return memo;
    }, {});
  }

  /**
   * Presigned posts
   */
  async getPresignedPosts(checksums) {
    const endpoint = url.resolve(this.apiURL, `/sites/${this.siteId}/presigned_posts`);
    const body = { checksums };
    const response = await got.post(endpoint, { body, json: true, headers: this.getHeaders() });

    return response.body.presignedPosts;
  }

  /**
   * Upload files to S3
   */
  async uploadFiles(presignedPosts) {
    const promises = [];
    const limit = pLimit(5);
    let uploaded = false;

    Object.keys(presignedPosts).forEach(async (pth) => {
      const { post } = presignedPosts[pth];

      if (!post) {
        Logger.tagged('exists', pth, 'blue');
      } else {
        const filePath = path.resolve(this.tmpDir, pth);
        const form = new FormData();

        for (const [key, value] of Object.entries(post.fields || {})) {
          form.append(key, value);
        }

        form.append('file', fs.createReadStream(filePath));

        const promise = limit(() => got.post(post.url, { body: form }).then(() => {
          Logger.tagged('upload', pth);
        }));

        promises.push(promise);
        uploaded = true;
      }
    });

    await Promise.all(promises);
    return uploaded;
  }

  /**
   * Generate a manifest
   */
  /* eslint-disable class-methods-use-this */
  generateManifest(siteChecksums, presignedPosts) {
    return Object.entries(siteChecksums).reduce((memo, [pth]) => {
      /* eslint-disable-next-line no-param-reassign */
      memo[pth] = presignedPosts[pth].digest;
      return memo;
    }, {});
  }
  /* eslint-enable class-methods-use-this */

  /**
   * Update the site
   */
  async updateSite(manifest) {
    const endpoint = url.resolve(this.apiURL, `/sites/${this.siteId}`);
    const body = { tree: this.db.builder.tree, content: this.content, manifest };
    const response = await got.post(endpoint, { body, json: true, headers: this.getHeaders() });
    return response.body.site;
  }
}

module.exports = VapidDeployer;
