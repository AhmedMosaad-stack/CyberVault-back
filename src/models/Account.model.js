import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Account = sequelize.define(
  'Account',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: false,
      comment: 'One account per user — enforced at DB level',
    },
    accountNumberEncrypted: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'AES-GCM encrypted 14-digit number',
    },
    accountNumberHash: {
      type: DataTypes.STRING(64),
      unique: true,
      allowNull: false,
      comment: 'HMAC-SHA256 for lookup',
    },
    accountType: {
      type: DataTypes.ENUM('saving', 'current', 'business'),
      allowNull: false,
    },
    currency: {
      type: DataTypes.ENUM('EGP', 'USD', 'EUR'),
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    accountStatus: {
      type: DataTypes.ENUM('active', 'inactive', 'frozen'),
      allowNull: false,
      defaultValue: 'active',
    },
  },
  {
    tableName: 'accounts',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['userId'] },
      { unique: true, fields: ['accountNumberHash'] },
      { fields: ['currency'] },
    ],
  }
);

export default Account;
