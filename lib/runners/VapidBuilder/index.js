const fs = require('fs');
const path = require('path');
const util = require('util');

const glob = util.promisify(require('glob'));
const webpack = require('webpack');
const mkdirp = require('mkdirp');

const { renderContent } = require('../../Renderer');
const { Logger, Paths, Utils } = require('../../utils');
const makeWebpackConfig = require('../../webpack_config');

const Vapid = require('../Vapid');

/**
 * This is the Vapid static site builder.
 * The `VapidBuilder` class extends the base `Vapid` project class
 * to enable static site builds. Its single method, `build(dest)`
 * will output compiled static HTML files and static assets
 * for every page and record.
 */
class VapidBuilder extends Vapid {
  /**
   * Runs a static build of the Vapid site and builds to the `dest` directory.
   * and registers callbacks
   * TODO: Handle favicons.
   *
   * @param {string}  dest – the build destination directory.
   */
  async build(dest) {
    if (!path.isAbsolute(dest)) {
      throw new Error('Vapid build must be called with an absolute destination path.');
    }

    // Fetch our webpack config.
    const webpackConfig = makeWebpackConfig(
      this.isDev ? 'development' : 'production',
      [this.paths.www],
      this.paths.modules,
    );

    // Ensure we have a destination directory and point webpack to it.
    mkdirp.sync(dest);
    webpackConfig.output.path = dest;

    // Run the webpack build for CSS and JS bundles.
    Logger.info('Running Webpack Build');
    const stats = await new Promise((res, rej) => {
      webpack(webpackConfig, (err, dat) => {
        if (err) rej(err);
        else res(dat);
      });
    });

    // Move all uploads to dest directory.
    Logger.info('Moving Uploads Directory');
    const uploadsOut = path.join(dest, 'uploads');
    const uploads = await glob(path.join(this.paths.uploads, '**/*'));
    mkdirp.sync(uploadsOut);

    // Move all assets in /uploads to dest uploads directory
    /* eslint-disable-next-line no-restricted-syntax */
    for (const upload of uploads) {
      if (!Paths.isAssetPath(upload)) { continue; }
      fs.copyFileSync(
        upload,
        path.join(dest, 'uploads', path.relative(this.paths.uploads, upload)),
      );
    }

    // Copy all public static assets to the dest directory.
    Logger.info('Copying Static Assets');
    const assets = await glob(path.join(this.paths.www, '**/*'));
    /* eslint-disable-next-line no-restricted-syntax */
    for (const asset of assets) {
      const isAsset = Paths.isAssetPath(asset);
      if (isAsset === false || typeof isAsset === 'string') { continue; }
      try { Paths.assertPublicPath(asset); } catch (err) { continue; }
      const out = path.join(dest, path.relative(this.paths.www, asset));
      mkdirp.sync(path.dirname(out));
      fs.copyFileSync(asset, out);
    }

    // Copy discovered favicon over.
    const faviconPath = Utils.findFirst('favicon.ico', [this.paths.www, Paths.getDashboardPaths().assets]);
    if (faviconPath) {
      fs.copyFileSync(faviconPath, path.join(dest, '/favicon.ico'));
    }

    Logger.info('Connecting to Database');
    await this.db.connect();

    // Store all sections in a {[name]: Section} map for easy lookup.
    const sectionsArr = await this.db.models.Section.findAll();
    const sections = {};
    for (const section of sectionsArr) {
      sections[section.name] = section;
    }

    // Fetch all potential template files. These are validated below before compilation.
    Logger.info('Compiling All Templates');
    const templates = await glob(path.join(this.paths.www, '**/*.{html,xml,rss,json}'));

    // For every `.html`, `.xml`, and `.json` template discovered in `/www`...
    /* eslint-disable no-await-in-loop */
    for (const tmpl of templates) {
      const parsed = path.parse(path.relative(this.paths.www, tmpl));

      // If this is a partial, we need to check if it has a section object backing it.
      // If yes, and it stores multiple records, render each record.
      if (Paths.isTemplatePartial(tmpl)) {
        const name = parsed.name.slice(1);
        const section = sections[name];

        if (!section || !section.multiple) { continue; }

        const records = await section.getRecords();
        for (const record of records) {
          await this.renderUrl(record.permalink, path.join(dest, `${record.permalink}.html`));
          Logger.extra([`Created: ${record.permalink}.html`]);
        }

      // If this isn't a partial, it must be a page, an XML or a JSON file. Render it!
      } else {
        const ext = path.extname(tmpl);
        const name = parsed.name === 'index' && parsed.dir ? parsed.dir : parsed.name;
        await this.renderUrl(`/${name}`, path.join(dest, `${name}${ext}`), ext);
        Logger.extra([`Created: /${name}`]);
      }
    }
    /* eslint-enable no-await-in-loop */

    this.db.disconnect();

    Logger.info('Static Site Created!');

    return stats;
  }

  async renderUrl(url, out, ext) {
    const body = await renderContent.call(this, url, ext);
    mkdirp.sync(path.dirname(out));
    await fs.writeFileSync(out, body);
  }
}

module.exports = VapidBuilder;
