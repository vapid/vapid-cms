/**
 * Creates initial User schema
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('records', 'metadata', {
      type: Sequelize.JSON,
      defaultValue: {},
    });
    await queryInterface.addColumn('records', 'slug', {
      type: Sequelize.TEXT,
    });
    await queryInterface.addIndex('records', ['slug'], {
      indicesType: 'UNIQUE',
    });
  },

  down: async queryInterface => [
    queryInterface.removeColumn('records', 'metadata'),
    queryInterface.removeColumn('records', 'slug'),
  ],
};
