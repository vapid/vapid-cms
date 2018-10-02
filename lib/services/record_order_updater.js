class RecordOrderUpdater {
  static async moveFromTo(record, from, to) {
    const section = await RecordOrderUpdater._getSection(record);
    const sectionRecords = await RecordOrderUpdater._getSectionRecords(section);
    await RecordOrderUpdater._reorder(sectionRecords, parseInt(from, 10), parseInt(to, 10));
  }

  static async fixOrdering(section) {
    const sectionRecords = await RecordOrderUpdater._getSectionRecords(section);
    await RecordOrderUpdater._updatePositions(sectionRecords, sectionRecords.length - 1);
  }

  static async _getSection(record) {
    return record.section || record.getSection();
  }

  static async _getSectionRecords(section) {
    return section.getRecords({ order: [['position', 'DESC']] });
  }

  static async _reorder(sectionRecords, from, to) {
    let positionStart;
    let recordsToUpdate;

    // Moving a record up in the section
    if (from > to) {
      positionStart = sectionRecords[to].position;
      recordsToUpdate = sectionRecords.slice(to, from + 1);

      // Move the last to the first
      const record = recordsToUpdate.pop();
      recordsToUpdate.unshift(record);

    // Moving a record down in the section
    } else {
      positionStart = sectionRecords[from].position;
      recordsToUpdate = sectionRecords.slice(from, to + 1);

      // Move the first to the last
      const record = recordsToUpdate.shift();
      recordsToUpdate.push(record);
    }

    await RecordOrderUpdater._updatePositions(recordsToUpdate, positionStart);
  }

  static async _updatePositions(recordsToUpdate, positionStart) {
    let position = positionStart;
    const promises = [];
    recordsToUpdate.forEach((item) => {
      const promise = item.update({ position });
      promises.push(promise);
      position -= 1;
    });

    await Promise.all(promises);
  }
}

module.exports = RecordOrderUpdater;
