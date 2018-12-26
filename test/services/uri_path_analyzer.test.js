const { resolve } = require('path');
const UriPathAnalyzer = require('../../lib/services/uri_path_analyzer');

const templateDir = resolve(__dirname, '../fixtures/site/www');

describe('#perform', () => {
  test('finds from the path', () => {
    const analyzer = new UriPathAnalyzer('/', templateDir);
    const templatePath = resolve(templateDir, 'index.html');
    expect(analyzer.perform()[0]).toEqual(templatePath);
  });

  test('finds without .html', () => {
    const templatePath = resolve(templateDir, 'about.html');
    let analyzer;

    // Without trailing slash
    analyzer = new UriPathAnalyzer('/about', templateDir);
    expect(analyzer.perform()[0]).toEqual(templatePath);

    // With trailing slash
    analyzer = new UriPathAnalyzer('/about/', templateDir);
    expect(analyzer.perform()[0]).toEqual(templatePath);
  });

  test('finds index.html inside subfolder', () => {
    const analyzer = new UriPathAnalyzer('/contact', templateDir);
    const templatePath = resolve(templateDir, 'contact/index.html');
    expect(analyzer.perform()[0]).toEqual(templatePath);
  });

  test('extracts sectionName and recordId', () => {
    // Old format
    let results = new UriPathAnalyzer('/offices/123/testing', templateDir).perform();
    expect(results[1]).toEqual('offices');
    expect(results[2]).toEqual('123');

    // New format
    results = new UriPathAnalyzer('/offices/testing-123', templateDir).perform();
    expect(results[1]).toEqual('offices');
    expect(results[2]).toEqual('123');

    // Titleless
    results = new UriPathAnalyzer('/offices/123', templateDir).perform();
    expect(results[1]).toEqual('offices');
    expect(results[2]).toEqual('123');

    // Invalid
    results = new UriPathAnalyzer('/offices', templateDir).perform();
    expect(results[0]).toBeNull();
  });
});
