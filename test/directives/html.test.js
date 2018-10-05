const BaseDirective = require('../../lib/directives/base');
const HTMLDirective = require('../../lib/directives/html')(BaseDirective);

const vanilla = new HTMLDirective();

describe('.constructor', () => {
  test('sets editor=wysiwyg by default', () => {
    expect(vanilla.options.editor).toEqual('wysiwyg');
  });
});

describe('#input', () => {
  test('renders Quill as the WYSIWYG editor', () => {
    expect(vanilla.input()).toMatch(/wysiwyg/);
  });

  test('renders ACE editor if editor=false', () => {
    const directive = new HTMLDirective({ editor: false });
    expect(directive.input()).toMatch(/ace_editor/);
  });
});

describe('#render', () => {
  test('renders Markdown when editor=markdown option is set', () => {
    const directive = new HTMLDirective({ editor: 'markdown' });
    expect(directive.render('# Test')).toMatch(/<h1>Test<\/h1>/);
  });

  test('allows HTML in Markdown', () => {
    const directive = new HTMLDirective({ editor: 'markdown' });
    const html = '# Test <em>HTML</em>';
    expect(directive.render(html)).toMatch(/<h1>Test <em>HTML<\/em><\/h1>/);
  });

  test('removes Quill\'s extra paragraphs', () => {
    const directive = new HTMLDirective();
    const html = '<h2>Testing</h2><p><br></p><p>123</p>';
    const cleaned = html.replace('<p><br></p>', '');
    expect(directive.render(html)).toEqual(cleaned);
  });
});
