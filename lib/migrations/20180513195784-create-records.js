/**
 * Creates initial Record schema
 */
module.exports = {
  up: async (queryInterface, Sequelize) => [
    queryInterface.createTable('records', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      created_at: {
        type: Sequelize.DATE,
      },

      updated_at: {
        type: Sequelize.DATE,
      },

      content: {
        type: Sequelize.JSON,
        defaultValue: {},
      },

      section_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'sections',
          key: 'id',
        },
        allowNull: false,
        onUpdate: 'cascade',
        onDelete: 'cascade',
      },
    }),
  ],

  down: async queryInterface => [
    queryInterface.dropTable('records'),
  ],
};
