# Auth0 Setup for Apple Store Connect MCP

## Requirements

For the OAuth flow to work with Claude iOS, you need to configure Auth0 properly.

## 1. Enable Dynamic Client Registration

1. Go to **Auth0 Dashboard** → **Applications** → **Advanced Settings**
2. Enable **"Dynamic Client Registration"**
3. Save changes

## 2. Enable a Domain Connection (REQUIRED)

OIDC DCR clients can ONLY use domain connections (database or enterprise), NOT social connections.

### Option A: Enable Username-Password-Authentication (Recommended)

1. Go to **Auth0 Dashboard** → **Authentication** → **Database**
2. Click on **Username-Password-Authentication**
3. Make sure it's **Enabled** (toggle should be ON)
4. This is a domain connection that works with OIDC DCR

### Option B: Create a Custom Database Connection

1. Go to **Auth0 Dashboard** → **Authentication** → **Database**  
2. Click **+ Create DB Connection**
3. Name it (e.g., "mcp-users")
4. Enable it

### What WON'T Work:

Social connections will NOT work with OIDC DCR:
- ❌ google-oauth2
- ❌ github
- ❌ facebook
- ❌ twitter

Error: `google-oauth2 does not exist or is not a domain connection`

## 3. Configure Tenant Settings

1. Go to **Auth0 Dashboard** → **Settings** → **General**
2. Make sure your tenant has at least one database connection enabled
3. Set default connection if needed

## 4. Test the Configuration

Once configured, Claude iOS should be able to:
1. Discover OAuth endpoints at `https://asconnect.abundancecoach.ai/.well-known/oauth-authorization-server`
2. Register a client via POST to `https://asconnect.abundancecoach.ai/register`
3. Authenticate using Auth0's universal login with the database connection
4. Complete the OAuth flow successfully

## Troubleshooting

### "no connections enabled for the client"
- This means the client was created via Management API, not OIDC DCR
- Solution: Use the `/register` endpoint which proxies to `/oidc/register`

### "google-oauth2 does not exist or is not a domain connection"
- This means you're trying to use a social connection with an OIDC DCR client
- Solution: Enable Username-Password-Authentication or another database connection

### "Dynamic Client Registration is not enabled"
- Go to Applications → Advanced Settings → Enable Dynamic Client Registration

## Important Notes

- OIDC DCR clients are "public" clients that use universal login
- They automatically work with ANY domain connection enabled at the tenant level
- They CANNOT use social connections (Google, GitHub, etc.)
- No per-client connection configuration is needed (or possible) for OIDC DCR clients