const fs = require('fs');
const { resolve } = require('path');
const tmp = require('tmp');

const Builder = require('../lib/Database/Builder');
const { Utils } = require('../lib/utils');

const templatesDir = resolve(__dirname, 'fixtures', 'builder');

describe('#tree', () => {
  test('creates tree from multiple files', () => {
    const builder = new Builder(templatesDir);

    expect(builder.tree).toMatchSnapshot();
  });

  test('picks up on changes to the template directory', () => {
    const tmpDir = tmp.tmpNameSync();
    Utils.copyFiles(templatesDir, tmpDir);

    const builder = new Builder(tmpDir);
    expect(builder.tree).toMatchSnapshot();

    const newHTML = `
      {{#section offices}}
        {{name}}
        {{phone}}
      {{/section}}
    `;
    fs.writeFileSync(resolve(tmpDir, 'new.html'), newHTML);
    expect(builder.tree).toMatchSnapshot();

    Utils.removeFiles(tmpDir);
  });

  test('correctly creates fields in general when only referenced in a section', () => {
    const tmpDir = tmp.tmpNameSync();
    Utils.copyFiles(templatesDir, tmpDir);

    const newHTML = `
      {{foo}}
      {{#section child}}{{general.bar}}{{/section}}
    `;
    fs.writeFileSync(resolve(tmpDir, 'new.html'), newHTML);

    const builder = new Builder(tmpDir);

    expect(Object.keys(builder.tree.general.fields)).toEqual(["name", "foo", "bar"]);
    expect(Object.keys(builder.tree.child.fields)).toEqual([]);

    Utils.removeFiles(tmpDir);

  });
});

describe('#build', () => {
  // test.skip();
});

describe('#isDirty', () => {
  // test.skip();
});
