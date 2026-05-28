import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const AuditEvent = sequelize.define(
  'AuditEvent',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    actorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    actorRole: {
      type: DataTypes.ENUM('admin', 'employee', 'user'),
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'e.g. LOGIN, CREATE_USER, TRANSFER',
    },
    targetId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    targetType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'e.g. User, Account, Transaction',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'Supports IPv6',
    },
  },
  {
    tableName: 'audit_events',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['actorId'] },
      { fields: ['action'] },
      { fields: ['createdAt'] },
    ],
  }
);

export default AuditEvent;
