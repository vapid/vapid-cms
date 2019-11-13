const recursive = require('recursive-readdir');
const { resolve, relative } = require('path');
const tmp = require('tmp');

const VapidBuilder = require('../lib/runners/VapidBuilder');
const { Utils } = require('../lib/utils');

const templatesDir = resolve(__dirname, 'fixtures', 'site');

describe('VapidBuilder', () => {
  test('builds a static site when pointed at a site directory', async () => {
    const inputDir = tmp.tmpNameSync();
    Utils.copyFiles(templatesDir, inputDir);

    const builder = new VapidBuilder(inputDir);
    const outputDir = tmp.tmpNameSync();
    await builder.build(outputDir);

    const fileList = (await recursive(outputDir)).map(f => relative(outputDir, f)).sort();
    expect(fileList).toEqual([
      'about.html',
      'contact.html',
      'favicon.ico',
      'images/test.gif',
      'images/test.jpg',
      'images/test.png',
      'images/test.webp',
      'index.html',
      'javascripts/script.js',
      'javascripts/script.js.map',
      'stylehseets/styles.css',
      'stylehseets/styles.css.map',
      'uploads/test.txt',
    ]);

    Utils.removeFiles(inputDir);
    Utils.removeFiles(outputDir);
  });
});
