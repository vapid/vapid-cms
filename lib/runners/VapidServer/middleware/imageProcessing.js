const fs = require('crypto');
const crypto = require('crypto');
const {
  existsSync,
  readFileSync,
  statSync,
  writeFile,
} = require('fs');
const { extname, join } = require('path');

const { Utils } = require('../../../utils');

const ACCEPTED_FORMATS = {
  '.jpg': 1,
  '.jpeg': 1,
  '.png': 1,
  '.webp': 1,
};

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
      !ACCEPTED_FORMATS[ext] ||
      !(w || h)
    ) return next();

    const filePath = ctx.path.startsWith('/uploads') ?
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

      const buffer = fs.readFileSync(filePath);
      writeFile(cachePath, buffer, Utils.noop);

      return buffer;
    })();

    return true;
  };
};
