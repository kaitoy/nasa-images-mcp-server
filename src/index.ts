import dotenv from 'dotenv';
import { SessionManager } from './session-manager.js';
import { startHttpServer } from './http-server.js';
import { startStdioServer } from './stdio-server.js';

dotenv.config();

const sessionManager = new SessionManager();

if (process.argv.includes('--stdio')) {
  startStdioServer(sessionManager).catch((err: unknown) => {
    process.stderr.write(`Failed to start stdio server: ${err}\n`);
    process.exit(1);
  });
} else {
  startHttpServer(sessionManager);
}
