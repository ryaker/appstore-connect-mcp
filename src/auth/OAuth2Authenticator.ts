/**
 * OAuth 2.1 Authenticator for Apple Store Connect MCP Server
 * Implements JWT validation with Stytch integration
 * Based on KMSMcp pattern, adapted for Stytch
 */

import jwt, { JwtPayload } from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import fetch from 'node-fetch'
import {
  OAuthConfig,
  AuthContext,
  JWTPayload,
  TokenIntrospectionRequest,
  TokenIntrospectionResponse,
  OAuthError
} from './types.js'

export class OAuth2Authenticator {
  private jwksClient?: jwksClient.JwksClient
  private cache = new Map<string, { context: AuthContext, expires: number }>()
  
  constructor(private config: OAuthConfig) {
    if (config.enabled && config.jwksUri) {
      this.jwksClient = jwksClient({
        jwksUri: config.jwksUri,
        cache: true,
        cacheMaxAge: 600000, // 10 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 10
      })
    }
  }

  /**
   * Authenticate request using Bearer token
   */
  async authenticate(authHeader?: string): Promise<AuthContext> {
    if (!this.config.enabled) {
      return { isAuthenticated: true } // Auth disabled, allow all
    }

    if (!authHeader) {
      throw this.createAuthError('invalid_request', 'Missing Authorization header')
    }

    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw this.createAuthError('invalid_request', 'Invalid Authorization header format')
    }

    const token = parts[1]
    
    // Check cache first
    const cached = this.cache.get(token)
    if (cached && cached.expires > Date.now()) {
      return cached.context
    }

    let context: AuthContext

    try {
      // Try JWT validation first (faster)
      context = await this.validateJWT(token)
      console.log('✅ JWT validation successful')
    } catch (jwtError) {
      const errorMsg = jwtError instanceof Error ? jwtError.message : String(jwtError)
      
      // Check if this is an opaque token (not a JWT)
      if (errorMsg.includes('not a valid JWT format') || errorMsg.includes('opaque token')) {
        console.log('📝 Token appears to be an opaque access token, using Stytch validation')
      } else {
        console.log('⚠️ JWT validation failed:', errorMsg)
      }
      
      try {
        // Fallback to Stytch token validation (for opaque tokens)
        context = await this.validateStytchToken(token)
      } catch (stytchError) {
        console.error('❌ Stytch token validation failed:', stytchError instanceof Error ? stytchError.message : String(stytchError))
        console.error('   Token preview:', token.substring(0, 20) + '...')
        throw this.createAuthError('invalid_token', 'Token validation failed - neither JWT nor valid Stytch token')
      }
    }

    // Cache successful authentication for 5 minutes
    this.cache.set(token, {
      context,
      expires: Date.now() + 300000
    })

    return context
  }

  /**
   * Validate JWT token using JWKS
   */
  private async validateJWT(token: string): Promise<AuthContext> {
    if (!this.jwksClient) {
      throw new Error('JWKS client not configured')
    }

    // First, check if this looks like a JWT (has 3 parts separated by dots)
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Token is not a valid JWT format - might be an opaque token')
    }

    // Try to decode the header to check if it's a valid JWT structure
    try {
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString())
      if (!header.alg || !header.typ) {
        throw new Error('Invalid JWT header structure')
      }
    } catch (e) {
      throw new Error('Token appears malformed - not a valid JWT')
    }

    return new Promise((resolve, reject) => {
      jwt.verify(token, this.getSigningKey.bind(this), {
        audience: this.config.audience,
        issuer: this.config.issuer,
        algorithms: ['RS256', 'ES256']
      }, (err: any, decoded: any) => {
        if (err) {
          reject(err)
          return
        }

        const payload = decoded as JWTPayload
        
        // Validate required claims
        if (!payload.sub || !payload.aud || !payload.iss) {
          reject(new Error('Missing required JWT claims'))
          return
        }

        // Validate audience and resource parameter
        if (payload.aud !== this.config.audience) {
          reject(new Error('Invalid audience'))
          return
        }

        resolve({
          isAuthenticated: true,
          user: {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            roles: payload.roles || []
          },
          token: {
            type: 'Bearer',
            value: token,
            scope: payload.scope,
            expiresAt: new Date(payload.exp * 1000)
          },
          client: payload.client_id ? {
            id: payload.client_id
          } : undefined
        })
      })
    })
  }

  /**
   * Get signing key from JWKS endpoint
   */
  private async getSigningKey(header: jwt.JwtHeader): Promise<string> {
    if (!this.jwksClient) {
      throw new Error('JWKS client not configured')
    }

    return new Promise((resolve, reject) => {
      this.jwksClient!.getSigningKey(header.kid, (err: any, key: any) => {
        if (err) {
          reject(err)
          return
        }
        resolve(key.getPublicKey())
      })
    })
  }

  /**
   * Validate token using Stytch API
   */
  private async validateStytchToken(token: string): Promise<AuthContext> {
    // Use Stytch's session validation endpoint
    const stytchEndpoint = `${this.config.issuer}/v1/sessions/authenticate`
    
    console.log(`🔍 Using Stytch session endpoint for token validation: ${stytchEndpoint}`)

    try {
      const response = await fetch(stytchEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.STYTCH_SECRET}`
        },
        body: JSON.stringify({
          session_token: token
        })
      })

      if (!response.ok) {
        throw new Error(`Stytch session validation failed: ${response.status} ${response.statusText}`)
      }

      const sessionData = await response.json() as any
      console.log(`✅ Token validation successful via Stytch session endpoint`)
      console.log(`  ↳ User ID: ${sessionData.session?.user_id || sessionData.user_id}`)
      console.log(`  ↳ Email: ${sessionData.session?.user?.emails?.[0]?.email || 'N/A'}`)

      const user = sessionData.session?.user || sessionData.user
      const session = sessionData.session

      return {
        isAuthenticated: true,
        user: {
          id: user?.user_id || session?.user_id || 'unknown',
          email: user?.emails?.[0]?.email,
          name: user?.name?.first_name && user?.name?.last_name 
            ? `${user.name.first_name} ${user.name.last_name}` 
            : user?.name?.first_name,
          roles: []
        },
        token: {
          type: 'Bearer',
          value: token,
          scope: 'mcp:read mcp:write mcp:admin', // Assume full access for valid tokens
          expiresAt: session?.expires_at ? new Date(session.expires_at) : undefined
        }
      }
    } catch (error) {
      console.error(`❌ Token validation via Stytch failed:`, error instanceof Error ? error.message : String(error))
      throw new Error('Token validation failed')
    }
  }

  /**
   * Check if user has required scope
   */
  hasScope(context: AuthContext, requiredScope: string): boolean {
    if (!this.config.enabled) return true
    
    const scopes = context.token?.scope?.split(' ') || []
    return scopes.includes(requiredScope)
  }

  /**
   * Create standardized OAuth error
   */
  private createAuthError(error: string, description?: string): Error {
    const authError = new Error(description || error) as Error & { oauth: OAuthError }
    authError.oauth = {
      error,
      error_description: description
    }
    return authError
  }

  /**
   * Clear authentication cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number, hitRate?: number } {
    return {
      size: this.cache.size
    }
  }
}