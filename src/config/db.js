import { Sequelize } from 'sequelize';
import config from './index.js';


const sequelize = new Sequelize(config.DB_NAME, config.DB_USER, config.DB_PASSWORD, {
  host: config.DB_HOST,
  port: config.DB_PORT,
  dialect: 'mysql',
  logging: false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: {
    decimalNumbers: true, // return DECIMAL columns as JS numbers, not strings
  },
});

/**
 * Authenticate and sync the database.
 * Creates tables that do not exist. Does NOT alter or drop existing tables.
 */
async function connectDB() {
  await sequelize.authenticate();


  await sequelize.sync({ force: false, alter: false });

}

/**
 * Run a callback inside a SERIALIZABLE transaction. Rolls back automatically if
 * the callback throws.
 *
 * @param {Function} callback - receives the Sequelize transaction object `t`
 * @returns {*} the callback's result
 */
function withTransaction(callback) {
  return sequelize.transaction(
    { isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    callback
  );
}

export { sequelize, connectDB, withTransaction };
