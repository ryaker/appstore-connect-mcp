# Apple Store Connect MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with Apple Store Connect API, enabling management of iOS/macOS apps, TestFlight, app metadata, and more through Claude Desktop or other MCP clients.

## Features

### App Management
- **List Apps**: View all apps in your App Store Connect account
- **App Information**: Get detailed app info including status and metadata
- **App Store Versions**: Create and manage app store versions
- **Localization**: Update app descriptions and metadata for different markets

### Analytics & Sales
- **Sales Data**: Retrieve sales and revenue information
- **Analytics**: Access app analytics including installs and user engagement
- **Customer Reviews**: Read and analyze customer feedback
- **Pricing Information**: View current app pricing across different regions

### TestFlight Integration
- **Build Management**: View TestFlight builds and their status
- **Beta Groups**: Manage TestFlight beta testing groups
- **Tester Management**: Add and manage beta testers

### Additional Features
- **In-App Purchases**: View and manage in-app purchase products
- **App Availability**: Check app availability across different regions
- **Category & Rating**: Access app category and age rating information

## Setup

### Prerequisites
- Node.js 18+
- Apple Developer Account with App Store Connect access
- App Store Connect API key

### Apple Store Connect API Key Setup

1. **Generate API Key**:
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Navigate to Users and Access → Integrations → App Store Connect API
   - Create a new API key with appropriate permissions

2. **Environment Variables**:
   ```bash
   APPLE_KEY_ID=your_key_id
   APPLE_ISSUER_ID=your_issuer_id  
   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
   your_private_key_content
   -----END PRIVATE KEY-----"
   APPLE_BUNDLE_ID=com.yourcompany.yourapp
   ```

### Installation

```bash
# Clone the repository
git clone https://github.com/ryaker/appstore-connect-mcp.git
cd appstore-connect-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Claude Desktop Configuration

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "appstore-connect": {
      "command": "node",
      "args": ["/path/to/appstore-connect-mcp/dist/src/index.js"],
      "env": {
        "APPLE_KEY_ID": "your_key_id",
        "APPLE_ISSUER_ID": "your_issuer_id",
        "APPLE_PRIVATE_KEY": "your_private_key",
        "APPLE_BUNDLE_ID": "com.yourcompany.yourapp"
      }
    }
  }
}
```

## Usage

Once configured, you can ask Claude to:

- "Show me my app's latest sales data"
- "List all TestFlight builds for my app"
- "What are the recent customer reviews?"
- "Create a new app store version"
- "Add a beta tester to my TestFlight group"

## Remote Deployment with OAuth

### Auth0 Setup (for Remote Access)

1. **Create Auth0 API**:
   - Log into [Auth0 Dashboard](https://manage.auth0.com)
   - Create new API (not Application)
   - Note the Identifier (becomes your audience)

2. **Configure OAuth Settings**:
```env
OAUTH_ENABLED=true
AUTH0_DOMAIN=https://your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier
```

3. **Deploy to Vercel**:
```bash
vercel --prod
```

4. **Configure Claude Desktop for Remote Access**:
```json
{
  "mcpServers": {
    "appstore-connect": {
      "url": "https://your-deployment.vercel.app/mcp"
    }
  }
}
```

Claude will automatically discover OAuth configuration and handle authentication.

## Authentication

This server supports two authentication modes:
- **Local**: Direct API key authentication with Apple Store Connect
- **Remote**: OAuth 2.0 via Auth0 for secure remote access

## Requirements

- Valid Apple Developer Program membership
- App Store Connect access
- API key with appropriate permissions (typically App Manager or Admin)

## License

MIT License - see LICENSE file for details

## Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## Support

- Create an issue for bugs or feature requests
- Check Apple's App Store Connect API documentation for API-specific questions