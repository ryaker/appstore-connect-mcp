# OAuth-Protected Remote MCP with Auth0: The Undocumented Critical Details

## The Two Most Critical Discoveries That Will Save You Days of Debugging

After extensive debugging, we discovered two absolutely critical implementation details that are **completely undocumented** but will make or break your OAuth MCP implementation:

### 🚨 Discovery #1: The `authorization_servers` Field Controls Everything
Without setting this field to YOUR server URL in the protected resource metadata, Claude will bypass your server entirely and create clients directly at Auth0, causing mysterious "Generic" clients to appear.

### 🚨 Discovery #2: Auth0's DCR Creates the Wrong Client Type
Auth0's OIDC Dynamic Client Registration creates "Generic" clients that **cannot** use database connections. You MUST use the Management API to create "SPA" clients instead.

> **Note**: This guide assumes you've already read [Auth0's MCP Authentication Guide](https://auth0.com/ai/docs/mcp/auth-for-mcp) but are hitting walls that the documentation doesn't even hint at.

## Table of Contents
1. [The Client Type Problem](#the-client-type-problem)
2. [Discovery Document Override Requirements](#discovery-document-override-requirements)
3. [Token Validation Complexity](#token-validation-complexity)
4. [Session Management Challenges](#session-management-challenges)
5. [Critical Implementation Checklist](#critical-implementation-checklist)

---

## The Client Type Problem

### What We Discovered Through Trial and Error
When Claude connects to your MCP, it tries to dynamically register a client. The Auth0 documentation suggests using their OIDC DCR endpoint (`/oidc/register`), but here's what they don't tell you:

**The `/oidc/register` endpoint ALWAYS creates "Generic" type clients, not "SPA" clients.**

This single undocumented fact caused hours of debugging because:
- Generic clients **CANNOT** use database connections (Username-Password-Authentication) 
- You'll get cryptic errors like: `"Username-Password-Authentication does not exist or is not a domain connection"`
- Generic clients are limited to enterprise/domain connections only
- Meanwhile, SPA clients **CAN** use both database and social connections

**How We Figured This Out:**
We noticed that test scripts created SPA clients but Claude always created Generic clients. After examining Auth0 logs, we discovered Claude was hitting `/oidc/register` directly, which ONLY creates Generic clients regardless of parameters.

### The Solution
Don't use Auth0's `/oidc/register` endpoint. Instead, proxy registration requests and use the Management API:

```typescript
// DON'T do this - creates Generic clients
const response = await fetch(`${AUTH0_DOMAIN}/oidc/register`, {
  method: 'POST',
  body: JSON.stringify(clientData)
});

// DO this - creates SPA clients with proper connections
const mgmtToken = await getManagementAPIToken();
const client = await fetch(`${AUTH0_DOMAIN}/api/v2/clients`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${mgmtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: client_name,
    app_type: 'spa', // CRITICAL: Must be 'spa', not 'non_interactive'
    oidc_conformant: true,
    jwt_configuration: {
      alg: 'RS256'
    },
    grant_types: ['authorization_code', 'refresh_token'],
    // ... other config
  })
});

// Then enable connections (must be done AFTER client creation)
await fetch(`${AUTH0_DOMAIN}/api/v2/clients/${clientId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${mgmtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    connections: [
      { name: 'Username-Password-Authentication', enabled: true },
      { name: 'google-oauth2', enabled: true }
    ]
  })
});
```

---

## Discovery Document Override Requirements

### The Hidden Field That Changes Everything: `authorization_servers`

This was our biggest breakthrough. Even after fixing client types, Claude was STILL creating Generic clients. Why? Because it was bypassing our server entirely!

**The Undocumented Behavior:**
When Claude fetches `/.well-known/oauth-protected-resource`, it looks for the `authorization_servers` field. If this field points to Auth0, Claude will:
1. Ignore your proxy endpoints completely
2. Fetch Auth0's discovery document directly
3. Use Auth0's `/oidc/register` endpoint (creating Generic clients)
4. Never hit your `/register` endpoint at all

**How We Discovered This:**
After hours of debugging, we noticed Claude was creating clients at Auth0 without ever hitting our `/register` endpoint. By comparing with a working MCP (KMSmcp), we found they set `authorization_servers` to their own server URL, not Auth0's.

### Critical Fields to Override

```typescript
// /.well-known/oauth-authorization-server
{
  issuer: 'https://YOUR-SERVER.com',  // NOT Auth0's domain!
  authorization_endpoint: 'https://YOUR-SERVER.com/authorize',
  token_endpoint: 'https://YOUR-SERVER.com/oauth/token',
  registration_endpoint: 'https://YOUR-SERVER.com/register',
  jwks_uri: AUTH0_JWKS_URI, // This can still point to Auth0
  // ... other fields
}

// /.well-known/oauth-protected-resource
{
  resource: 'https://YOUR-SERVER.com',
  authorization_servers: ['https://YOUR-SERVER.com'], // 🚨 THE MOST CRITICAL FIELD
  // WRONG: authorization_servers: ['https://your-tenant.auth0.com']
  // If this points to Auth0, Claude bypasses ALL your proxy endpoints!
  bearer_methods_supported: ['header'],
  scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin']
}
```

**The `authorization_servers` Discovery Process:**
1. Claude fetches your `/.well-known/oauth-protected-resource`
2. It reads the `authorization_servers` array
3. It then fetches `{authorization_server}/.well-known/oauth-authorization-server`
4. If this points to Auth0, it uses Auth0's endpoints directly
5. Your proxy is completely bypassed, and Generic clients are created

**This single field determines whether your implementation works or fails.**

---

## Token Validation Complexity

### The Issue Nobody Tells You
Auth0 can return either JWT tokens or opaque access tokens, and you must handle both.

### Dual-Mode Token Validation

```typescript
async validateToken(token: string): Promise<AuthContext> {
  try {
    // First, try JWT validation
    return await this.validateJWT(token);
  } catch (jwtError) {
    // If JWT validation fails, try opaque token validation
    // Check if it's actually an opaque token (not a malformed JWT)
    const parts = token.split('.');
    if (parts.length !== 3) {
      // Opaque token - validate via userinfo endpoint
      return await this.validateOpaqueToken(token);
    }
    throw jwtError; // It was a JWT but invalid
  }
}

async validateOpaqueToken(token: string): Promise<AuthContext> {
  // Auth0's userinfo endpoint validates opaque tokens
  const response = await fetch(`${AUTH0_DOMAIN}/userinfo`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Invalid token');
  }
  
  const userInfo = await response.json();
  return {
    isAuthenticated: true,
    user: {
      id: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name
    }
  };
}
```

---

## Session Management Challenges

### The Issue Nobody Tells You
Claude doesn't consistently send `mcp-session-id` headers, breaking session-based transports.

### Fallback Session Strategy

```typescript
private async handleMcpPostRequest(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string;
  
  let transport: StreamableHTTPServerTransport;
  
  if (sessionId && this.transports.has(sessionId)) {
    // Use existing transport for session
    transport = this.transports.get(sessionId)!;
  } else if (!sessionId && this.transports.has('default')) {
    // FALLBACK: Claude didn't send session ID, use default
    transport = this.transports.get('default')!;
  } else if (isInitializeRequest(req.body)) {
    // Create new transport
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        this.transports.set(sessionId, transport);
        // ALSO store as default for fallback
        this.transports.set('default', transport);
      }
    });
    // ... connect to MCP server
  }
  
  await transport.handleRequest(req, res, req.body);
}
```

---

## Critical Implementation Checklist

### Must-Have Configurations

```typescript
// 1. WWW-Authenticate Header (required for OAuth trigger)
res.status(401)
   .set('WWW-Authenticate', `Bearer realm="${serverUrl}", as_uri="${serverUrl}"`)
   .json({ error: 'Unauthorized' });

// 2. Multiple Audience Support (Claude may use different URLs)
jwt.verify(token, getSigningKey, {
  audience: [
    'https://your-server.com',
    'https://your-deployment.vercel.app',
    'https://your-preview-urls.vercel.app'
  ],
  issuer: AUTH0_DOMAIN,
  algorithms: ['RS256']
});

// 3. Root Path MCP Endpoints (not just /mcp)
app.post('/', authenticateRequest, handleMcpPostRequest);
app.get('/', authenticateRequest, handleMcpGetRequest);
app.delete('/', authenticateRequest, handleMcpDeleteRequest);
// Also support /mcp for compatibility
app.post('/mcp', authenticateRequest, handleMcpPostRequest);

// 4. Proxy ALL OAuth Endpoints
app.get('/authorize', (req, res) => {
  // Proxy to Auth0 but maintain control
  const auth0Url = `${AUTH0_DOMAIN}/authorize?${req.url.split('?')[1]}`;
  res.redirect(auth0Url);
});

app.post('/oauth/token', async (req, res) => {
  // Proxy token exchange
  const response = await fetch(`${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  });
  const data = await response.json();
  res.json(data);
});
```

### Common Pitfalls to Avoid

1. **Don't trust Claude's session management** - Always implement fallback mechanisms
2. **Don't use Auth0's DCR endpoint directly** - It creates the wrong client type
3. **Don't forget to override `authorization_servers`** - Or Claude bypasses your server
4. **Don't assume JWT tokens only** - Handle opaque tokens too
5. **Don't hardcode audiences** - Support multiple deployment URLs
6. **Don't skip connection enabling** - SPA clients need explicit connection configuration

### Testing Your Implementation

1. **Verify Client Type**: Check Auth0 dashboard - clients should be "Single Page Application" not "Generic"
2. **Check Connections**: Ensure "Username-Password-Authentication" is enabled on created clients
3. **Monitor Logs**: Watch for direct Auth0 hits vs your proxy endpoints
4. **Test Token Types**: Verify both JWT and opaque tokens validate correctly
5. **Session Fallback**: Confirm MCP works even without session headers

---

## Environment Variables

```env
# Auth0 Configuration
AUTH0_DOMAIN=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=your_management_client_id
AUTH0_CLIENT_SECRET=your_management_client_secret
AUTH0_MANAGEMENT_AUDIENCE=https://your-tenant.auth0.com/api/v2/

# OAuth Configuration
OAUTH_ENABLED=true
OAUTH_ISSUER=https://your-tenant.auth0.com
OAUTH_AUDIENCE=https://your-mcp-server.com
OAUTH_JWKS_URI=https://your-tenant.auth0.com/.well-known/jwks.json

# Your Server URL (critical for discovery documents)
SERVER_URL=https://your-mcp-server.com
```

---

## Summary: The Undocumented Gotchas That Will Break Your Implementation

After days of debugging, here are the absolutely critical, completely undocumented requirements:

### 🔴 The Two Showstoppers:

1. **`authorization_servers` Must Point to YOUR Server**
   - Located in `/.well-known/oauth-protected-resource`
   - If this points to Auth0, Claude bypasses your entire proxy
   - This single field caused 90% of our debugging time

2. **Never Use Auth0's `/oidc/register` Endpoint**
   - It creates Generic clients that cannot use database connections
   - You MUST use Management API to create SPA clients
   - This is nowhere in Auth0's documentation

### 🟡 Other Critical Undocumented Behaviors:

3. **Token Validation Must Handle Two Types**: Auth0 returns both JWT and opaque tokens
4. **Session IDs Are Unreliable**: Claude doesn't consistently send them
5. **Connections Need Manual Enabling**: Even for SPA clients
6. **Multiple Audiences Required**: Claude uses different URLs for the same server
7. **WWW-Authenticate Header Needs `as_uri`**: Or OAuth flow won't trigger

Without knowing these specific undocumented details, you'll spend days debugging mysterious "Generic" clients and "connection not enabled" errors that make no sense based on the official documentation.

---

*This guide is based on real-world implementation experience with Claude Desktop/iOS/Web and Auth0 integration as of January 2025.*