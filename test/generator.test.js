const fs = require('fs');
const tmp = require('tmp');
const { join } = require('path');

const Generator = require('../lib/generator');
const Utils = require('../lib/utils');

let target;

describe('.copyTo', () => {
  beforeAll(() => {
    target = tmp.tmpNameSync();
    Generator.copyTo(target);
  });

  afterAll(() => {
    Utils.removeFiles(target);
  });

  test('generates a secret key', () => {
    const env = fs.readFileSync(join(target, '.env'), 'utf-8');
    expect(env).toMatch(/SECRET_KEY=[a-f0-9]{128}/);
  });

  test('shows an error if the target already exists', () => {
    function copyAgain() {
      Generator.copyTo(target);
    }

    expect(copyAgain).toThrowErrorMatchingSnapshot();
  });
});

describe('.copyEnv', () => {
  test('generates a secret key', () => {
    target = tmp.tmpNameSync();
    Generator.copyEnv(target);

    const env = fs.readFileSync(join(target, '.env'), 'utf-8');
    expect(env).toMatch(/SECRET_KEY=[a-f0-9]{128}/);

    Utils.removeFiles(target);
  });
});
