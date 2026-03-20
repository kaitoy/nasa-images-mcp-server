import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMCPServer } from './mcp-server.js';
import { SessionManager } from './session-manager.js';

export async function startStdioServer(sessionManager: SessionManager) {
  const server = createMCPServer(sessionManager, 'stdio');
  const transport = new StdioServerTransport();

  await server.connect(transport);
  process.stderr.write('✨ NASA Images MCP Server is running in stdio mode.\n');
}
