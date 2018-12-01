const Utils = require('../utils');

class RecordPositionUpdater {
  constructor(record, from = null, to = null) {
    this.record = record;
    this.from = parseInt(from, 10);
    this.to = parseInt(to, 10);
  }

  async perform() {
    this.section = await this._getSection();
    this.siblings = await this._getSiblings();

    if (Utils.isNaN(this.from) && Utils.isNaN(this.to)) {
      await this._append();
    } else {
      await this._reorder();
    }
  }

  async _getSection() {
    return this.record.section || this.record.getSection();
  }

  async _getSiblings() {
    return this.section.getRecords({ order: [['position', 'ASC']] });
  }

  async _append() {
    const maxPosition = Utils.chain(this.siblings).map(s => s.position).max().value();

    return this.record.update({ position: maxPosition + 1 });
  }

  async _reorder() {
    const startPos = this.to === 0 ? 0 : this.siblings[this.to].position + 1;
    let sliceStart;
    let sliceEnd;

    if (this.from > this.to) {
      sliceStart = this.to;
      sliceEnd = this.from;
    } else {
      sliceStart = this.to + 1;
      sliceEnd = this.siblings.length;
    }

    const items = this.siblings.slice(sliceStart, sliceEnd);
    const promises = [];

    items.unshift(this.record);

    items.forEach((item, index) => {
      const promise = item.update({ position: startPos + index });
      promises.push(promise);
    });

    await Promise.all(promises);
  }
}

module.exports = RecordPositionUpdater;
