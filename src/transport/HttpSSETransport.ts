/**
 * HTTP Server-Sent Events Transport for MCP
 * Compatible with Vercel Edge Functions and Supabase
 */

import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { createServer, Server as HttpServer } from 'http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface HttpSSETransportConfig {
  port: number;
  corsOrigin?: string | string[];
  authEnabled: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export class HttpSSETransport {
  private app: express.Application;
  private server?: HttpServer;
  private supabase?: SupabaseClient;
  private transport?: any;
  private messageHandlers: Map<string, (message: any) => Promise<any>> = new Map();
  
  constructor(private config: HttpSSETransportConfig) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    // Initialize Supabase if auth is enabled
    if (config.authEnabled && config.supabaseUrl && config.supabaseAnonKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
  }
  
  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Trust proxy for Vercel
    this.app.set('trust proxy', 1);
    
    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigin || '*',
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Last-Event-ID']
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[HTTP] ${req.method} ${req.path}`);
      next();
    });
  }
  
  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        transport: 'http-sse',
        timestamp: new Date().toISOString()
      });
    });
    
    // OAuth discovery endpoints
    this.app.get('/.well-known/oauth-authorization-server', (req, res) => {
      if (!this.config.supabaseUrl) {
        return res.status(404).json({ error: 'OAuth not configured' });
      }
      
      res.json({
        issuer: this.config.supabaseUrl,
        authorization_endpoint: `${this.config.supabaseUrl}/auth/v1/authorize`,
        token_endpoint: `${this.config.supabaseUrl}/auth/v1/token`,
        jwks_uri: `${this.config.supabaseUrl}/auth/v1/.well-known/jwks.json`,
        scopes_supported: ['mcp:read', 'mcp:write', 'openid', 'email'],
        response_types_supported: ['code', 'token', 'id_token'],
        grant_types_supported: ['authorization_code', 'implicit', 'refresh_token'],
        code_challenge_methods_supported: ['S256', 'plain']
      });
    });
    
    // MCP discovery endpoint
    this.app.get('/.well-known/mcp.json', (req, res) => {
      res.json({
        name: 'App Store Connect MCP Server',
        description: 'Manage App Store Connect for Abundance Coach',
        version: '2.0.0',
        transport: {
          type: 'http-sse',
          endpoint: '/mcp',
          authentication: this.config.authEnabled ? {
            type: 'oauth2',
            discovery: '/.well-known/oauth-authorization-server'
          } : undefined
        },
        capabilities: {
          tools: true,
          resources: false,
          prompts: false
        }
      });
    });
    
    // SSE endpoint for MCP
    this.app.get('/mcp', async (req, res) => {
      // Verify authentication if enabled
      if (this.config.authEnabled) {
        const authResult = await this.verifyAuth(req);
        if (!authResult.valid) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        // Store user context for later use
        (req as any).user = authResult.user;
      }
      
      // Setup SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': this.config.corsOrigin || '*'
      });
      
      // Send initial connection event
      res.write(`event: connected\ndata: ${JSON.stringify({ type: 'connected' })}\n\n`);
      
      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write(': keep-alive\n\n');
      }, 30000);
      
      // Handle client disconnect
      req.on('close', () => {
        clearInterval(keepAlive);
        console.log('[SSE] Client disconnected');
      });
    });
    
    // POST endpoint for MCP RPC calls
    this.app.post('/mcp', async (req, res) => {
      // Verify authentication if enabled
      if (this.config.authEnabled) {
        const authResult = await this.verifyAuth(req);
        if (!authResult.valid) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        (req as any).user = authResult.user;
      }
      
      const { method, params, id } = req.body;
      
      // Handle MCP request
      try {
        const handler = this.messageHandlers.get(method);
        if (!handler) {
          return res.status(404).json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            },
            id
          });
        }
        
        const result = await handler(params);
        res.json({
          jsonrpc: '2.0',
          result,
          id
        });
      } catch (error: any) {
        console.error(`[MCP] Error handling ${method}:`, error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error.message || 'Internal error'
          },
          id
        });
      }
    });
  }
  
  /**
   * Verify authentication token
   */
  private async verifyAuth(req: Request): Promise<{ valid: boolean; user?: any }> {
    if (!this.supabase) {
      return { valid: false };
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { valid: false };
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);
      if (error || !user) {
        return { valid: false };
      }
      
      return { valid: true, user };
    } catch (error) {
      console.error('[Auth] Token verification failed:', error);
      return { valid: false };
    }
  }
  
  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer(this.app);
      this.server.listen(this.config.port, () => {
        console.log(`[HTTP] Server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }
  
  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[HTTP] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
  
  /**
   * Register a message handler
   */
  onMessage(method: string, handler: (params: any) => Promise<any>): void {
    this.messageHandlers.set(method, handler);
  }
  
  /**
   * Get the transport interface
   */
  getTransport(): any {
    // Create a custom transport that integrates with our HTTP/SSE setup
    const transport = {
      async start() {
        // Transport is already started
      },
      
      async close() {
        // Clean up if needed
      },
      
      async send(message: any) {
        // For SSE, we would send events to connected clients
        // This is handled by the POST endpoint responses
        console.log('[Transport] Send:', message);
      },
      
      onMessage: (handler: (message: any) => void) => {
        // Register handler for incoming messages
        // This is bridged through our HTTP POST handler
      },
      
      onError: (handler: (error: Error) => void) => {
        // Error handling
      },
      
      onClose: (handler: () => void) => {
        // Close handling
      }
    };
    
    this.transport = transport;
    return transport;
  }
  
  /**
   * Get Express app for Vercel
   */
  getApp(): express.Application {
    return this.app;
  }
}