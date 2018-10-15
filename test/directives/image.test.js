const BaseDirective = require('../../lib/directives/base');
const ImageDirective = require('../../lib/directives/image')(BaseDirective);

const vanilla = new ImageDirective();

describe('.constructor', () => {
  test('sets multiple=false by default', () => {
    expect(vanilla.options.multiple).toBeFalsy();
  });

  test('accepts a multiple attribute', () => {
    const directive = new ImageDirective({ multiple: true });
    expect(directive.options.multiple).toBeTruthy();
  });
});

describe('#input', () => {
  test('renders a file/hidden input combo by default', () => {
    const input = vanilla.input('test');
    expect(input).toMatch(/input type="file"/);
    expect(input).toMatch(/input type="hidden"/);
  });

  test('renders a preview if a value is present', () => {
    expect(vanilla.input('test', 'test.jpg')).toMatch(/class="preview"/);
    expect(vanilla.input('test')).not.toMatch(/class="preview"/);
  });

  test('renders a delete checkbox if the image can be destroyed', () => {
    // Non-required images can be deleted
    const directive = new ImageDirective({ required: false });

    expect(directive.input('test', 'test.jpg')).toMatch(/input type="checkbox"/);
    expect(directive.input('test')).not.toMatch(/input type="checkbox"/);

    expect(vanilla.input('test', 'test.jpg')).not.toMatch(/input type="checkbox"/);
    expect(vanilla.input('test')).not.toMatch(/input type="checkbox"/);
  });

  test('renders an add button if there can be multiple images', () => {
    const directive = new ImageDirective({ multiple: true });
    expect(directive.input('test')).toMatch(/Add new/);
  });

  test('renders all images from the array', () => {
    const directive = new ImageDirective({ multiple: true });
    const input = directive.input(['img1', 'img2']);
    expect(input).toMatch(/img1/);
    expect(input).toMatch(/img2/);
  });
});

describe('#render', () => {
  test('returns null if no fileName is present', () => {
    expect(vanilla.render()).toBeNull();
  });

  test('renders an <img> tag by default', () => {
    expect(vanilla.render('test.jpg')).toMatch(/<img src=/);
  });

  test('returns the image src if tag=false', () => {
    const directive = new ImageDirective({ tag: false });
    expect(directive.render('test.jpg')).toEqual('/uploads/test.jpg');
  });

  test('accepts a class option', () => {
    const directive = new ImageDirective({ class: 'test' });
    expect(directive.render('test.jpg')).toMatch(/class="test"/);
  });

  test('accepts an alt option', () => {
    const directive = new ImageDirective({ alt: 'Testing' });
    expect(directive.render('test.jpg')).toMatch(/alt="Testing"/);
  });

  test('renders multiple images if multiple is true', () => {
    const directive = new ImageDirective({ multiple: true });
    const render = directive.render(['img1', 'img2']);
    expect(/(<img src=)/.exec(render).length).toEqual(2);
  });
});
