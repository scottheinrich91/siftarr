import path from 'path';
import os from 'os';

// Resolve configuration directory
export const CONFIG_DIR = process.env.SIFTARR_CONFIG_DIR || 
  (process.env.NODE_ENV === 'production' 
    ? '/config' 
    : path.join(os.homedir(), '.config', 'siftarr'));

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
export const NODE_ENV = process.env.NODE_ENV || 'development';
