/**
 * MCP Server wrapper for Vercel deployment
 * Provides methods that can be called from Edge Functions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { AppStoreConnectService } from './services/AppStoreConnectService.js';
import { createClient } from '@supabase/supabase-js';

export class MCPServer {
  private server: Server;
  private appStoreService?: AppStoreConnectService;
  private supabase?: any;
  
  constructor() {
    this.server = new Server(
      {
        name: 'appstore-connect-mcp',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // Initialize Supabase if configured
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
  }
  
  /**
   * Initialize the server
   */
  async initialize() {
    // Initialize Apple Store Connect service if credentials are available
    const keyId = process.env.APPLE_KEY_ID;
    const issuerId = process.env.APPLE_ISSUER_ID;
    const privateKey = process.env.APPLE_PRIVATE_KEY;
    
    if (keyId && issuerId && privateKey) {
      this.appStoreService = new AppStoreConnectService({
        keyId,
        issuerId,
        privateKey,
      });
    }
    
    this.setupTools();
  }
  
  /**
   * Get Apple credentials for a specific user from Supabase
   */
  async getAppleCredentialsForUser(userId: string) {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { data, error } = await this.supabase
      .from('apple_credentials')
      .select('key_id, issuer_id, p8_key_encrypted')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      throw new Error('No Apple credentials found for user');
    }
    
    // Decrypt the P8 key (implement your decryption logic here)
    const decryptedKey = await this.decryptP8Key(data.p8_key_encrypted);
    
    return {
      keyId: data.key_id,
      issuerId: data.issuer_id,
      privateKey: decryptedKey
    };
  }
  
  /**
   * Decrypt P8 key (implement your encryption strategy)
   */
  private async decryptP8Key(encryptedKey: string): Promise<string> {
    // TODO: Implement proper decryption
    // For now, return as-is (assuming it's stored in plain text during development)
    return encryptedKey;
  }
  
  /**
   * Setup MCP tools
   */
  private setupTools() {
    // Tool: List Apps
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_apps',
          description: 'List all apps in App Store Connect',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_app_info',
          description: 'Get detailed information about a specific app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The App Store Connect app ID',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'list_builds',
          description: 'List builds for an app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The App Store Connect app ID',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'get_sales_report',
          description: 'Get sales and download reports',
          inputSchema: {
            type: 'object',
            properties: {
              reportType: {
                type: 'string',
                enum: ['sales', 'downloads', 'updates'],
                description: 'Type of report to retrieve',
              },
              frequency: {
                type: 'string',
                enum: ['daily', 'weekly', 'monthly', 'yearly'],
                description: 'Report frequency',
              },
              date: {
                type: 'string',
                description: 'Report date (YYYY-MM-DD)',
              },
            },
            required: ['reportType', 'frequency', 'date'],
          },
        },
        {
          name: 'list_certificates',
          description: 'List certificates and provisioning profiles',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['certificates', 'profiles'],
                description: 'Type of resource to list',
              },
            },
            required: ['type'],
          },
        },
      ],
    }));
    
    // Tool: Call Tool Handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (!this.appStoreService) {
        throw new Error('App Store Connect service not initialized');
      }
      
      switch (name) {
        case 'list_apps':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(await this.appStoreService.listApps(), null, 2),
              },
            ],
          };
          
        case 'get_app_info':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  await this.appStoreService.getAppInfo(args?.appId as string),
                  null,
                  2
                ),
              },
            ],
          };
          
        case 'list_builds':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  await this.appStoreService.listBuilds(args?.appId as string),
                  null,
                  2
                ),
              },
            ],
          };
          
        case 'get_sales_report':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  await this.appStoreService.getSalesReport(
                    args?.reportType as string,
                    args?.frequency as string,
                    args?.date as string
                  ),
                  null,
                  2
                ),
              },
            ],
          };
          
        case 'list_certificates':
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  await this.appStoreService.listCertificates(args?.type as 'certificates' | 'profiles'),
                  null,
                  2
                ),
              },
            ],
          };
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }
  
  /**
   * Handle initialize request
   */
  async handleInitialize(params: any) {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: 'appstore-connect-mcp',
        version: '2.0.0',
      },
    };
  }
  
  /**
   * Handle list tools request
   */
  async handleListTools() {
    // Return the tools directly since we set them up in setupTools
    return {
      tools: [
        {
          name: 'list_apps',
          description: 'List all apps in App Store Connect',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_app_info',
          description: 'Get detailed information about a specific app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The App Store Connect app ID',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'list_builds',
          description: 'List builds for an app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The App Store Connect app ID',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'get_sales_report',
          description: 'Get sales and download reports',
          inputSchema: {
            type: 'object',
            properties: {
              reportType: {
                type: 'string',
                enum: ['sales', 'downloads', 'updates'],
                description: 'Type of report to retrieve',
              },
              frequency: {
                type: 'string',
                enum: ['daily', 'weekly', 'monthly', 'yearly'],
                description: 'Report frequency',
              },
              date: {
                type: 'string',
                description: 'Report date (YYYY-MM-DD)',
              },
            },
            required: ['reportType', 'frequency', 'date'],
          },
        },
        {
          name: 'list_certificates',
          description: 'List certificates and provisioning profiles',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['certificates', 'profiles'],
                description: 'Type of resource to list',
              },
            },
            required: ['type'],
          },
        },
      ],
    };
  }
  
  /**
   * Handle call tool request
   */
  async handleCallTool(params: any) {
    // Handle the tool call directly
    const { name, arguments: args } = params;
    
    if (!this.appStoreService) {
      throw new Error('App Store Connect service not initialized');
    }
    
    switch (name) {
      case 'list_apps':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await this.appStoreService.listApps(), null, 2),
            },
          ],
        };
        
      case 'get_app_info':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await this.appStoreService.getAppInfo(args?.appId as string),
                null,
                2
              ),
            },
          ],
        };
        
      case 'list_builds':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await this.appStoreService.listBuilds(args?.appId as string),
                null,
                2
              ),
            },
          ],
        };
        
      case 'get_sales_report':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await this.appStoreService.getSalesReport(
                  args?.reportType as string,
                  args?.frequency as string,
                  args?.date as string
                ),
                null,
                2
              ),
            },
          ],
        };
        
      case 'list_certificates':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await this.appStoreService.listCertificates(args?.type as 'certificates' | 'profiles'),
                null,
                2
              ),
            },
          ],
        };
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}