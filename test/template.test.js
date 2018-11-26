const { readFileSync } = require('fs');
const { resolve } = require('path');
const Template = require('../lib/template');

/**
 * Constructor
 */
describe('.constructor', () => {
  test('replaces partial with file contents', () => {
    const partials = [resolve(__dirname, 'fixtures', '_partial.html')];
    const partialContent = readFileSync(partials[0], 'utf-8');
    const template = new Template('{{> partial}}', { partial: partialContent });

    expect(template.html).toEqual(partialContent);
  });

  test('allows partials within partials', () => {
    const partials = {
      outer: '{{> inner}}',
      inner: 'inner content',
    };
    const template = new Template('{{> outer}}', partials);

    expect(template.html).toEqual(partials.inner);
  });
});

/**
 * Template.fromFile
 */
describe('.fromFile', () => {
  test('creates new instance from a file path', () => {
    const filePath = resolve(__dirname, 'fixtures/basic.html');
    const template = Template.fromFile(filePath);
    const html = readFileSync(filePath, 'utf-8');

    expect(html).toEqual(template.html);
  });

  test('reads partials from disk', () => {
    const basePath = resolve(__dirname, 'fixtures');
    const filePath = resolve(basePath, 'with_partials.html');
    const partials = [
      resolve(basePath, '_partial.html'),
      resolve(basePath, 'subdirectory/_partial.html'),
    ];
    const template = Template.fromFile(filePath, basePath, partials);

    expect(template.render()).toMatchSnapshot();
  });
});

/**
 * template.parse
 */
describe('#parse', () => {
  test('puts fields into separate branches', () => {
    const html = `
      {{name}}
      {{#section about}}
        {{name}}
        {{bio}}
      {{/section}}`;
    const tree = new Template(html).parse();

    expect(tree).toMatchSnapshot();
  });

  test('allow sections without keyword', () => {
    const withKeyword = new Template('{{#section about}}{{/section}}').parse();
    const withoutKeyword = new Template('{{#about}}{{/about}}').parse();

    expect(withKeyword['section about'].name).toEqual(withoutKeyword.about.name);
  });

  /* eslint-disable quotes */
  test('parses parameters with optional quotes', () => {
    const plain = new Template('{{test required=false}}').parse();
    const single = new Template(`{{test required='false'}}`).parse();
    const double = new Template('{{test required="false"}}').parse();

    expect(plain.general.fields['test required=false']).toEqual(single.general.fields[`test required='false'`]);
    expect(plain.general.fields['test required=false']).toEqual(double.general.fields['test required="false"']);
  });

  test('parses parameters with escaped quotes', () => {
    const inTheMiddle = new Template(`{{test placeholder="Testing \\"quotes\\" in the middle."}}`).parse();
    const mixed = new Template(`{{test placeholder="If this'll work"}}`).parse();

    expect(inTheMiddle).toMatchSnapshot();
    expect(mixed).toMatchSnapshot();
  });
  /* eslint-enable quotes */

  test('parses order by clause', () => {
    const orderBy = new Template('{{#section offices order=city,-name}}{{/section}}').parse();
    expect(orderBy).toMatchSnapshot();
  });

  test('parses conditionals', () => {
    const conditional = '{{#if foo}}Foo{{/if}}';

    expect(new Template(conditional).parse()).toMatchSnapshot();
    expect(new Template(conditional, {}, { parseConditionals: true }).parse()).toMatchSnapshot();
  });
});

/**
 * template.render
 */
describe('#render', () => {
  test('replaces tags with content', () => {
    const template = new Template('Hello, {{name}}.');
    const rendered = template.render({ general: { name: 'World' } });

    expect(rendered).toMatchSnapshot();
  });
});
