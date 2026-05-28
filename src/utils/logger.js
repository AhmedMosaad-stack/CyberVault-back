import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from '../config/index.js';

// ESM-compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// pino and pino-roll are CommonJS packages; use createRequire for compatibility
const require = createRequire(import.meta.url);
const pino = require('pino');

const targets = [
  // Always log to stdout
  {
    target: 'pino/file',
    options: { destination: 1 }, // stdout
    level: config.LOG_LEVEL,
  },
  // Always log to file with daily rotation
  {
    target: 'pino-roll',
    options: {
      file: join(__dirname, '../../logs/app.log'),
      frequency: 'daily',
      limit: { count: 7 },
      mkdir: true,
    },
    level: config.LOG_LEVEL,
  },
];

const logger = pino({
  level: config.LOG_LEVEL,
  transport: {
    targets,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
