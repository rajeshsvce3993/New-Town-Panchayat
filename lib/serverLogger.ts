import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'server_process.log');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export type LogCategory =
  | 'LOGIN'
  | 'LOGOUT'
  | 'WORK_ENTRY'
  | 'QUEUE_PROCESS'
  | 'MASTER_UPDATE'
  | 'USER_STATUS_CHANGE'
  | 'BULK_ACTION'
  | 'SCOPE_SYNC'
  | 'SERVER_START';

export interface LogEntryOptions {
  category: LogCategory;
  action: string;
  username?: string;
  userId?: string;
  role?: string;
  townPanchayat?: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';
  details?: string;
  ip?: string;
}

/**
 * Format current timestamp in Indian Standard Time (IST)
 */
function getISTTimestamp(): string {
  try {
    const now = new Date();
    const istString = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return istString.replace(',', '');
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Write a clean, human-readable log line to server_process.log
 * Designed for administrators to easily open and view in Notepad on the server machine.
 */
export function logServerProcess(opts: LogEntryOptions): void {
  try {
    const timestamp = getISTTimestamp();
    const userPart = opts.username ? `User: ${opts.username}${opts.userId ? ` (${opts.userId})` : ''}` : 'System';
    const rolePart = opts.role ? ` | Role: ${opts.role}` : '';
    const tpPart = opts.townPanchayat ? ` | TP: ${opts.townPanchayat}` : '';
    const ipPart = opts.ip ? ` | IP: ${opts.ip}` : '';
    const detailsPart = opts.details ? ` | Details: ${opts.details}` : '';

    const logLine = `[${timestamp} IST] [${opts.category}] [${opts.status}] [${opts.action}] ${userPart}${rolePart}${tpPart}${ipPart}${detailsPart}\n`;

    fs.appendFileSync(LOG_FILE, logLine, 'utf-8');

    // Also mirror to console for dev viewing
    if (process.env.NODE_ENV !== 'production' || opts.status === 'FAILED') {
      console.log(`[ServerLogger] ${logLine.trim()}`);
    }
  } catch (err) {
    console.error('[ServerLogger] Error writing to log file:', err);
  }
}

/**
 * Read the latest N lines from server_process.log for Notepad / Portal viewer
 */
export function readServerProcessLogs(maxLines: number = 500): string {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return '=== server_process.log is currently empty ===\n';
    }
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const recent = lines.slice(-maxLines);
    return recent.join('\n');
  } catch (err: any) {
    return `Error reading log file: ${err?.message || err}`;
  }
}

/**
 * Get raw log file path
 */
export function getLogFilePath(): string {
  return LOG_FILE;
}
