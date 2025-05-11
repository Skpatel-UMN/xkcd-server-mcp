#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

class XkcdServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'xkcd-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_random_comic',
          description: 'Get a random xkcd comic',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'get_random_comic') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      try {
        // Get the number of the latest comic
        const latestResponse = await axios.get('https://xkcd.com/info.0.json');
        const latestComicNum = latestResponse.data.num;

        // Generate a random number between 1 and the number of the latest comic
        const randomComicNum = Math.floor(Math.random() * latestComicNum) + 1;

        // Use the random number to get the comic
        const response = await axios.get(`https://xkcd.com/${randomComicNum}/info.0.json`);
        const comicData = response.data;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(comicData, null, 2),
            },
          ],
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          return {
            content: [
              {
                type: 'text',
                text: `XKCD API error: ${
                  error.response?.data.message ?? error.message
                }`,
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('XKCD MCP server running on stdio');
  }
}

const server = new XkcdServer();
server.run().catch(console.error);
