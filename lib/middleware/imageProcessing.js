const crypto = require('crypto');
const sharp = require('sharp');
const {
  existsSync, readFileSync, statSync, writeFile,
} = require('fs');
const { extname, join } = require('path');
const Utils = require('../utils');

const ACCEPTED_FORMATS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
];

/**
 * Resize and crop images
 *
 * @params {Object} paths
 * @return {function}
 */
module.exports = function imageProcessing(paths) {
  return async (ctx, next) => {
    const ext = extname(ctx.path).toLowerCase();
    const { w, h } = ctx.query;

    if (
      !Utils.includes(ACCEPTED_FORMATS, ext) ||
      !(w || h)
    ) return next();

    const filePath = Utils.startsWith(ctx.path, '/uploads') ?
      join(paths.data, ctx.path) :
      join(paths.www, ctx.path);
    const fileStats = statSync(filePath);
    const cacheKey = crypto.createHash('md5')
      .update(`${ctx.url}${fileStats.mtime}`)
      .digest('hex');
    const cachePath = join(paths.cache, `${cacheKey}${ext}`);
    const cacheExists = existsSync(cachePath);

    ctx.set('Content-Length', fileStats.size);
    ctx.type = ext;

    ctx.body = await (async () => {
      if (cacheExists) {
        return readFileSync(cachePath);
      }

      const buffer = await sharp(filePath)
        .rotate()
        .resize({
          width: Number(w) || null,
          height: Number(h) || null,
        })
        .toBuffer();

      writeFile(cachePath, buffer, Utils.noop);
      return buffer;
    })();

    return true;
  };
};
