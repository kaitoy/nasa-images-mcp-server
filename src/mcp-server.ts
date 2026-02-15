import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { SessionManager } from './session-manager.js';

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

  // UIリソースのHTML
  const viewerHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NASA Images Viewer</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #0a0e27;
      color: #fff;
    }
    .container {
      background: #1a1f3a;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }
    h1 {
      color: #4a9eff;
      margin-top: 0;
    }
    .search-form {
      margin-bottom: 20px;
    }
    input[type="text"] {
      width: 70%;
      padding: 10px;
      font-size: 16px;
      border: 1px solid #4a9eff;
      border-radius: 5px;
      background: #0a0e27;
      color: #fff;
    }
    button {
      padding: 10px 20px;
      font-size: 16px;
      background: #4a9eff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      margin-left: 10px;
    }
    button:hover {
      background: #357abd;
    }
    button:disabled {
      background: #666;
      cursor: not-allowed;
    }
    .image-container {
      text-align: center;
      margin: 20px 0;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    }
    .image-info {
      margin-top: 15px;
      text-align: left;
    }
    .image-title {
      font-size: 20px;
      font-weight: bold;
      color: #4a9eff;
      margin-bottom: 10px;
    }
    .image-description {
      color: #ccc;
      line-height: 1.6;
    }
    .loading {
      text-align: center;
      color: #4a9eff;
      font-size: 18px;
    }
    .error {
      color: #ff4444;
      padding: 10px;
      background: #331111;
      border-radius: 5px;
    }
    .controls {
      text-align: center;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 NASA Images Explorer</h1>

    <div class="search-form">
      <input type="text" id="searchQuery" placeholder="Search NASA images (e.g., apollo 11, mars rover)">
      <button onclick="searchImages()">Search</button>
    </div>

    <div id="imageContainer" class="image-container">
      <p class="loading">Search for NASA images to get started</p>
    </div>

    <div class="controls">
      <button id="nextBtn" onclick="nextImage()" disabled>Next Image</button>
    </div>
  </div>

  <script>
    // MCP App クラス（MCP通信用）
    class App {
      constructor() {
        this.ontoolinput = null;
      }

      sendMessage(message) {
        // MCP Host にメッセージを送信
        if (window.parent) {
          window.parent.postMessage(message, '*');
        }
      }

      callTool(name, args) {
        this.sendMessage({
          type: 'callTool',
          tool: name,
          arguments: args
        });
      }

      readResource(uri) {
        this.sendMessage({
          type: 'readResource',
          uri: uri
        });
      }
    }

    const app = new App();
    let currentImageUrl = null;

    // ツール入力を受信
    app.ontoolinput = function(input) {
      console.log('Tool input received:', input);
      loadCurrentImage();
    };

    // MCP Hostからのメッセージを受信
    window.addEventListener('message', (event) => {
      console.log('Message received:', event.data);

      if (event.data.type === 'resourceData') {
        // リソースデータを受信
        updateImage(event.data.data);
      }
    });

    async function searchImages() {
      const query = document.getElementById('searchQuery').value.trim();
      if (!query) {
        alert('Please enter a search query');
        return;
      }

      document.getElementById('imageContainer').innerHTML =
        '<p class="loading">Searching...</p>';
      document.getElementById('nextBtn').disabled = true;

      // search_nasa_images ツールを呼び出し
      app.callTool('search_nasa_images', { query: query });

      // 少し待ってから画像を読み込む
      setTimeout(() => {
        loadCurrentImage();
      }, 1000);
    }

    function loadCurrentImage() {
      // nasa-image://current リソースを読み取る
      app.readResource('nasa-image://current');
    }

    function updateImage(imageUrl) {
      if (!imageUrl) {
        document.getElementById('imageContainer').innerHTML =
          '<p class="error">No image available</p>';
        return;
      }

      currentImageUrl = imageUrl;

      document.getElementById('imageContainer').innerHTML = \`
        <img src="\${imageUrl}" alt="NASA Image" onload="imageLoaded()">
        <div class="image-info">
          <div class="image-title">NASA Image</div>
          <div class="image-description">Image from NASA's collection</div>
        </div>
      \`;

      document.getElementById('nextBtn').disabled = false;
    }

    function imageLoaded() {
      console.log('Image loaded successfully');
    }

    function nextImage() {
      document.getElementById('nextBtn').disabled = true;

      // get_next_image ツールを呼び出し
      app.callTool('get_next_image', {});

      // 少し待ってから画像を読み込む
      setTimeout(() => {
        loadCurrentImage();
      }, 500);
    }
  </script>
</body>
</html>`;

  // UIリソースを登録（MCP Apps Pattern）
  registerAppResource(
    server,
    'NASA Images Viewer',
    'ui://nasa-images/viewer',
    {
      description: 'Interactive viewer for NASA images'
    },
    async () => ({
      contents: [
        {
          uri: 'ui://nasa-images/viewer',
          mimeType: RESOURCE_MIME_TYPE,
          text: viewerHtml
        }
      ]
    })
  );

  // 画像URLリソースを登録（通常のMCPリソース）
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

  // ツール1: search_nasa_images（MCP Apps Pattern）
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
      // NASA APIで検索し、セッションに保存
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

  // ツール2: get_next_image（MCP Apps Pattern）
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

  return server;
}
