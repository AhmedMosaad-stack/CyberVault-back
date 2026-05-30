import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    bankUserId: {
      type: DataTypes.STRING(8),
      unique: true,
      allowNull: false,
      comment: '8-digit numeric string, immutable, auto-generated',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
    },
    passwordHash: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'argon2id hash',
    },
    role: {
      type: DataTypes.ENUM('admin', 'employee', 'user'),
      allowNull: false,
    },
    nationalIdEncrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'AES-GCM encrypted',
    },
    nationalIdHash: {
      type: DataTypes.STRING(64),
      unique: true,
      allowNull: true,
      comment: 'HMAC-SHA256 for lookup',
    },
    phoneEncrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'AES-GCM encrypted',
    },
    phoneHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'HMAC-SHA256 for lookup',
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM('male', 'female'),
      allowNull: true,
    },
    departmentName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'employees only',
    },
    departmentRegion: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'employees only',
    },
    departmentRole: {
      type: DataTypes.ENUM('admin', 'employee'),
      allowNull: true,
      comment: 'employees only',
    },
    departmentSince: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'auto-set to createdAt on employee creation',
    },
    departmentStatus: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: true,
      comment: 'auto-set to active on employee creation',
    },
    mustChangePassword: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'true for all new users until first password change',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lockoutUntil: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['bankUserId'] },
      { unique: true, fields: ['email'] },
      { unique: true, fields: ['nationalIdHash'] },
      { fields: ['phoneHash'] },
      { fields: ['role'] },
    ],
  }
);

export default User;
