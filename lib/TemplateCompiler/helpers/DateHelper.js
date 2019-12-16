
module.exports = class DateHelper {
  static run(value) {
    return value ? value.toLocaleString('en-us', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }) : '';
  }

  static blockParam() { return undefined; }
};
