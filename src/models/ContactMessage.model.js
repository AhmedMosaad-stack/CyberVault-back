import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const ContactMessage = sequelize.define(
  'ContactMessage',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'contact_messages',
    timestamps: true,
    updatedAt: false,
  }
);

export default ContactMessage;
