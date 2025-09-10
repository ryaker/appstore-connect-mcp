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
import fetch from 'node-fetch'

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
      // SINGLE UNIFIED DISCOVERY DOCUMENT
      // All discovery endpoints return the SAME configuration to avoid confusion
      // This ensures Claude always uses our proxy endpoints that create SPA clients
      
      const getDiscoveryMetadata = (req: Request) => {
        const serverUrl = `https://${req.get('host')}` // Our server URL
        
        // CRITICAL: Set issuer to OUR server, not Auth0!
        // This prevents Claude from discovering Auth0's DCR endpoint
        // which creates Generic clients instead of SPA clients
        return {
          issuer: serverUrl, // CHANGED: Point to our server, not Auth0!
          authorization_endpoint: `${serverUrl}/authorize`, // Proxied
          token_endpoint: `${serverUrl}/oauth/token`, // Proxied
          registration_endpoint: `${serverUrl}/register`, // Creates SPA clients
          jwks_uri: this.config.oauth!.jwksUri, // Still use Auth0's JWKS for token validation
          scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin'],
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code'],
          code_challenge_methods_supported: ['S256']
        }
      }

      // All discovery endpoints return the same configuration
      this.app.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
        console.log('🚨 CRITICAL: Claude fetched /.well-known/oauth-authorization-server')
        console.log('   User-Agent:', req.headers['user-agent'])
        console.log('   From IP:', req.ip)
        const metadata = getDiscoveryMetadata(req)
        console.log('   Returning registration_endpoint:', metadata.registration_endpoint)
        res.json(metadata)
      })

      this.app.get('/.well-known/oauth-authorization-server/mcp', (req: Request, res: Response) => {
        console.log('📋 Discovery request: /.well-known/oauth-authorization-server/mcp')
        res.json(getDiscoveryMetadata(req))
      })
      
      // CRITICAL: Also provide OpenID Connect discovery endpoint
      // Claude might be looking for this instead of OAuth endpoints
      this.app.get('/.well-known/openid-configuration', (req: Request, res: Response) => {
        console.log('📋 Discovery request: /.well-known/openid-configuration')
        res.json(getDiscoveryMetadata(req))
      })

      // Protected Resource Metadata
      this.app.get('/.well-known/oauth-protected-resource', (req: Request, res: Response) => {
        console.log('📋 Discovery request: /.well-known/oauth-protected-resource')
        const serverUrl = `https://${req.get('host')}`
        const metadata: ProtectedResourceMetadata = {
          resource: serverUrl,
          authorization_servers: [serverUrl], // CRITICAL: Point to OUR server, not Auth0!
          scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin'],
          bearer_methods_supported: ['header'],
          resource_documentation: 'https://github.com/ryaker/appstore-connect-mcp'
        }
        console.log('📤 Returning authorization_servers:', metadata.authorization_servers)
        res.json(metadata)
      })
    }
    
    // OAuth proxy endpoints (if OAuth is enabled)
    if (this.config.oauth?.enabled) {
      // OIDC Dynamic Client Registration proxy endpoint
      this.app.post('/register', this.handleOidcRegistration.bind(this))
      
      // IMPORTANT: Block Auth0's native DCR endpoint to prevent Generic client creation
      this.app.post('/oidc/register', (req: Request, res: Response) => {
        console.warn('⚠️ BLOCKED: Attempt to use Auth0 DCR endpoint which creates Generic clients')
        console.warn('   Redirecting to our /register endpoint which creates SPA clients')
        // Redirect to our registration handler
        this.handleOidcRegistration(req, res)
      })
      
      // Proxy authorization endpoint (like KMSmcp does)
      this.app.get('/authorize', (req: Request, res: Response) => {
        const queryParams = req.url.split('?')[1] || ''
        const urlParams = new URLSearchParams(queryParams)
        const clientId = urlParams.get('client_id')
        
        // Log which client is being used (helps debug caching issues)
        if (clientId) {
          console.log(`🔑 Authorization request for client: ${clientId}`)
          
          // List of known deleted/problematic client IDs
          const deletedClients = [
            '8dKj1R8vTUgQl5yJXyOrEEeXV084zfkj', // Old cached client (deleted)
            'RpNtH2EGMWbYkeYHNtcs5y1lSQzOQAQT', // Generic client (wrong type)
            // Add more problematic client IDs as needed
          ]
          
          if (deletedClients.includes(clientId)) {
            console.warn(`⚠️ BLOCKED: Known deleted client ${clientId}`)
            // Force re-registration by returning an error
            return res.status(400).json({ 
              error: 'invalid_client',
              error_description: 'This client has been deleted. Please reconnect to create a new client.'
            })
          }
        }
        
        const auth0Url = `${this.config.oauth!.issuer}/authorize?${queryParams}`
        console.log('🔀 Proxying authorization to Auth0:', auth0Url)
        res.redirect(auth0Url)
      })
      
      // Proxy token endpoint (like KMSmcp does)
      this.app.post('/oauth/token', async (req: Request, res: Response) => {
        try {
          console.log('🔀 Proxying token exchange to Auth0')
          const tokenResponse = await fetch(`${this.config.oauth!.issuer}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
          })
          
          const tokenData = await tokenResponse.json()
          res.status(tokenResponse.status).json(tokenData)
        } catch (error) {
          console.error('Token proxy error:', error)
          res.status(500).json({ error: 'Token exchange failed' })
        }
      })
    }

    // MCP endpoints using proper SDK StreamableHTTPServerTransport
    // Register at both root (/) and /mcp paths for compatibility
    if (this.config.oauth?.enabled) {
      // Root path (for Claude)
      this.app.post('/', this.authenticateRequest.bind(this), this.handleMcpPostRequest.bind(this))
      this.app.get('/', this.authenticateRequest.bind(this), this.handleMcpGetRequest.bind(this))
      this.app.delete('/', this.authenticateRequest.bind(this), this.handleMcpDeleteRequest.bind(this))
      // /mcp path (for compatibility)
      this.app.post('/mcp', this.authenticateRequest.bind(this), this.handleMcpPostRequest.bind(this))
      this.app.get('/mcp', this.authenticateRequest.bind(this), this.handleMcpGetRequest.bind(this))
      this.app.delete('/mcp', this.authenticateRequest.bind(this), this.handleMcpDeleteRequest.bind(this))
    } else {
      // Root path (for Claude)
      this.app.post('/', this.handleMcpPostRequest.bind(this))
      this.app.get('/', this.handleMcpGetRequest.bind(this))
      this.app.delete('/', this.handleMcpDeleteRequest.bind(this))
      // /mcp path (for compatibility)
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
        // CRITICAL: Send WWW-Authenticate header to trigger OAuth discovery
        // This tells Claude WHERE to find the OAuth configuration
        const serverUrl = `https://${req.get('host')}`
        res.status(401)
          .set('WWW-Authenticate', `Bearer realm="${serverUrl}", as_uri="${serverUrl}"`)
          .json({ error: 'Missing Authorization header' })
        return
      }

      const authContext = await this.authenticator.authenticate(authHeader)
      req.auth = authContext
      next()
    } catch (error) {
      console.error('❌ Authentication failed from:', clientInfo)
      console.error('   Error details:', error)
      const serverUrl = `https://${req.get('host')}`
      res.status(401)
        .set('WWW-Authenticate', `Bearer realm="${serverUrl}", as_uri="${serverUrl}"`)
        .json({ error: 'Authentication failed' })
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

      let transport: StreamableHTTPServerTransport | undefined
      
      // Try to find existing transport
      if (sessionId && this.transports.has(sessionId)) {
        console.log(`[Transport] Using existing transport for session: ${sessionId}`)
        transport = this.transports.get(sessionId)!
      } else if (this.transports.has('default')) {
        console.log('[Transport] No session ID provided, using default transport')
        transport = this.transports.get('default')!
      }
      
      // Create new transport for initialize requests OR if we don't have any transport at all
      if (!transport && (isInitializeRequest(req.body) || this.transports.size === 0)) {
        // New initialization request or no transport exists
        console.log('[Transport] Creating new transport (initialize request or no existing transport)')
        
        const eventStore = new InMemoryEventStore()
        
        // Try stateless mode - Claude isn't managing sessions properly
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Disable session management completely
          eventStore,
          onsessioninitialized: undefined // No session callback in stateless mode
        })

        // Store transport as default for stateless operation
        this.transports.set('default', transport)
        
        // Don't set up onclose handler - keep transport alive for stateless operation
        console.log('[Transport] Created and stored default stateless transport')

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
      }
      
      // If we still don't have a transport, create one for stateless operation
      if (!transport) {
        console.log('[Transport] No transport available, creating stateless transport for non-initialize request')
        
        const eventStore = new InMemoryEventStore()
        
        // Create stateless transport for any request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Disable session management completely
          eventStore,
          onsessioninitialized: undefined // No session callback in stateless mode
        })

        // Store transport as default for stateless operation
        this.transports.set('default', transport)
        
        // Connect the transport to the MCP server
        if (this.mcpServerFactory) {
          const server = this.mcpServerFactory()
          await server.connect(transport)
          console.log('[Transport] Connected stateless transport to MCP server')
        } else {
          throw new Error('MCP server factory not initialized')
        }
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
      
      // Try to get transport by session ID, fall back to default
      let transport: StreamableHTTPServerTransport | undefined
      if (sessionId && this.transports.has(sessionId)) {
        transport = this.transports.get(sessionId)
      } else if (this.transports.has('default')) {
        console.log('Using default transport for GET request (no session ID provided)')
        transport = this.transports.get('default')
      }
      
      if (!transport) {
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
      
      // Try to get transport by session ID, fall back to default
      let transport: StreamableHTTPServerTransport | undefined
      if (sessionId && this.transports.has(sessionId)) {
        transport = this.transports.get(sessionId)
      } else if (this.transports.has('default')) {
        console.log('Using default transport for DELETE request (no session ID provided)')
        transport = this.transports.get('default')
      }
      
      if (!transport) {
        res.status(400).send('Invalid or missing session ID')
        return
      }

      console.log(`Received session termination request for session ${sessionId || 'default'}`)
      
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
   * Handle Dynamic Client Registration
   * Creates SPA clients via Management API (NOT Generic clients via DCR)
   */
  private async handleOidcRegistration(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔐 Dynamic Client Registration request received')
      console.log('📍 Endpoint hit:', req.originalUrl || req.url)
      console.log('🔍 User-Agent:', req.headers['user-agent'])
      console.log('📋 Full headers:', JSON.stringify(req.headers, null, 2))
      console.log('📦 Request body:', JSON.stringify(req.body, null, 2))
      
      // Check if this is coming from Claude or a test
      const isFromClaude = req.headers['user-agent']?.includes('Claude') || 
                          req.headers['user-agent']?.includes('python-httpx')
      console.log('🤖 Request from Claude?', isFromClaude)
      
      const { client_name, redirect_uris, token_endpoint_auth_method } = req.body
      
      // Log what Claude is requesting
      if (token_endpoint_auth_method) {
        console.log('⚠️ Claude requested token_endpoint_auth_method:', token_endpoint_auth_method)
      }
      
      // Management API credentials for creating clients
      const MANAGEMENT_API_CLIENT = {
        client_id: '1O03edTKfEJNTg59CF29XcOTLtnc6OHh',
        client_secret: 'Sxbl5OaXjqfdb1NYlgFyfJr0afbynb6UOIsqFEZiQPxB98h6tRTfUmbRnJUHulQG'
      }
      
      // Get Management API token with proper scopes
      console.log('🔑 Getting Management API token...')
      const tokenResponse = await fetch(`${this.config.oauth!.issuer}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: MANAGEMENT_API_CLIENT.client_id,
          client_secret: MANAGEMENT_API_CLIENT.client_secret,
          audience: `${this.config.oauth!.issuer}/api/v2/`,
          grant_type: 'client_credentials',
          scope: 'create:clients update:clients read:connections update:connections'
        })
      })
      
      const tokenData = await tokenResponse.json() as any
      if (!tokenResponse.ok) {
        console.error('❌ Failed to get Management API token:', tokenData)
        res.status(500).json({ error: 'Failed to get management token' })
        return
      }
      
      // Create SPA client via Management API
      console.log('📱 Creating SPA client via Management API...')
      
      const clientPayload = {
        name: client_name || 'Claude MCP Client',
        app_type: 'spa', // CRITICAL: Must be 'spa' not 'regular_web' or 'native'
        callbacks: redirect_uris || ['https://claude.ai/api/mcp/auth_callback'],
        allowed_origins: redirect_uris?.map((uri: string) => new URL(uri).origin) || ['https://claude.ai'],
        web_origins: redirect_uris?.map((uri: string) => new URL(uri).origin) || ['https://claude.ai'],
        allowed_logout_urls: redirect_uris?.map((uri: string) => new URL(uri).origin) || ['https://claude.ai'],
        grant_types: ['authorization_code', 'refresh_token'],
        jwt_configuration: {
          alg: 'RS256'
        },
        token_endpoint_auth_method: 'none', // SPA clients are public
        oidc_conformant: true,
        is_first_party: true // Mark as first party
      }
      
      console.log('📤 Sending client creation payload:', JSON.stringify(clientPayload, null, 2))
      
      const createClientResponse = await fetch(`${this.config.oauth!.issuer}/api/v2/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        },
        body: JSON.stringify(clientPayload)
      })
      
      const clientData = await createClientResponse.json() as any
      if (!createClientResponse.ok) {
        console.error('❌ Failed to create SPA client:', clientData)
        res.status(500).json({ error: 'Failed to create client' })
        return
      }
      
      // LOG THE FULL RESPONSE TO DEBUG WHY IT'S GENERIC
      console.log('🔍 FULL AUTH0 RESPONSE:')
      console.log(JSON.stringify(clientData, null, 2))
      
      console.log('✅ Client created successfully:', clientData.client_id)
      console.log('📌 App type returned:', clientData.app_type)
      console.log('📌 Token endpoint auth method:', clientData.token_endpoint_auth_method)
      console.log('📌 Grant types:', clientData.grant_types)
      console.log('📌 Is first party:', clientData.is_first_party)
      
      // Verify the client was created as SPA
      if (clientData.app_type !== 'spa') {
        console.warn('⚠️ WARNING: Client was created as', clientData.app_type, 'instead of SPA!')
      }
      
      // CRITICAL: Enable connections for the SPA client
      // Without this, users get "no connections enabled for the client" error
      console.log('🔗 Enabling connections for the new SPA client...')
      
      // Enable both Username-Password-Authentication and google-oauth2 (like KMSmcp)
      // CRITICAL: This MUST succeed or the client won't work
      let connectionsEnabled = false
      try {
        console.log('🔑 Enabling database and social connections for client...')
        
        // Get all connections
        const connResponse = await fetch(
          `${this.config.oauth!.issuer}/api/v2/connections`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`
            }
          }
        )
        
        if (connResponse.ok) {
          const connections = await connResponse.json() as any[]
          console.log(`📌 Found ${connections.length} total connections`)
          
          // Find the specific connections we need (matching KMSmcp pattern)
          const targetConnections = [
            'Username-Password-Authentication',  // Database connection
            'google-oauth2'                      // Social connection  
          ]
          
          let enabledCount = 0
          for (const connName of targetConnections) {
            const connection = connections.find((c: any) => c.name === connName)
            
            if (connection) {
              console.log(`📌 Found ${connection.name} connection (ID: ${connection.id}, strategy: ${connection.strategy})`)
              
              // Get current enabled clients
              const currentClients = connection.enabled_clients || []
              console.log(`📌 Currently enabled for ${currentClients.length} clients`)
              
              // Add our new client if not already there
              if (!currentClients.includes(clientData.client_id)) {
                const updateResponse = await fetch(
                  `${this.config.oauth!.issuer}/api/v2/connections/${connection.id}`,
                  {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${tokenData.access_token}`
                    },
                    body: JSON.stringify({
                      enabled_clients: [...currentClients, clientData.client_id]
                    })
                  }
                )
                
                if (updateResponse.ok) {
                  console.log(`✅ ${connection.name} enabled for client!`)
                  enabledCount++
                } else {
                  const error = await updateResponse.json()
                  console.error(`❌ Failed to enable ${connection.name}:`, error)
                  // CRITICAL: Don't continue if we can't enable connections
                  throw new Error(`Failed to enable ${connection.name}: ${JSON.stringify(error)}`)
                }
              } else {
                console.log(`ℹ️ ${connection.name} already enabled for client`)
                enabledCount++
              }
            } else {
              console.warn(`⚠️ ${connName} connection not found in tenant`)
              // If Username-Password-Authentication doesn't exist, that's critical
              if (connName === 'Username-Password-Authentication') {
                throw new Error('Username-Password-Authentication connection not found!')
              }
            }
          }
          
          connectionsEnabled = enabledCount > 0
          console.log(`📊 Connections enabled: ${enabledCount}/${targetConnections.length}`)
        } else {
          console.error('❌ Failed to get connections:', await connResponse.text())
          throw new Error('Failed to get connections list')
        }
      } catch (error) {
        console.error('❌ Critical error enabling connections:', error)
        // Delete the client if we can't enable connections
        console.log('🗑️ Deleting client since connections failed...')
        try {
          await fetch(
            `${this.config.oauth!.issuer}/api/v2/clients/${clientData.client_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
              }
            }
          )
          console.log('✅ Client deleted')
        } catch (deleteError) {
          console.error('❌ Failed to delete client:', deleteError)
        }
        res.status(500).json({ 
          error: 'registration_failed',
          error_description: 'Failed to enable connections for client'
        })
        return
      }
      
      if (!connectionsEnabled) {
        console.error('⚠️ WARNING: No connections were enabled!')
        res.status(500).json({ 
          error: 'registration_failed',
          error_description: 'No connections could be enabled for client'
        })
        return
      }
      
      // Verify the client was created correctly
      try {
        const verifyResponse = await fetch(
          `${this.config.oauth!.issuer}/api/v2/clients/${clientData.client_id}`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`
            }
          }
        )
        
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json() as any
          console.log('🔍 Final verification:')
          console.log('  - Client Type:', verifyData.app_type)
          console.log('  - Client ID:', verifyData.client_id)
          console.log('  - Name:', verifyData.name)
          console.log('  - Grant Types:', verifyData.grant_types)
          console.log('  - First Party:', verifyData.is_first_party)
        }
      } catch (error) {
        console.error('❌ Error verifying client:', error)
      }
      
      // Return response in DCR format
      const response = {
        client_id: clientData.client_id,
        client_name: clientData.name,
        redirect_uris: clientData.callbacks,
        grant_types: clientData.grant_types,
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        client_secret_expires_at: 0
      }
      
      res.json(response)
    } catch (error) {
      console.error('❌ Registration error:', error)
      res.status(500).json({ error: 'Failed to register client' })
    }
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