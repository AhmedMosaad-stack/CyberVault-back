import { sequelize } from '../config/db.js';

import User from './User.model.js';
import Account from './Account.model.js';
import Transaction from './Transaction.model.js';
import RefreshToken from './RefreshToken.model.js';
import Notification from './Notification.model.js';
import AuditEvent from './AuditEvent.model.js';
import ContactMessage from './ContactMessage.model.js';

// ─── Associations ────────────────────────────────────────────────

// User ↔ Account (one-to-one)
User.hasOne(Account, { foreignKey: 'userId', onDelete: 'RESTRICT' });
Account.belongsTo(User, { foreignKey: 'userId' });

// User → Transactions (one-to-many via initiatedBy)
User.hasMany(Transaction, { foreignKey: 'initiatedBy', onDelete: 'RESTRICT' });
Transaction.belongsTo(User, { foreignKey: 'initiatedBy', as: 'initiator' });

// Account → Transactions (from/to)
Transaction.belongsTo(Account, {
  as: 'fromAccount',
  foreignKey: 'fromAccountId',
  onDelete: 'RESTRICT',
});
Transaction.belongsTo(Account, {
  as: 'toAccount',
  foreignKey: 'toAccountId',
  onDelete: 'RESTRICT',
});
Account.hasMany(Transaction, { foreignKey: 'fromAccountId', as: 'outgoingTransactions' });
Account.hasMany(Transaction, { foreignKey: 'toAccountId', as: 'incomingTransactions' });

// User → RefreshTokens (one-to-many)
User.hasMany(RefreshToken, { foreignKey: 'userId', onDelete: 'RESTRICT' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

// User → Notifications (one-to-many)
User.hasMany(Notification, { foreignKey: 'userId', onDelete: 'RESTRICT' });
Notification.belongsTo(User, { foreignKey: 'userId' });

// User → AuditEvents (one-to-many)
User.hasMany(AuditEvent, { foreignKey: 'actorId', onDelete: 'RESTRICT' });
AuditEvent.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

// ─── Export all models + sequelize ───────────────────────────────

export {
  sequelize,
  User,
  Account,
  Transaction,
  RefreshToken,
  Notification,
  AuditEvent,
  ContactMessage,
};
