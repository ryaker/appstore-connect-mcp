/**
 * HTTP Transport for MCP Server using official MCP SDK
 * Adapted from KMS MCP implementation for Apple Store Connect
 */

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer, Server as HttpServer } from 'http'
import { randomUUID } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { OAuth2Authenticator } from '../auth/OAuth2Authenticator.js'
import { 
  OAuthConfig, 
  AuthContext, 
  ProtectedResourceMetadata 
} from '../auth/types.js'
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js'

export interface HttpTransportConfig {
  port: number
  host?: string
  cors?: {
    origin?: string | string[]
    credentials?: boolean
  }
  rateLimit?: {
    windowMs?: number
    max?: number
  }
  oauth?: OAuthConfig
}

export interface McpServerFactory {
  (): Server
}

// Extend Request interface to include auth property
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export class HttpTransport {
  private app: express.Application
  private server?: HttpServer
  private authenticator?: OAuth2Authenticator
  private mcpServerFactory?: McpServerFactory
  private transports = new Map<string, StreamableHTTPServerTransport>()

  constructor(private config: HttpTransportConfig) {
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
    
    if (config.oauth?.enabled) {
      this.authenticator = new OAuth2Authenticator(config.oauth)
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Trust proxy for ngrok/reverse proxy support
    this.app.set('trust proxy', 1)
    
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }))
    
    // CORS
    this.app.use(cors({
      origin: this.config.cors?.origin || true,
      credentials: this.config.cors?.credentials || true,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'mcp-session-id', 'last-event-id']
    }))

    // Rate limiting
    this.app.use(rateLimit({
      windowMs: this.config.rateLimit?.windowMs || 15 * 60 * 1000,
      max: this.config.rateLimit?.max || 1000,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    }))

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const timestamp = new Date().toISOString()
      console.log(`${timestamp} ${req.method} ${req.path}`)
      if (req.method === 'POST' && req.path.includes('/mcp')) {
        console.log(`  ↳ MCP Request Body:`, JSON.stringify(req.body, null, 2))
      }
      next()
    })
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        service: 'appstore-connect-mcp'
      })
    })

    // OAuth metadata endpoints (if OAuth is enabled)
    if (this.config.oauth?.enabled) {
      // OAuth 2.0 Authorization Server Metadata (RFC 8414)
      // Points to Auth0 as our authorization server
      this.app.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
        const issuer = this.config.oauth!.issuer!.replace(/\/$/, '') // Remove trailing slash
        
        // Auth0 OAuth 2.0 endpoints with dynamic registration support
        const metadata = {
          issuer: issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/oauth/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          jwks_uri: `${issuer}/.well-known/jwks.json`,
          registration_endpoint: `${issuer}/oidc/register`, // This enables dynamic registration!
          scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
          response_types_supported: ['code', 'token', 'id_token', 'code token', 'code id_token', 'token id_token', 'code token id_token'],
          grant_types_supported: ['authorization_code', 'implicit', 'refresh_token', 'client_credentials'],
          code_challenge_methods_supported: ['S256', 'plain'],
          token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none']
        }
        
        res.json(metadata)
      })

      // OAuth 2.0 Authorization Server Metadata for MCP (same as above)
      this.app.get('/.well-known/oauth-authorization-server/mcp', (req: Request, res: Response) => {
        const issuer = this.config.oauth!.issuer!
        
        // Auth0 OAuth 2.0 endpoints with dynamic registration support
        const metadata = {
          issuer: issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/oauth/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          jwks_uri: `${issuer}/.well-known/jwks.json`,
          registration_endpoint: `${issuer}/oidc/register`, // This enables dynamic registration!
          scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
          response_types_supported: ['code', 'token', 'id_token', 'code token', 'code id_token', 'token id_token', 'code token id_token'],
          grant_types_supported: ['authorization_code', 'implicit', 'refresh_token', 'client_credentials'],
          code_challenge_methods_supported: ['S256', 'plain'],
          token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none']
        }
        
        res.json(metadata)
      })

      // OAuth 2.0 Protected Resource Metadata (RFC 9728)
      this.app.get('/.well-known/oauth-protected-resource', (req: Request, res: Response) => {
        const metadata: ProtectedResourceMetadata = {
          resource: this.config.oauth!.audience!,
          authorization_servers: [this.config.oauth!.issuer!],
          scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin'],
          bearer_methods_supported: ['header'],
          resource_documentation: 'https://github.com/ryaker/appstore-connect-mcp'
        }
        res.json(metadata)
      })

      // OAuth 2.0 Protected Resource Metadata for MCP  
      this.app.get('/.well-known/oauth-protected-resource/mcp-v2', (req: Request, res: Response) => {
        const metadata: ProtectedResourceMetadata = {
          resource: this.config.oauth!.audience!,
          authorization_servers: [this.config.oauth!.issuer!],
          scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin'],
          bearer_methods_supported: ['header'],
          resource_documentation: 'https://github.com/ryaker/appstore-connect-mcp'
        }
        res.json(metadata)
      })
    }

    // MCP endpoints using proper SDK StreamableHTTPServerTransport
    if (this.config.oauth?.enabled) {
      this.app.post('/mcp', this.authenticateRequest.bind(this), this.handleMcpPostRequest.bind(this))
      this.app.get('/mcp', this.authenticateRequest.bind(this), this.handleMcpGetRequest.bind(this))
      this.app.delete('/mcp', this.authenticateRequest.bind(this), this.handleMcpDeleteRequest.bind(this))
    } else {
      this.app.post('/mcp', this.handleMcpPostRequest.bind(this))
      this.app.get('/mcp', this.handleMcpGetRequest.bind(this))
      this.app.delete('/mcp', this.handleMcpDeleteRequest.bind(this))
    }

    // Error handler
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      console.error('HTTP Transport Error:', err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      }
    })
  }

  /**
   * Authenticate request using OAuth2
   */
  private async authenticateRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.authenticator) {
      return next()
    }

    // Log request source information
    const clientInfo = {
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer,
      xForwardedFor: req.headers['x-forwarded-for'],
      xRealIp: req.headers['x-real-ip']
    }

    try {
      const authHeader = req.headers.authorization
      if (!authHeader) {
        console.log('🚫 Missing Authorization header from:', clientInfo)
        res.status(401).json({ error: 'Missing Authorization header' })
        return
      }

      const authContext = await this.authenticator.authenticate(authHeader)
      req.auth = authContext
      next()
    } catch (error) {
      console.error('❌ Authentication failed from:', clientInfo)
      console.error('   Error details:', error)
      res.status(401).json({ error: 'Authentication failed' })
    }
  }

  /**
   * Set MCP server factory
   */
  setMcpServerFactory(factory: McpServerFactory): void {
    this.mcpServerFactory = factory
  }

  /**
   * Handle MCP POST request using StreamableHTTPServerTransport
   */
  private async handleMcpPostRequest(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.headers['mcp-session-id'] as string
      
      // Extract client info from request body if it's an initialize request
      if (req.body?.method === 'initialize') {
        const clientInfo = req.body?.params?.clientInfo
        console.log(`📱 MCP Client connecting:`, {
          name: clientInfo?.name || 'unknown',
          version: clientInfo?.version || 'unknown',
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          sessionId: sessionId
        })
      }
      
      console.log(sessionId ? `Received MCP POST request for session: ${sessionId}` : 'Received MCP POST request')

      if (this.config.oauth?.enabled && req.auth) {
        console.log('✅ Authenticated user:', req.auth?.user?.id || req.auth.user)
      }

      let transport: StreamableHTTPServerTransport
      
      if (sessionId && this.transports.has(sessionId)) {
        // Reuse existing transport
        transport = this.transports.get(sessionId)!
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        console.log('[Transport] Creating new transport for initialize request')
        
        const eventStore = new InMemoryEventStore()
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore,
          onsessioninitialized: (sessionId) => {
            console.log(`Session initialized with ID: ${sessionId}`)
            this.transports.set(sessionId, transport)
          }
        })

        // Set up onclose handler to clean up transport when closed
        transport.onclose = () => {
          const sid = transport.sessionId
          if (sid && this.transports.has(sid)) {
            console.log(`Transport closed for session ${sid}, removing from transports map`)
            this.transports.delete(sid)
          }
        }

        // Connect the transport to the MCP server BEFORE handling the request
        if (this.mcpServerFactory) {
          const server = this.mcpServerFactory()
          await server.connect(transport)
        } else {
          throw new Error('MCP server factory not initialized')
        }

        // Create auth adapter for MCP SDK compatibility
        const mcpCompatibleReq = req as any
        if (req.auth) {
          mcpCompatibleReq.auth = {
            clientId: req.auth.client?.id || 'unknown',
            scopes: req.auth.token?.scope?.split(' ') || []
          }
        }
        
        await transport.handleRequest(mcpCompatibleReq, res, req.body)
        return
      } else {
        // Invalid request - no session ID or not initialization request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        })
        return
      }

      // Handle the request with existing transport
      console.log('[Transport] Handling request with existing transport for session:', sessionId)
      
      // Create auth adapter for MCP SDK compatibility
      const mcpCompatibleReq = req as any
      if (req.auth) {
        mcpCompatibleReq.auth = {
          clientId: req.auth.client?.id || 'unknown',
          scopes: req.auth.token?.scope?.split(' ') || []
        }
      }
      
      await transport.handleRequest(mcpCompatibleReq, res, req.body)
    } catch (error) {
      console.error('Error handling MCP POST request:', error)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        })
      }
    }
  }

  /**
   * Handle MCP GET request for SSE streams using StreamableHTTPServerTransport
   */
  private async handleMcpGetRequest(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.headers['mcp-session-id'] as string
      if (!sessionId || !this.transports.has(sessionId)) {
        res.status(400).send('Invalid or missing session ID')
        return
      }

      if (this.config.oauth?.enabled && req.auth) {
        console.log('Authenticated SSE connection from user:', req.auth.user?.id || req.auth.user)
      }

      // Check for Last-Event-ID header for resumability
      const lastEventId = req.headers['last-event-id']
      if (lastEventId) {
        console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`)
      } else {
        console.log(`Establishing new SSE stream for session ${sessionId}`)
      }

      const transport = this.transports.get(sessionId)!
      
      // Create auth adapter for MCP SDK compatibility
      const mcpCompatibleReq = req as any
      if (req.auth) {
        mcpCompatibleReq.auth = {
          clientId: req.auth.client?.id || 'unknown',
          scopes: req.auth.token?.scope?.split(' ') || []
        }
      }
      
      await transport.handleRequest(mcpCompatibleReq, res)
    } catch (error) {
      console.error('Error handling MCP GET request:', error)
      if (!res.headersSent) {
        res.status(500).send('Error processing SSE request')
      }
    }
  }

  /**
   * Handle MCP DELETE request for session termination using StreamableHTTPServerTransport
   */
  private async handleMcpDeleteRequest(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.headers['mcp-session-id'] as string
      if (!sessionId || !this.transports.has(sessionId)) {
        res.status(400).send('Invalid or missing session ID')
        return
      }

      console.log(`Received session termination request for session ${sessionId}`)

      const transport = this.transports.get(sessionId)!
      
      // Create auth adapter for MCP SDK compatibility
      const mcpCompatibleReq = req as any
      if (req.auth) {
        mcpCompatibleReq.auth = {
          clientId: req.auth.client?.id || 'unknown',
          scopes: req.auth.token?.scope?.split(' ') || []
        }
      }
      
      await transport.handleRequest(mcpCompatibleReq, res)
    } catch (error) {
      console.error('Error handling session termination:', error)
      if (!res.headersSent) {
        res.status(500).send('Error processing session termination')
      }
    }
  }

  /**
   * Start HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app)
        
        this.server.listen(this.config.port, this.config.host || '0.0.0.0', () => {
          console.log(`🌐 Apple Store Connect MCP HTTP Transport listening on ${this.config.host || '0.0.0.0'}:${this.config.port}`)
          console.log(`📡 MCP endpoint: http://${this.config.host || 'localhost'}:${this.config.port}/mcp`)
          if (this.config.oauth?.enabled) {
            console.log(`🔐 OAuth enabled with issuer: ${this.config.oauth.issuer}`)
          }
          resolve()
        })
        
        this.server.on('error', reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Stop HTTP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        // Close all active transports
        for (const [sessionId, transport] of this.transports) {
          try {
            console.log(`Closing transport for session ${sessionId}`)
            transport.close()
            this.transports.delete(sessionId)
          } catch (error) {
            console.error(`Error closing transport for session ${sessionId}:`, error)
          }
        }

        this.server.close(() => {
          console.log('🔌 Apple Store Connect MCP HTTP Transport stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Get transport statistics
   */
  getStats(): Record<string, any> {
    return {
      activeSessions: this.transports.size,
      authEnabled: this.config.oauth?.enabled || false,
      service: 'apple-store-connect-mcp'
    }
  }
}