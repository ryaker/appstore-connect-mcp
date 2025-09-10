/**
 * Client Registry for OAuth Dynamic Client Registration
 * Manages mapping between Claude client IDs and Auth0 client IDs
 */

export interface ClientMapping {
  claudeClientId: string
  auth0ClientId: string
  auth0ClientSecret?: string
  createdAt: Date
  redirectUris: string[]
}

export class ClientRegistry {
  // In-memory storage (production should use Redis/database)
  private clientMappings: Map<string, ClientMapping> = new Map()
  
  /**
   * Store a client mapping
   */
  async storeMapping(claudeClientId: string, auth0ClientId: string, auth0ClientSecret?: string, redirectUris: string[] = []): Promise<void> {
    this.clientMappings.set(claudeClientId, {
      claudeClientId,
      auth0ClientId,
      auth0ClientSecret,
      createdAt: new Date(),
      redirectUris
    })
    
    console.log(`✅ Stored client mapping: Claude ${claudeClientId} -> Auth0 ${auth0ClientId}`)
  }
  
  /**
   * Get Auth0 client ID from Claude client ID
   */
  async getAuth0ClientId(claudeClientId: string): Promise<string | null> {
    const mapping = this.clientMappings.get(claudeClientId)
    return mapping?.auth0ClientId || null
  }
  
  /**
   * Get full client mapping
   */
  async getMapping(claudeClientId: string): Promise<ClientMapping | null> {
    return this.clientMappings.get(claudeClientId) || null
  }
  
  /**
   * Find mapping by Auth0 client ID (reverse lookup)
   */
  async findByAuth0ClientId(auth0ClientId: string): Promise<ClientMapping | null> {
    for (const mapping of this.clientMappings.values()) {
      if (mapping.auth0ClientId === auth0ClientId) {
        return mapping
      }
    }
    return null
  }
  
  /**
   * Get all mappings (for debugging)
   */
  getAllMappings(): Map<string, ClientMapping> {
    return this.clientMappings
  }
}

// Singleton instance
export const clientRegistry = new ClientRegistry()