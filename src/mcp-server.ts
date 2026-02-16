import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { SessionManager } from './session-manager.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createMCPServer(sessionManager: SessionManager, sessionId: string) {
  const server = new McpServer(
    {
      name: 'nasa-images-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  registerAppResource(
    server,
    'NASA Images Viewer',
    'ui://nasa-images/viewer',
    {
      description: 'Interactive viewer for NASA images'
    },
    async () => {
      const viewerHtmlPath = path.join(__dirname, '..', 'dist', 'viewer.html');
      const viewerHtml = await fs.readFile(viewerHtmlPath, 'utf-8');

      return {
        contents: [
          {
            uri: 'ui://nasa-images/viewer',
            mimeType: RESOURCE_MIME_TYPE,
            text: viewerHtml,
            _meta: {
              ui: {
                csp: {
                  resourceDomains: ['images-assets.nasa.gov'],
                },
              },
            },
          },
        ],
      };
    }
  );

  server.registerResource(
    'current_nasa_image_url',
    'nasa-image://current',
    {},
    async () => {
      const image = sessionManager.getCurrentImage(sessionId);

      if (!image) {
        throw new Error('No image available. Please search first.');
      }

      return {
        contents: [
          {
            uri: 'nasa-image://current',
            mimeType: 'text/uri-list',
            text: image.imageUrl
          }
        ]
      };
    }
  );

  registerAppTool(
    server,
    'search_nasa_images',
    {
      description: 'Search NASA image library and display results in an interactive UI',
      inputSchema: {
        query: z.string().describe('Search query (e.g., "apollo 11", "mars rover")'),
      },
      _meta: {
        ui: {
          resourceUri: 'ui://nasa-images/viewer'
        }
      }
    },
    async ({ query }) => {
      await sessionManager.search(sessionId, query);

      return {
        content: [
          {
            type: 'text',
            text: `Searched for: "${query}". Found ${sessionManager.getSession(sessionId)?.totalResults || 0} images.`
          }
        ]
      };
    }
  );

  registerAppTool(
    server,
    'get_next_image',
    {
      description: 'Get the next image from current search results',
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: 'ui://nasa-images/viewer'
        }
      }
    },
    async () => {
      if (!sessionManager.hasSession(sessionId)) {
        throw new Error('No active search session. Please search first.');
      }

      const nextImg = sessionManager.nextImage(sessionId);

      return {
        content: [
          {
            type: 'text',
            text: `Loaded next image: ${nextImg?.title || 'Unknown'}`
          }
        ]
      };
    }
  );

  registerAppTool(
    server,
    'get_current_image',
    {
      description: 'Get the current image URL from the session',
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: 'ui://nasa-images/viewer'
        }
      }
    },
    async () => {
      const image = sessionManager.getCurrentImage(sessionId);

      if (!image) {
        throw new Error('No image available. Please search first.');
      }

      return {
        content: [
          {
            type: 'text',
            text: image.imageUrl
          }
        ]
      };
    }
  );

  return server;
}
