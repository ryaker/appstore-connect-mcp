# Publishing to MCP Registry

This guide explains how to publish the Apple Store Connect MCP server to the official MCP Registry.

## Prerequisites

1. The server must be published to npm first
2. You must have access to the GitHub account `ryaker` for authentication

## Steps to Publish

### 1. Install the MCP Publisher CLI

Using Homebrew (recommended):
```bash
brew tap modelcontextprotocol/tap
brew install mcp-publisher
```

Or download pre-built binaries from:
https://github.com/modelcontextprotocol/registry/releases

### 2. Verify server.json

The `server.json` file has already been created with all necessary configuration. Review it to ensure all information is accurate.

### 3. Publish to npm First

Before publishing to the MCP Registry, the package must be available on npm:

```bash
# Build the project
npm run build

# Update package.json with mcpName field (already done)
# Publish to npm
npm publish --access public
```

### 4. Authenticate with GitHub

Since we're using the `io.github.ryaker` namespace:

```bash
mcp-publisher login github
```

This will open your browser for GitHub OAuth authentication.

### 5. Publish to MCP Registry

Once authenticated and the npm package is published:

```bash
mcp-publisher publish
```

### 6. Verify Publication

Check that your server appears in the registry:

```bash
curl https://registry.modelcontextprotocol.io/servers/io.github.ryaker/appstore-connect-mcp
```

## Important Notes

- The package.json must include `"mcpName": "io.github.ryaker/appstore-connect-mcp"` (already added)
- The npm package name should match what's in server.json
- Make sure all sensitive information is removed before publishing
- The OAuth configuration in server.json points to the public deployment

## Troubleshooting

If you encounter issues:

1. **Package validation failed**: Ensure the npm package includes the mcpName field
2. **Authentication failed**: Make sure you're logged into the correct GitHub account
3. **Namespace not authorized**: The GitHub username must match the namespace in server.json

## Alternative: Manual PR Submission

If the CLI tool isn't working, you can manually submit a PR to add your server:

1. Fork https://github.com/modelcontextprotocol/registry
2. Add your server entry to `data/seed.json`
3. Create a pull request

The entry format for seed.json would be:
```json
{
  "name": "io.github.ryaker/appstore-connect-mcp",
  "description": "MCP server for Apple Store Connect API integration with OAuth authentication support",
  "version": "1.0.0",
  "author": {
    "name": "Ryan Aker",
    "url": "https://github.com/ryaker"
  },
  "homepage": "https://github.com/ryaker/appstore-connect-mcp",
  "repository": {
    "type": "git",
    "url": "https://github.com/ryaker/appstore-connect-mcp.git"
  },
  "license": "MIT",
  "categories": ["app-development", "analytics", "monitoring"],
  "tags": ["apple", "app-store", "ios", "app-store-connect", "analytics", "reviews", "ratings", "oauth", "auth0"],
  "runtime": "node",
  "packages": [
    {
      "registry_type": "npm",
      "identifier": "@ryaker/appstore-connect-mcp",
      "version": "1.0.0"
    }
  ]
}
```