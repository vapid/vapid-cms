/**
 * Creates initial Section schema
 */
module.exports = {
  up: async (queryInterface, Sequelize) => [
    queryInterface.createTable('sections', {
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

      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      form: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      multiple: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      options: {
        type: Sequelize.JSON,
        defaultValue: {},
      },

      fields: {
        type: Sequelize.JSON,
        defaultValue: {},
      },
    }),
  ],

  down: async queryInterface => [
    queryInterface.dropTable('sections'),
  ],
};
