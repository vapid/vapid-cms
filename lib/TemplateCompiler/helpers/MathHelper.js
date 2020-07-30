
const eq = {
  div: (a, b) => a / b,
  mult: (a, b) => a * b,
  mod: (a, b) => a % b,
  sum: (a, b) => a + b,
  minus: (a, b) => a - b,
  min: (a, b) => Math.min(a, b),
  max: (a, b) => Math.max(a, b),
  ceil: a => Math.ceil(a),
  floor: a => Math.floor(a),
};

module.exports = class MathHelper {
  static run(method, a, b) {
    console.log(method, a, b);
    return eq[method](a, b);
  }

  static blockParam() { return undefined; }
};
