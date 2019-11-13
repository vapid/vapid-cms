const { readFileSync } = require('fs');
const { resolve } = require('path');
const TemplateCompiler = require('../lib/TemplateCompiler');

/**
 * Constructor
 */
describe('.constructor', () => {
  test('replaces partial with file contents', () => {
    const partials = [resolve(__dirname, 'fixtures', '_partial.html')];
    const partialContent = readFileSync(partials[0], 'utf-8');
    const template = new TemplateCompiler('{{> partial}}', { partial: partialContent });

    expect(template.html).toEqual(partialContent);
  });

  test('allows partials within partials', () => {
    const partials = {
      outer: '{{> inner}}',
      inner: 'inner content',
    };
    const template = new TemplateCompiler('{{> outer}}', partials);

    expect(template.html).toEqual(partials.inner);
  });
});

/**
 * TemplateCompiler.fromFile
 */
describe('.fromFile', () => {
  test('creates new instance from a file path', () => {
    const filePath = resolve(__dirname, 'fixtures/basic.html');
    const template = TemplateCompiler.fromFile(filePath);
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
    const template = TemplateCompiler.fromFile(filePath, basePath, partials);

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
    const tree = new TemplateCompiler(html).parse();

    expect(tree).toMatchSnapshot();
  });

  test('allow sections without keyword', () => {
    const withKeyword = new TemplateCompiler('{{#section about}}{{/section}}').parse();
    const withoutKeyword = new TemplateCompiler('{{#about}}{{/about}}').parse();

    expect(withKeyword['section about'].name).toEqual(withoutKeyword.about.name);
  });

  /* eslint-disable quotes */
  test('parses parameters with optional quotes', () => {
    const plain = new TemplateCompiler('{{test required=false}}').parse();
    const single = new TemplateCompiler(`{{test required='false'}}`).parse();
    const double = new TemplateCompiler('{{test required="false"}}').parse();

    expect(plain.general.fields['test required=false'].params).toEqual(single.general.fields[`test required='false'`].params);
    expect(plain.general.fields['test required=false'].params).toEqual(double.general.fields['test required="false"'].params);
  });

  test('parses parameters with escaped quotes', () => {
    const inTheMiddle = new TemplateCompiler(`{{test placeholder="Testing \\"quotes\\" in the middle."}}`).parse();
    const mixed = new TemplateCompiler(`{{test placeholder="If this'll work"}}`).parse();

    expect(inTheMiddle).toMatchSnapshot();
    expect(mixed).toMatchSnapshot();
  });
  /* eslint-enable quotes */

  test('parses order by clause', () => {
    const orderBy = new TemplateCompiler('{{#section offices order=city,-name}}{{/section}}').parse();
    expect(orderBy).toMatchSnapshot();
  });

  test('parses conditionals', () => {
    const conditional = '{{#if foo}}Foo{{/if}}';

    expect(new TemplateCompiler(conditional).parse()).toMatchSnapshot();
    expect(new TemplateCompiler(
      conditional,
      {},
    ).parse()).toMatchSnapshot();
  });

  test('parses general references in sections correctly', () => {
    const template = new TemplateCompiler(`
      {{test}}
      {{#section child}}{{general.test}}{{/section}}
    `).parse();

    expect(Object.keys(template.general.fields)).toEqual(['test']);
    expect(Object.keys(template['section child'].fields)).toEqual(['general.test']);
  });
});

/**
 * template.render
 */
describe('#render', () => {
  test('replaces tags with content', () => {
    const template = new TemplateCompiler('Hello, {{name}}.');
    const rendered = template.render({ general: { name: 'World' } });

    expect(rendered).toMatchSnapshot();
  });

  test('replaces general references in sections with content', () => {
    const template = new TemplateCompiler(`
      {{greeting}} General
      {{#section child}}{{general.greeting}} Section{{/section}}
    `);
    const rendered = template.render({
      general: {
        greeting: 'Hello',
      },
      'section child': {
        'general.greeting': 'Hello',
      },
    });

    expect(rendered).toMatchSnapshot();
  });
});
