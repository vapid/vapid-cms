const bcrypt = require('bcrypt');
const crypto = require('crypto');

module.exports = (sequelize, DataTypes) => {
  /*
   * User model for authentication
   */
  const User = sequelize.define('User', {
    /**
     * Attributes
     */
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true,
        len: [3, 255],
      },
    },

    password_digest: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true,
      },
    },

    password: {
      type: DataTypes.VIRTUAL,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [6, 255],
      },
    },
  }, {
    /**
     * Getter methods
     */
    getterMethods: {
      gravatar: function gravatar() {
        const hash = crypto.createHash('md5').update(this.email).digest('hex');
        return `https://www.gravatar.com/avatar/${hash}?d=mp`;
      },
    },

    /**
     * Hooks
     */
    hooks: {
      /**
       * Encrypt password, so we don't store as plain text
       *
       * @params {User}
       */
      beforeSave: (user) => {
        /* eslint-disable no-param-reassign */
        user.email = user.email.toLowerCase();
        user.password_digest = bcrypt.hashSync(user.password, 10);
        /* eslint-enable no-param-reassign */
      },
    },

    /**
     * Options
     */
    underscored: true,
    tableName: 'users',
    timestamps: true,
    indexes: [{ unique: true, fields: ['email'] }],
  });

  /*
   * INSTANCE METHODS
   */

  /**
   * Compares a plain text password to an encrypted one stored in the DB
   *
   * @param {string} password - unencryped
   * @return {boolean} result of the comparison
   */
  User.prototype.authenticate = function authenticate(password) {
    if (bcrypt.compareSync(password, this.password_digest)) {
      return this;
    }

    return false;
  };

  return User;
};
