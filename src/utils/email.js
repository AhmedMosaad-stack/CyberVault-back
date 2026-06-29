import nodemailer from 'nodemailer';
import config from '../config/index.js';
import logger from './logger.js';

// Create a transporter using the SMTP configuration
const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASSWORD,
  },
});

/**
 * Sends a registration email containing the bank user ID and temporary password.
 * @param {string} userEmail The email address of the newly created user
 * @param {string} userName The name of the newly created user
 * @param {string} bankUserId The generated Bank User ID
 * @param {string} password The generated temporary password
 * @param {string} role The role of the user (e.g., 'user', 'employee', 'admin')
 * @param {string} accountNumber The user's account number (optional)
 */
export async function sendRegistrationEmail(userEmail, userName, bankUserId, password, role, accountNumber = null) {
  try {
    const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
    
    const mailOptions = {
      from: `"CyberVault Bank" <${config.SMTP_FROM_EMAIL}>`,
      to: userEmail,
      subject: 'Welcome to CyberVault Bank - Your Account Details',
      text: `Hello ${userName},\n\nWelcome to CyberVault Bank! Your bank ${accountNumber ? `account ${accountNumber}` : `${role} account`} has been successfully created.\n\nHere are your login credentials:\nBank ID: ${bankUserId}\nTemporary Password: ${password}${accountNumber ? `\nAccount Number: ${accountNumber}` : ''}\n\nPlease log in and change your password immediately.\n\nBest regards,\nThe CyberVault Team`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f172a; color: #fff; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Welcome to CyberVault Bank</h2>
          </div>
          <div style="padding: 20px;">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>Your <strong>${accountNumber ? `account ${accountNumber}` : `${roleTitle} account`}</strong> has been successfully created.</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Your Account Details & Credentials:</strong></p>
              <p style="margin: 0 0 5px 0;">Bank ID: <strong>${bankUserId}</strong></p>
              <p style="margin: 0;">Temporary Password: <strong>${password}</strong></p>
            </div>
            <p style="color: #b91c1c; font-weight: bold;">Please log in and change your password immediately.</p>
            <p>Best regards,<br>The CyberVault Team</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info({ messageId: info.messageId, email: userEmail }, 'Registration email sent successfully');
    
    return true;
  } catch (error) {
    logger.error({ err: error, email: userEmail }, 'Failed to send registration email');
    // We don't want to throw the error to prevent blocking user creation
    return false;
  }
}

/**
 * Sends a transaction notification email.
 * @param {string} userEmail The email address of the user
 * @param {string} userName The name of the user
 * @param {string} type The transaction type (e.g., 'credit', 'debit', 'transfer')
 * @param {number} amount The transaction amount
 * @param {string} currency The currency of the transaction
 * @param {number} balanceAfter The account balance after the transaction
 * @param {string} description The transaction description
 */
export async function sendTransactionEmail(userEmail, userName, type, amount, currency, balanceAfter, description = '') {
  try {
    let subject = 'Transaction Alert - CyberVault';
    let actionText = '';
    
    // Determine context based on type
    if (type === 'credit') {
      subject = 'Deposit Received - CyberVault';
      actionText = `A deposit of <strong>${amount} ${currency}</strong> has been credited to your account.`;
    } else if (type === 'debit') {
      subject = 'Withdrawal Alert - CyberVault';
      actionText = `A withdrawal of <strong>${amount} ${currency}</strong> has been debited from your account.`;
    } else if (type === 'transfer_sent') {
      subject = 'Transfer Sent - CyberVault';
      actionText = `You have successfully transferred <strong>${amount} ${currency}</strong>.`;
    } else if (type === 'transfer_received') {
      subject = 'Transfer Received - CyberVault';
      actionText = `You have received a transfer of <strong>${amount} ${currency}</strong>.`;
    } else {
      actionText = `A transaction of <strong>${amount} ${currency}</strong> has been processed on your account.`;
    }

    const mailOptions = {
      from: `"CyberVault Bank" <${config.SMTP_FROM_EMAIL}>`,
      to: userEmail,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f172a; color: #fff; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">CyberVault Transaction Alert</h2>
          </div>
          <div style="padding: 20px;">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>${actionText}</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Transaction Details:</strong></p>
              <p style="margin: 0 0 5px 0;">Amount: <strong>${amount} ${currency}</strong></p>
              ${description ? `<p style="margin: 0 0 5px 0;">Description: <strong>${description}</strong></p>` : ''}
            </div>
            <p>If you did not authorize this transaction, please contact our support team immediately.</p>
            <p>Best regards,<br>The CyberVault Team</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info({ messageId: info.messageId, email: userEmail, type }, 'Transaction email sent successfully');
    
    return true;
  } catch (error) {
    logger.error({ err: error, email: userEmail, type }, 'Failed to send transaction email');
    // Don't throw to prevent blocking the transaction flow
    return false;
  }
}
