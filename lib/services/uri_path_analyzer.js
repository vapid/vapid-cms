const fs = require('fs');
const { join, resolve } = require('path');

class UriPathAnalyzer {
  /**
   * @param {string} path - request path
   * @param {string} templateDir - local directory, where template files reside
   */
  constructor(path, templateDir) {
    this.path = path;
    this.templateDir = templateDir;
  }

  /**
   * Analyzes request path, and matches it to the corresponding site template
   * Also determines the section name and record ID if necessary
   *
   * @return {[file, sectionName, recordId]}
   */
  perform() {
    const sysPath = join(this.templateDir, this.path);
    let file = null;
    let recordSlug;
    let recordId;
    let sectionName;

    if (fs.existsSync(sysPath)) {
      const stats = fs.statSync(sysPath);

      if (stats.isDirectory()) {
        const dirFile = resolve(sysPath, 'index.html');
        file = fs.existsSync(dirFile) ? dirFile : null;
      } else {
        file = sysPath;
      }
    } else {
      const htmlPath = `${sysPath.replace(/\/$/, '')}.html`;

      if (fs.existsSync(htmlPath)) {
        file = htmlPath;
      } else {
        [sectionName, recordSlug = ''] = this.path.slice(1).split('/');
        recordId = recordSlug.split('-').pop();
        const partial = resolve(this.templateDir, `_${sectionName}.html`);
        const collection = resolve(this.templateDir, `collections/${sectionName}.html`);

        if (fs.existsSync(partial) && recordSlug && !isNaN(recordId)) {
          file = partial;
        } else if (fs.existsSync(collection) && recordSlug && !isNaN(recordId)) {
          file = collection;
        }
      }
    }

    return [file, sectionName, recordId];
  }
}

module.exports = UriPathAnalyzer;
