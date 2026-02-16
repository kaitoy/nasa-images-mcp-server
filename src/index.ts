import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { randomUUID } from 'crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { createMCPServer } from './mcp-server.js';
import { SessionManager } from './session-manager.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const MCP_HOST = process.env.MCP_HOST;
const MCP_ALLOWED_HOSTS = process.env.MCP_ALLOWED_HOSTS?.split(',').map(h => h.trim()).filter(h => h);

// JSON-RPC error codes
const JSONRPC_ERROR_CODE = {
  INVALID_REQUEST: -32600,
  SESSION_NOT_FOUND: -32001,
  INTERNAL_ERROR: -32603,
} as const;

// Create Express app using createMcpExpressApp
const app = createMcpExpressApp({
  ...(MCP_HOST && { host: MCP_HOST }),
  ...(MCP_ALLOWED_HOSTS && MCP_ALLOWED_HOSTS.length > 0 && { allowedHosts: MCP_ALLOWED_HOSTS })
});

// Output access logs in httpd log format (skip /health endpoint)
app.use(morgan('combined', {
  skip: (req, _res) => req.path === '/health'
}));

// CORS settings (expose MCP-related headers)
app.use(cors({
  exposedHeaders: ['mcp-session-id', 'mcp-protocol-version', 'last-event-id'],
  origin: '*'
}));

// JSON parser (apply to all endpoints except MCP endpoint)
// StreamableHTTPServerTransport handles streams directly for MCP endpoint,
// so applying express.json() would consume the stream
app.use((req, res, next) => {
  if (req.path === '/mcp') {
    // Skip JSON parser for MCP endpoint
    next();
  } else {
    // Apply JSON parser to other endpoints
    express.json()(req, res, next);
  }
});

const sessionManager = new SessionManager();

const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * MCP endpoint (POST - JSON-RPC requests)
 * Issues a session ID on the first connection, then processes requests with that session ID
 */
app.post('/mcp', async (req, res) => {
  try {
    // Get session ID from header
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
    } else if (!sessionId) {
      // Create new session only for initialize request when session ID is not present
      if (!req.body || req.body.method !== 'initialize') {
        res.status(400).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: JSONRPC_ERROR_CODE.INVALID_REQUEST,
            message: 'Invalid Request: Session is not initialized.',
          },
        });
        return;
      }

      // Create EventStore for each session (for managing and replaying event history)
      const eventStore = new InMemoryEventStore();
      const newSessionId = randomUUID();

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        eventStore: eventStore,
        onsessioninitialized: (newSessionId: string) => {
          console.log(`✨ Session initialized: ${newSessionId}`);
          transports.set(newSessionId, transport);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports.has(sid)) {
          console.log(`🔌 Transport closed for the session: ${sid}`);
          transports.delete(sid);
        }
      };

      let server = createMCPServer(sessionManager, newSessionId);

      // Connect server and transport (onsessioninitialized is called at this point)
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: JSONRPC_ERROR_CODE.SESSION_NOT_FOUND,
          message: 'Invalid Request: Session not found.',
        },
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling POST /mcp:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JSONRPC_ERROR_CODE.INTERNAL_ERROR,
          message: `Internal Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
    }
  }
});

/**
 * MCP endpoint (GET - SSE stream)
 * Event stream from server to client
 */
app.get('/mcp', async (req, res) => {
  try {
    // Get session ID from header
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JSONRPC_ERROR_CODE.SESSION_NOT_FOUND,
          message: 'Invalid Request: Session not found',
        }
      });
      return;
    }

    // Handle SSE stream
    await transports.get(sessionId)?.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling GET /mcp:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JSONRPC_ERROR_CODE.INTERNAL_ERROR,
          message: `Internal Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
    }
  }
});

/**
 * Session deletion endpoint (optional)
 */
app.delete('/mcp', async (req, res) => {
  // Get session ID from header
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports.has(sessionId)) {
    res
      .status(400)
      .json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JSONRPC_ERROR_CODE.SESSION_NOT_FOUND,
          message: 'Invalid Request: Session not found',
        }
      });
    return;
  }

  try {
    // Handle SSE stream
    await transports.get(sessionId)?.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling DELETE /mcp:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JSONRPC_ERROR_CODE.INTERNAL_ERROR,
          message: `Internal Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
    }
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: transports.size,
    timestamp: new Date().toISOString()
  });
});

/**
 * Root endpoint
 */
app.get('/', (_req, res) => {
  res.json({
    name: 'NASA Images MCP Server',
    version: '1.0.0',
    endpoints: {
      'POST /mcp': 'Send JSON-RPC requests',
      'GET /mcp': 'SSE stream for server notifications',
      'DELETE /mcp': 'Close a session',
      'GET /health': 'Health check'
    },
    documentation: 'https://github.com/modelcontextprotocol/specification'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✨ NASA Images MCP Server is running!`);
  console.log(`🌐 HTTP Server: http://localhost:${PORT}`);
  console.log(`🔌 MCP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`\n📝 To use with MCP clients, configure them to connect to: http://localhost:${PORT}/mcp`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');

  // Close all sessions
  for (const sessionId in transports) {
    try {
      await transports.get(sessionId)?.close();
      transports.delete(sessionId);
      console.log(`✓ Closed a transport for the session: ${sessionId}`);
    } catch (error) {
      console.error(`✗ Error closing a transport for the session ${sessionId}:`, error);
    }
  }

  process.exit(0);
});
