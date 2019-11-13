/**
 * Creates initial User schema
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('records', 'template_id', {
      type: Sequelize.INTEGER,
    });
    // await queryInterface.bulkUpdate('templates', { template_id:  }, { multiple: 1 });

    await queryInterface.renameTable('sections', 'templates');

    await queryInterface.addColumn('templates', 'type', {
      type: Sequelize.ENUM('setting', 'collection', 'page', 'form'),
      allowNull: false,
      defaultValue: 'setting',
    });
    await queryInterface.bulkUpdate('templates', { type: 'collection' }, { multiple: 1 });
    await queryInterface.bulkUpdate('templates', { type: 'form' }, { form: 1 });
    await queryInterface.addIndex('templates', {
      fields: ['type', 'name'],
      unique: true,
    });

    await queryInterface.renameColumn('records', 'section_id', 'template_id');
    // await queryInterface.changeColumn('records', 'template_id', {
    //   references: {
    //     model: 'templates',
    //     id: 'id',
    //   },
    //   onUpdate: 'cascade',
    //   onDelete: 'cascade',
    // });

    await queryInterface.removeColumn('templates', 'multiple');
    await queryInterface.removeColumn('templates', 'form');

    // await queryInterface.changeColumn('records', 'template_id', {
    //   references: {
    //     model: 'templates',
    //     id: 'id',
    //   },
    //   onUpdate: 'cascade',
    //   onDelete: 'cascade',
    // });
  },

  down: async queryInterface => [
    queryInterface.dropTable('pages'),
    queryInterface.renameTable('templates', 'sections'),
    queryInterface.removeColumn('sections', 'type'),
    queryInterface.addColumn('sections', 'type'),
    queryInterface.addColumn('sections', 'type'),

  ],
};
