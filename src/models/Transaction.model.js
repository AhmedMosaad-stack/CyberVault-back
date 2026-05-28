import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Transaction = sequelize.define(
  'Transaction',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('credit', 'debit', 'transfer'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.ENUM('EGP', 'USD', 'EUR'),
      allowNull: false,
    },
    fromAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'NULL for credit transactions',
    },
    toAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'NULL for debit transactions',
    },
    initiatedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'FK to users(id) — who triggered the transaction',
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Balance of the primary affected account after tx',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('completed', 'failed'),
      allowNull: false,
      defaultValue: 'completed',
    },
  },
  {
    tableName: 'transactions',
    timestamps: true,
    updatedAt: false, // Transactions are immutable once written
    indexes: [
      { fields: ['fromAccountId', 'createdAt'] },
      { fields: ['toAccountId', 'createdAt'] },
      { fields: ['type'] },
      { fields: ['createdAt'] },
    ],
  }
);

export default Transaction;
