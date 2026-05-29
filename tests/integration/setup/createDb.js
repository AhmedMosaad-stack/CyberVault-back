/**
 * Helper script to create bank_test database if it doesn't exist.
 */
import mysql from 'mysql2/promise';
import config from '../../../src/config/index.js';

async function createDb() {
  try {
    const connection = await mysql.createConnection({
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
    });
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.DB_NAME_TEST}\`;`);
    console.log(`Database ${config.DB_NAME_TEST} created or already exists.`);
    await connection.end();
  } catch (err) {
    console.error('Failed to create database', err);
    process.exit(1);
  }
}

createDb();
