const IfHelper = require('./IfHelper');

module.exports = class UnlessHelper {
  static run(input, ...args) {
    let condition = input;
    if (`${condition}`.startsWith('data:')) { condition = false; }
    return IfHelper.run.call(this, !condition, ...args);
  }

  static blockParam() { return undefined; }
};
