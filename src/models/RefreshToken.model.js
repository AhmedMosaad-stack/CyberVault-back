import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const RefreshToken = sequelize.define(
  'RefreshToken',
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
    tokenHash: {
      type: DataTypes.STRING(64),
      unique: true,
      allowNull: false,
      comment: 'SHA-256 of raw JWT',
    },
    family: {
      type: DataTypes.STRING(36),
      allowNull: false,
      comment: 'UUID shared across one login session rotations',
    },
    isRevoked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    replacedByHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'Hash of the next token in the chain',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: 'refresh_tokens',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { unique: true, fields: ['tokenHash'] },
      { fields: ['userId', 'family'] },
      { fields: ['expiresAt'] },
    ],
  }
);

export default RefreshToken;
