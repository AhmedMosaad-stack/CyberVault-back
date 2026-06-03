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
      text: `Hello ${userName},\n\nWelcome to CyberVault Bank! Your ${accountNumber ? `account ${accountNumber}` : `${role} account`} has been successfully created.\n\nHere are your login credentials:\nBank ID: ${bankUserId}\nTemporary Password: ${password}${accountNumber ? `\nAccount Number: ${accountNumber}` : ''}\n\nPlease log in and change your password immediately.\n\nBest regards,\nThe CyberVault Team`,
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
              ${accountNumber ? `<p style="margin: 0 0 5px 0;">Account Number: <strong>${accountNumber}</strong></p>` : ''}
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
