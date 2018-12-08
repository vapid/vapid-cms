const glob = require('glob');
const { relative, resolve } = require('path');
const sass = require('sass');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { RemoveFilesPlugin } = require('./plugins');
const Utils = require('../../utils');

/**
 * Dynamic config for Webpack
 *
 * @param {string} options
 * @return {Object} Webpack configuration
 */
function config(mode = 'production', assetDirs = [], moduleDirs = [], outputDir = false) {
  const context = resolve(__dirname, '../../../node_modules');
  const entry = _entry(Utils.castArray(assetDirs));
  const output = outputDir ? { filename: '[name].js', path: outputDir } : {};
  const removeFiles = _removeFiles(entry);
  const resolveModules = Utils.concat([context], moduleDirs);
  const devtool = mode === 'development' ? 'source-map' : false;

  return {
    mode,
    context,
    entry,
    output,
    devtool,

    module: {
      rules: [
        {
          test: /\.s[ac]ss$/,
          use: [
            { loader: MiniCssExtractPlugin.loader },
            { loader: 'css-loader', options: { url: false, sourceMap: true } },
            { loader: 'sass-loader', options: { implementation: sass, sourceMap: true } },
            { loader: 'resolve-url-loader' },
          ],
        },
      ],
    },

    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new RemoveFilesPlugin({
        files: removeFiles,
      }),
    ],

    resolve: {
      modules: resolveModules,
    },
  };
}

/**
 * Generates entry object by scanning directories
 * for *.pack.scss, *.pack.sass, and *.pack.js files
 *
 * @param {array} dirs
 * @return {Object} entry object
 */
function _entry(dirs) {
  return Utils.reduce(dirs, (memo, dir) => {
    const packs = glob.sync(resolve(dir, '**/*.pack.+(s[ac]ss|js)'));
    packs.forEach((pack) => {
      const key = relative(dir, pack).replace(/\.pack\.[^/.]+$/, '');
      /* eslint-disable-next-line no-param-reassign */
      memo[key] = [pack];
    });

    return memo;
  }, {});
}

/**
 * Scans entries for Sass files, and excludes the associated .js garbage files
 *
 * @param {Object} entry
 * @return {array} list of files to remove from the final output
 */
function _removeFiles(entry) {
  return Utils.reduce(entry, (memo, value, key) => {
    if (value[0].match(/\.pack\.s[ac]ss/)) {
      memo.push(`${key}.js`);
    }
    return memo;
  }, []);
}

module.exports = config;
