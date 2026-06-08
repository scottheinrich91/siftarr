import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { CONFIG_DIR } from './config.js';

const LOGS_DIR = path.join(CONFIG_DIR, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  })
);

// Info Log Transports: siftarr.log (captures info, warn, error)
const infoFileTransport = new DailyRotateFile({
  filename: path.join(LOGS_DIR, 'siftarr-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '5',
  level: 'info',
  symlinkName: 'siftarr.log',
  createSymlink: true
});

// Debug Log Transports: siftarr.debug.log (captures debug, info, warn, error)
const debugFileTransport = new DailyRotateFile({
  filename: path.join(LOGS_DIR, 'siftarr-debug-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '5',
  level: 'debug',
  symlinkName: 'siftarr.debug.log',
  createSymlink: true
});

// Trace Log Transports: siftarr.trace.log (captures silly/trace and higher)
const traceFileTransport = new DailyRotateFile({
  filename: path.join(LOGS_DIR, 'siftarr-trace-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '5',
  level: 'silly',
  symlinkName: 'siftarr.trace.log',
  createSymlink: true
});

const logger = winston.createLogger({
  level: 'silly', // Log everything down to silly/trace to transports (which will filter based on their own levels)
  format: logFormat,
  transports: [
    infoFileTransport,
    debugFileTransport,
    traceFileTransport,
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

// Helper trace function to align with other ARR apps
export const trace = (message: string) => {
  logger.silly(message);
};

export const debug = (message: string) => {
  logger.debug(message);
};

export const info = (message: string) => {
  logger.info(message);
};

export const warn = (message: string) => {
  logger.warn(message);
};

export const error = (message: string, err?: any) => {
  if (err instanceof Error) {
    logger.error(`${message}: ${err.message}\n${err.stack}`);
  } else if (err) {
    logger.error(`${message}: ${JSON.stringify(err)}`);
  } else {
    logger.error(message);
  }
};

export default logger;
