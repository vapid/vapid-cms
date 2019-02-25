const BaseDirective = require('../../lib/directives/base');
const DateDirective = require('../../lib/directives/date')(BaseDirective);

const vanilla = new DateDirective();
const date = '2015-10-21';

describe('#input', () => {
  test('renders a date input by default', () => {
    expect(vanilla.input('test')).toMatch(/input type="date"/);
  });

  test('renders a datetime-local input if time=true', () => {
    const directive = new DateDirective({ time: true });
    expect(directive.input('test')).toMatch(/input type="datetime-local"/);
  });

  test('sets the default value to an empty string', () => {
    const directive = new DateDirective();
    expect(directive.input('test')).toMatch(/value=""/);
  });
});

describe('#render', () => {
  test('default date format', () => {
    expect(vanilla.render(date)).toEqual('October 21, 2015');
  });

  test('override date format', () => {
    const directive = new DateDirective({ format: '%D' });
    expect(directive.render(date)).toEqual('10/21/15');
  });
});
