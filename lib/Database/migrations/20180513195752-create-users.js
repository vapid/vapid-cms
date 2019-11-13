/**
 * Creates initial User schema
 */
module.exports = {
  up: async (queryInterface, Sequelize) => [
    queryInterface.createTable('users', {
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

      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      password_digest: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    }),
  ],

  down: async queryInterface => [
    queryInterface.dropTable('users'),
  ],
};
