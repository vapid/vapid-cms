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
      this.siblings.sort((a, b) => (a.position > b.position ? 1 : -1));
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
        metadata.isNavigation = this.nav;
        await this.record.update({ metadata });
      }
    }
  }

  async _append() {
    const maxPosition = this.siblings.map(s => s.get('position')).sort().pop();
    return this.record.update({ position: maxPosition + 1 });
  }

  async _reorder() {
    const items = this.siblings.filter(obj => obj.id !== this.record.id);
    items.splice(this.to, 0, this.record);
    const promises = [];
    items.forEach((item, position) => {
      const promise = item.update({ position });
      promises.push(promise);
    });

    await Promise.all(promises);
  }
}

module.exports = RecordPositionUpdater;
