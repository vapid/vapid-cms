const RecordPositionUpdater = require('../../lib/services/record_position_updater');
const { SectionFactory } = require('../factories');

let section;
let record;

describe('#perform', () => {
  beforeAll(async () => {
    section = await SectionFactory({
      sortable: true,
      records: [{}, {}, {}],
    }, {
      include: ['records'],
    });

    record = await section.createRecord({});
  });

  test('appends new records', async () => {
    await new RecordPositionUpdater(record).perform();

    const records = await section.getRecords();
    const ids = records.map(r => r.id);
    expect(ids.pop()).toEqual(record.id);
  });

  test('moves record at a specific point', async () => {
    await new RecordPositionUpdater(record, 3, 1).perform();

    const records = await section.getRecords();
    const ids = records.map(r => r.id);
    expect(ids[1]).toEqual(record.id);
  });
});
