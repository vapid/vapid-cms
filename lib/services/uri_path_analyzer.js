const fs = require('fs');
const { join, resolve } = require('path');

class UriPathAnalyzer {
  /**
   * @param {string} path - request path
   * @param {string} extension - file name extension
   * @param {string} templateDir - local directory, where template files reside
   */
  constructor(path, extension, templateDir) {
    this.path = path;
    this.extension = extension;
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
    let partial;

    if (fs.existsSync(sysPath)) {
      const stats = fs.statSync(sysPath);

      if (stats.isDirectory()) {
        const dirFile = resolve(sysPath, 'index.html');
        file = fs.existsSync(dirFile) ? dirFile : null;
      } else {
        file = sysPath;
      }
    } else {
      const filePath = `${sysPath.replace(/\/$/, '')}${this.extension}`;

      if (fs.existsSync(filePath)) {
        file = filePath;
      } else {
        [sectionName, recordSlug = ''] = this.path.slice(1).split('/');
        recordId = recordSlug.split('-').pop();
        partial = resolve(this.templateDir, `_${sectionName}.html`);

        if (fs.existsSync(partial) && recordSlug && !isNaN(recordId)) {
          file = partial;
        }
      }
    }

    return [file, sectionName, recordId];
  }
}

module.exports = UriPathAnalyzer;
