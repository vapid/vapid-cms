const { Logger } = require('../lib/utils');

let output;

global.console.log = jest.fn((value) => {
  output = value;
  return value;
});

describe('.extra', () => {
  test('accepts a string', () => {
    const line = 'Lorem ipsum';
    Logger.extra(line);
    expect(output).toEqual(line);
  });

  test('accepts an array', () => {
    const lines = ['Lorem ipsum', 'dolor sit amet'];
    Logger.extra(lines);
    expect(output).toEqual(lines.join('\n'));
  });
});
