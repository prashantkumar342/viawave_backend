import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

// Ensure log directory exists
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Custom levels and colors
const customLevels = {
  levels: {
    success: 0,
    info: 1,
    warn: 2,
    error: 3,
  },
  colors: {
    success: 'green',
    info: 'cyan',
    warn: 'yellow',
    error: 'red',
  },
};

// Tell winston to use these colors for console
winston.addColors(customLevels.colors);

// Common format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    const color = customLevels.colors[level] || 'white';
    return `${chalk.gray(`[${timestamp}]`)} ${chalk[color](level.toUpperCase())}: ${message}`;
  })
);

// File-safe format (no colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// Create Winston logger
const logger = winston.createLogger({
  levels: customLevels.levels,
  transports: [
    // Console output with colors
    new winston.transports.Console({ format }),

    // File output
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: fileFormat,
      level: 'info', // log info and below (info, success, warn, error)
      handleExceptions: true,
      maxsize: 5 * 1024 * 1024, // 5MB per file
      maxFiles: 5, // keep 5 backup logs
    }),
  ],
  exitOnError: false,
});

// Export the logger API
export const Logger = {
  info: (msg) => logger.log('info', msg),
  success: (msg) => logger.log('success', msg),
  warn: (msg) => logger.log('warn', msg),
  error: (msg) => logger.log('error', msg),
};
