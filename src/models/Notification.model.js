import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Notification = sequelize.define(
  'Notification',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(
        'account_created',
        'password_changed',
        'credit',
        'debit',
        'transfer'
      ),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    relatedId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'FK to transaction id or user id depending on type',
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'notifications',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['userId', 'isRead'] }],
  }
);

export default Notification;
