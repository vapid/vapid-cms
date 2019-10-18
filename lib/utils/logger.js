/* eslint-disable no-console */
require('colors');

const ARROW = '==>';

/**
 * Decorates console.log statements with colors and symbols
 */
class Logger {
  /**
   * @static
   *
   * General information messages in bold blue, with ==> arrow
   *
   * @param {string} str
   */
  static info(str) {
    console.log(`${ARROW.blue} ${str}`.bold);
  }

  /**
   * @static
   *
   * Warnings in bold yellow
   *
   * @param {string} str
   */
  static warn(str) {
    console.log(`WARNING: ${str}`.bold.yellow);
  }

  /** @static
   *
   * Tagged information
   *
   * @param {string} tag
   * @param {string} str
   */
  static tagged(tag, str, color = 'yellow') {
    const formattedTag = `[${tag}]`[color];
    console.log(`  ${formattedTag} ${str}`);
  }

  /**
   * @static
   *
   * Errors in bold red
   *
   * @param {string} err
   */
  static error(err) {
    console.log(`ERROR: ${err}`.bold.red);
  }

  /**
   * @static
   *
   * Additional information with generic formatting, line returns
   *
   * @param {string|array} lines
   */
  static extra(lines) {
    lines = Array.isArray(lines) ? lines : [lines];
    const combined = lines.join('\n');
    console.log(combined);
  }
}

module.exports = Logger;
