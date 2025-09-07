/**
 * Transport Factory for multi-transport support
 * Supports stdio (default), HTTP/SSE for Vercel, and future transports
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HttpSSETransport } from './HttpSSETransport.js';

export type TransportType = 'stdio' | 'http' | 'http-sse';

export interface TransportConfig {
  type: TransportType;
  port?: number;
  corsOrigin?: string | string[];
  authEnabled?: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export class TransportFactory {
  /**
   * Create a transport based on configuration
   */
  static async create(config: TransportConfig): Promise<any> {
    console.log(`[TransportFactory] Creating ${config.type} transport`);
    
    switch (config.type) {
      case 'stdio':
        console.log('[TransportFactory] Using stdio transport (default)');
        return new StdioServerTransport();
        
      case 'http':
      case 'http-sse':
        console.log(`[TransportFactory] Using HTTP/SSE transport on port ${config.port || 3000}`);
        const httpTransport = new HttpSSETransport({
          port: config.port || 3000,
          corsOrigin: config.corsOrigin,
          authEnabled: config.authEnabled || false,
          supabaseUrl: config.supabaseUrl,
          supabaseAnonKey: config.supabaseAnonKey
        });
        
        // For Vercel, we don't start the server here
        // The transport will be used by the Edge Function
        if (process.env.VERCEL !== '1') {
          await httpTransport.start();
        }
        
        return httpTransport.getTransport();
        
      default:
        throw new Error(`Unknown transport type: ${config.type}`);
    }
  }
  
  /**
   * Detect transport type from environment
   */
  static detectTransportType(): TransportType {
    // Check environment variables
    const envTransport = process.env.MCP_TRANSPORT;
    if (envTransport) {
      return envTransport as TransportType;
    }
    
    // Check if running in Vercel
    if (process.env.VERCEL === '1') {
      return 'http-sse';
    }
    
    // Check command line arguments
    const args = process.argv.slice(2);
    if (args.includes('--http')) {
      return 'http';
    }
    if (args.includes('--http-sse')) {
      return 'http-sse';
    }
    
    // Default to stdio for backward compatibility
    return 'stdio';
  }
  
  /**
   * Get configuration from environment
   */
  static getConfigFromEnv(): TransportConfig {
    const type = TransportFactory.detectTransportType();
    
    return {
      type,
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      corsOrigin: process.env.CORS_ORIGIN || '*',
      authEnabled: process.env.AUTH_ENABLED === 'true',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };
  }
}