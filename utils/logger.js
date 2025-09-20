import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

// Ensure log directory exists with error handling
const logDir = 'logs';
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (error) {
  console.error('Failed to create log directory:', error);
  process.exit(1);
}

// FIXED: Custom levels with proper priority ordering
// Lower numbers = higher priority (error should be most important)
const customLevels = {
  levels: {
    ERROR: 0,   // Highest priority
    WARN: 1,
    INFO: 2,
    success: 3, // Lowest priority
  },
  colors: {
    ERROR: 'red',
    WARN: 'yellow',
    INFO: 'cyan',
    success: 'green',
  },
};

// Tell winston to use these colors for console
winston.addColors(customLevels.colors);

// FIXED: Console format with colors (only for console transport)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(), // Only apply colors for console
  winston.format.printf(({ timestamp, level, message }) => {
    return `${chalk.gray(`[${timestamp}]`)} ${level}: ${message}`;
  })
);

// FIXED: File format without colors (clean text for files)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// Create Winston logger with proper configuration
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: 'success', // FIXED: Set to lowest level to capture all messages
  transports: [
    // Console output with colors
    new winston.transports.Console({
      format: consoleFormat
    }),

    // FIXED: File output without colors, proper level handling
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: fileFormat,
      level: 'success', // Will capture all levels (success, info, warn, error)
      handleExceptions: true,
      maxsize: 5 * 1024 * 1024, // 5MB per file
      maxFiles: 5, // keep 5 backup logs
    }),

    // FIXED: Optional error-only log file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      format: fileFormat,
      level: 'error', // Only error messages
      handleExceptions: true,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
  exitOnError: false,
});

// FIXED: Enhanced error handling and additional utility methods
export const Logger = {
  info: (msg, meta = {}) => logger.log('INFO', msg, meta),
  success: (msg, meta = {}) => logger.log('success', msg, meta),
  warn: (msg, meta = {}) => logger.log('WARN', msg, meta),
  error: (msg, meta = {}) => logger.log('ERROR', msg, meta),

  // Additional utility methods
  level: (newLevel) => {
    if (newLevel) {
      logger.level = newLevel;
    }
    return logger.level;
  },

  // Method to safely log errors with stack traces
  logError: (error, context = '') => {
    const errorMessage = context ? `${context}: ${error.message}` : error.message;
    logger.log('error', errorMessage, {
      stack: error.stack,
      name: error.name
    });
  }
};

// FIXED: Handle unhandled promise rejections and uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'exceptions.log'),
    format: fileFormat
  })
);

logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'rejections.log'),
    format: fileFormat
  })
);