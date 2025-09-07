/**
 * OAuth 2.1 and Authentication Types for Apple Store Connect MCP
 * Based on KMSMcp pattern, adapted for Stytch
 */

export interface OAuthConfig {
  enabled: boolean
  issuer: string
  audience: string
  clientId?: string
  clientSecret?: string
  jwksUri?: string
  authorizationEndpoint?: string
  tokenEndpoint?: string
  tokenIntrospectionEndpoint?: string
  userInfoEndpoint?: string
}

export interface JWTPayload {
  iss: string    // Issuer
  sub: string    // Subject (user ID)
  aud: string    // Audience
  exp: number    // Expiration time
  iat: number    // Issued at
  nbf?: number   // Not before
  scope?: string // OAuth scopes
  client_id?: string
  resource?: string
  email?: string // User email
  name?: string  // User display name
  roles?: string[] // User roles
}

export interface AuthContext {
  isAuthenticated: boolean
  user?: {
    id: string
    email?: string
    name?: string
    roles?: string[]
  }
  token?: {
    type: 'Bearer'
    value: string
    scope?: string
    expiresAt?: Date
  }
  client?: {
    id: string
    name?: string
  }
}

export interface ProtectedResourceMetadata {
  resource: string
  authorization_servers: string[]
  scopes_supported?: string[]
  bearer_methods_supported?: string[]
  resource_documentation?: string
}

export interface AuthorizationServerMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
  response_types_supported: string[]
  grant_types_supported: string[]
  token_endpoint_auth_methods_supported: string[]
  code_challenge_methods_supported?: string[]
  scopes_supported?: string[]
  registration_endpoint?: string
}

export interface OAuthError {
  error: string
  error_description?: string
  error_uri?: string
  state?: string
}

export interface TokenIntrospectionRequest {
  token: string
  token_type_hint?: 'access_token' | 'refresh_token'
}

export interface TokenIntrospectionResponse {
  active: boolean
  client_id?: string
  username?: string
  scope?: string
  exp?: number
  iat?: number
  nbf?: number
  sub?: string
  aud?: string
  iss?: string
  jti?: string
}