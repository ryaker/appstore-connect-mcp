/**
 * Vercel Function wrapper for Express-based MCP Server
 * Provides access to the Express implementation alongside the Next.js version
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createMcpServer } from '../express-server/dist/index.js';
import { HttpTransport } from '../express-server/dist/transport/HttpTransport.js';

// Create singleton MCP server and transport
let mcpServer: any;
let transport: HttpTransport;

function initializeServer() {
  if (!mcpServer) {
    console.log('🚀 Initializing Express MCP Server for Vercel...');
    
    mcpServer = createMcpServer();
    transport = new HttpTransport({
      port: 3001, // Not used in Vercel
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
      },
      oauth: process.env.AUTH_ENABLED === 'true' ? {
        enabled: true,
        issuer: process.env.STYTCH_PROJECT_DOMAIN,
        audience: process.env.STYTCH_PROJECT_ID,
        jwksUri: `${process.env.STYTCH_PROJECT_DOMAIN}/.well-known/jwks.json`,
      } : undefined,
    });

    transport.setMcpServerFactory(() => mcpServer);
    console.log('✅ Express MCP Server initialized for Vercel');
  }
  return { mcpServer, transport };
}

/**
 * Vercel serverless function handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize server on first request
    const { transport } = initializeServer();

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, last-event-id');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Health check for Express version
    if (req.url === '/health') {
      return res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        service: 'appstore-connect-mcp-express',
        runtime: 'vercel'
      });
    }

    // Convert Vercel request to Express-compatible request
    const expressReq = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      ip: req.socket?.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'],
      socket: req.socket,
    } as any;

    // Convert Vercel response to Express-compatible response  
    const expressRes = {
      status: (code: number) => {
        res.status(code);
        return expressRes;
      },
      json: (data: any) => {
        res.json(data);
        return expressRes;
      },
      send: (data: any) => {
        res.send(data);
        return expressRes;
      },
      setHeader: (name: string, value: string) => {
        res.setHeader(name, value);
        return expressRes;
      },
      write: (chunk: any) => {
        res.write(chunk);
        return expressRes;
      },
      end: (data?: any) => {
        res.end(data);
        return expressRes;
      },
      headersSent: res.headersSent,
    } as any;

    // Route to appropriate handler based on path
    const path = req.url?.split('?')[0] || '';
    
    if (path === '/mcp') {
      // Handle MCP requests through transport
      if (req.method === 'POST') {
        await (transport as any).handleMcpPostRequest(expressReq, expressRes);
      } else if (req.method === 'GET') {
        await (transport as any).handleMcpGetRequest(expressReq, expressRes);
      } else if (req.method === 'DELETE') {
        await (transport as any).handleMcpDeleteRequest(expressReq, expressRes);
      } else {
        res.status(405).json({ error: 'Method not allowed' });
      }
    } else if (path.startsWith('/.well-known/')) {
      // Handle OAuth discovery endpoints
      if (path === '/.well-known/oauth-authorization-server') {
        const baseUrl = `https://${req.headers.host}`;
        res.json({
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/oauth/login`,
          token_endpoint: `${baseUrl}/api/oauth/token`,
          jwks_uri: `${baseUrl}/.well-known/jwks.json`,
          scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin'],
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code'],
          code_challenge_methods_supported: ['S256'],
        });
      } else if (path === '/.well-known/oauth-protected-resource') {
        const baseUrl = `https://${req.headers.host}`;
        res.json({
          resource: baseUrl,
          authorization_servers: [baseUrl],
          scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin'],
          bearer_methods_supported: ['header'],
          resource_documentation: 'https://modelcontextprotocol.io'
        });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('Express MCP Vercel Function Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}