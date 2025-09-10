/**
 * Auth0 Management API Client
 * Handles dynamic client creation and management
 */

import fetch from 'node-fetch'

export interface Auth0ClientConfig {
  name: string
  app_type: 'spa' | 'native' | 'regular_web' | 'non_interactive'
  callbacks: string[]
  grant_types: string[]
  token_endpoint_auth_method: 'none' | 'client_secret_post' | 'client_secret_basic'
}

export class Auth0Management {
  private issuer: string
  private managementClientId: string
  private managementClientSecret: string
  private managementToken: string | null = null
  private tokenExpiresAt: number = 0
  
  constructor(
    issuer: string,
    managementClientId: string,
    managementClientSecret: string
  ) {
    this.issuer = issuer.replace(/\/$/, '') // Remove trailing slash
    this.managementClientId = managementClientId
    this.managementClientSecret = managementClientSecret
  }
  
  /**
   * Get or refresh Management API token
   */
  private async getManagementToken(): Promise<string> {
    // Check if we have a valid token
    if (this.managementToken && Date.now() < this.tokenExpiresAt) {
      return this.managementToken
    }
    
    console.log('🔑 Getting Auth0 Management API token...')
    
    const response = await fetch(`${this.issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.managementClientId,
        client_secret: this.managementClientSecret,
        audience: `${this.issuer}/api/v2/`,
        grant_type: 'client_credentials'
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get management token: ${error}`)
    }
    
    const data = await response.json() as any
    this.managementToken = data.access_token
    // Set expiry to 5 minutes before actual expiry for safety
    this.tokenExpiresAt = Date.now() + ((data.expires_in - 300) * 1000)
    
    console.log('✅ Got Auth0 Management API token')
    return this.managementToken!
  }
  
  /**
   * Create a new Auth0 client for dynamic registration
   */
  async createClient(
    clientName: string,
    redirectUris: string[]
  ): Promise<{ client_id: string; client_secret?: string }> {
    const token = await this.getManagementToken()
    
    // Auth0 Management API format (different from OAuth DCR format!)
    const clientData: Auth0ClientConfig = {
      name: clientName, // NOT client_name
      app_type: 'spa', // Single Page Application for PKCE flow
      callbacks: redirectUris, // NOT redirect_uris
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none' // Public client for PKCE
    }
    
    console.log('📝 Creating Auth0 client with:', JSON.stringify(clientData, null, 2))
    
    const response = await fetch(`${this.issuer}/api/v2/clients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(clientData)
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create Auth0 client: ${error}`)
    }
    
    const client = await response.json() as any
    console.log(`✅ Auth0 client created: ${client.client_id}`)
    
    // Enable connections for the client
    await this.enableConnections(client.client_id, token)
    
    return {
      client_id: client.client_id,
      client_secret: client.client_secret // Will be undefined for SPA
    }
  }
  
  /**
   * Enable connections for a client
   */
  private async enableConnections(clientId: string, token: string): Promise<void> {
    console.log(`🔗 Enabling connections for client ${clientId}...`)
    
    // Get available connections
    const connectionsResponse = await fetch(`${this.issuer}/api/v2/connections`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!connectionsResponse.ok) {
      console.warn('⚠️ Failed to get connections list')
      return
    }
    
    const connections = await connectionsResponse.json() as any[]
    
    // Enable the first database connection (usually Username-Password-Authentication)
    const dbConnection = connections.find(c => c.strategy === 'auth0')
    if (dbConnection) {
      const updateResponse = await fetch(`${this.issuer}/api/v2/connections/${dbConnection.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled_clients: [...(dbConnection.enabled_clients || []), clientId]
        })
      })
      
      if (updateResponse.ok) {
        console.log(`✅ Enabled ${dbConnection.name} connection for client`)
      } else {
        console.warn(`⚠️ Failed to enable ${dbConnection.name} connection`)
      }
    }
  }
  
  /**
   * Get client details
   */
  async getClient(clientId: string): Promise<any> {
    const token = await this.getManagementToken()
    
    const response = await fetch(`${this.issuer}/api/v2/clients/${clientId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to get client: ${await response.text()}`)
    }
    
    return response.json()
  }
}