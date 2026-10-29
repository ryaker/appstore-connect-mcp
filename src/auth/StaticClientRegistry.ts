/**
 * Static Client Registry for OAuth
 * Temporary workaround until we get create:clients scope in Auth0
 */

import { ClientMapping, clientRegistry } from './ClientRegistry.js'

// Using the Management API client that has connections enabled in Auth0
const STATIC_AUTH0_CLIENT = {
  client_id: process.env.AUTH0_MANAGEMENT_CLIENT_ID || '',
  client_secret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET || ''
}

// Generate a unique Claude client ID for this session
const STATIC_CLAUDE_CLIENT_ID = `claude_${Date.now()}_${Math.random().toString(36).substring(7)}`

/**
 * Initialize static client mappings
 */
export async function initializeStaticMappings(): Promise<void> {
  if (!STATIC_AUTH0_CLIENT.client_id || !STATIC_AUTH0_CLIENT.client_secret) {
    throw new Error('AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET must be set')
  }

  // Store the static mapping
  await clientRegistry.storeMapping(
    STATIC_CLAUDE_CLIENT_ID,
    STATIC_AUTH0_CLIENT.client_id,
    STATIC_AUTH0_CLIENT.client_secret,
    ['https://claude.ai/api/mcp/auth_callback']
  )
  
  console.log('✅ Initialized static client mapping')
  console.log(`   Claude ID: ${STATIC_CLAUDE_CLIENT_ID}`)
  console.log(`   Auth0 ID: ${STATIC_AUTH0_CLIENT.client_id}`)
}

/**
 * Get the static Claude client configuration
 */
export function getStaticClaudeClient() {
  return {
    client_id: STATIC_CLAUDE_CLIENT_ID,
    client_name: 'Claude MCP Client',
    redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'mcp:read mcp:write mcp:admin',
    client_id_issued_at: Math.floor(Date.now() / 1000),
    token_endpoint_auth_method: 'none'
  }
}