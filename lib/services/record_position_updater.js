class RecordPositionUpdater {
  constructor(record, from = null, to = null, nav = null) {
    this.record = record;
    this.from = parseInt(from, 10);
    this.to = parseInt(to, 10);
    this.nav = !!(nav === 'true' || nav === true);
  }

  async perform(db) {
    this.template = this.record.template || await this.record.getTemplate();
    const templateType = this.template.get('type');
    if (templateType === 'page') {
      const pages = await db.models.Template.scope('pages').findAll({ include: [{ all: true }] });
      this.siblings = [];
      for (const page of pages) {
        this.siblings = [...this.siblings, ...page.records];
      }
    }
    else if (templateType === 'collection') {
      this.siblings = await this.template.getRecords({ order: [['position', 'ASC']] });
    }

    if (isNaN(this.from) && isNaN(this.to)) {
      await this._append();
    } else {
      await this._reorder();
      if (typeof this.nav === 'boolean') {
        const metadata = this.record.get('metadata');
        metadata.navigation = this.nav;
        await this.record.update({ metadata });
      }
    }
  }

  async _append() {
    const maxPosition = this.siblings.map(s => s.get('position')).sort().pop();
    return this.record.update({ position: maxPosition + 1 });
  }

  async _reorder() {
    const startPos = this.to === 0 ? 0 : this.siblings[this.to].get('position') + 1;
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
