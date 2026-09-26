# 🍎 App Store Connect MCP Server

[![npm version](https://img.shields.io/npm/v/@ryaker/appstore-connect-mcp.svg)](https://www.npmjs.com/package/@ryaker/appstore-connect-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

A Model Context Protocol (MCP) server that connects AI assistants like **Claude Desktop**, **Cursor**, **Windsurf**, and **VS Code** to the **Apple App Store Connect API**. 

Automate TestFlight builds, customer review analysis, app metadata updates, and sales reports directly inside your AI coding workflow.

---

## 💡 Quickstart (npx)

No need to clone or build manually! You can run this MCP server directly using `npx`.

### 1. Generate App Store Connect API Key
1. Log into [App Store Connect](https://appstoreconnect.apple.com/).
2. Navigate to **Users and Access** ➔ **Integrations** ➔ **App Store Connect API**.
3. Click **Generate API Key** (Admin or App Manager role recommended).
4. Download the `.p8` key file and note your **Key ID** and **Issuer ID**.

---

### 2. Add to Your MCP Client

#### 🟢 Claude Desktop
Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "appstore-connect": {
      "command": "npx",
      "args": ["-y", "@ryaker/appstore-connect-mcp"],
      "env": {
        "APPLE_KEY_ID": "YOUR_KEY_ID",
        "APPLE_ISSUER_ID": "YOUR_ISSUER_ID",
        "APPLE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
      }
    }
  }
}
```
⚡ Cursor
Add this to ~/.cursor/mcp.json or under Cursor Settings ➔ Features ➔ MCP:
```json
{
  "mcpServers": {
    "appstore-connect": {
      "command": "npx",
      "args": ["-y", "@ryaker/appstore-connect-mcp"],
      "env": {
        "APPLE_KEY_ID": "YOUR_KEY_ID",
        "APPLE_ISSUER_ID": "YOUR_ISSUER_ID",
        "APPLE_PRIVATE_KEY": "YOUR_PRIVATE_KEY_BASE64_OR_RAW"
      }
    }
  }
}
```
🏄 Windsurf
Add this to ~/.codeium/windsurf/mcp_config.json:
```json
JSON
{
  "mcpServers": {
    "appstore-connect": {
      "command": "npx",
      "args": ["-y", "@ryaker/appstore-connect-mcp"],
      "env": {
        "APPLE_KEY_ID": "YOUR_KEY_ID",
        "APPLE_ISSUER_ID": "YOUR_ISSUER_ID",
        "APPLE_PRIVATE_KEY": "YOUR_PRIVATE_KEY"
      }
    }
  }
}
```
🛠️ Features
📱 App Management: View apps, query version statuses, edit localizations & release notes.

✈️ TestFlight Integration: List builds, manage beta testing groups, and add/remove beta testers.

💬 Customer Reviews: Read, summarize, and draft responses to user reviews.

📊 Analytics & Sales: Retrieve unit downloads, revenue metrics, and regional performance.

🔐 Dual Auth Support: Supports direct local API Key authentication or remote OAuth 2.0 (via Auth0).

💬 Example Prompts
Once configured, try asking your AI assistant:

"Show me the latest TestFlight builds for my app and their processing status."

"What are the most recent 1-star reviews on the App Store and summarize user complaints?"

"Update the release notes for version 1.2.0 in English (US)."

"Give me a summary of app downloads for the past 14 days."

🔑 Environment Variables
| Variable | Required | Description |
| :--- | :--- | :--- |
| `APPLE_KEY_ID` | **Yes** | Your App Store Connect API Key ID |
| `APPLE_ISSUER_ID` | **Yes** | Your App Store Connect Issuer ID |
| `APPLE_PRIVATE_KEY` | **Yes** | Raw PEM content or Base64-encoded string of your `.p8` key |
| `APPLE_BUNDLE_ID` | Optional | Restrict tool scope to a specific app bundle ID |
| `APPLE_APP_STORE_ID` | Optional | Restrict tool scope to a specific App Store ID |
| `OAUTH_ENABLED` | Optional | Set `true` if deploying as a remote server via OAuth 2.0 |
| `HOST` | Optional | Interface the HTTP server (`npm start`) binds to. Defaults to `127.0.0.1`; set `0.0.0.0` to accept remote connections, and enable OAuth when you do |

💻 Local Development
If you want to contribute or modify the source code locally:

Bash
```bash
# 1. Clone repo
git clone [https://github.com/ryaker/appstore-connect-mcp.git](https://github.com/ryaker/appstore-connect-mcp.git)
cd appstore-connect-mcp

# 2. Install & build
npm install
npm run build

# 3. Test locally
npm start
```
🤝 Contributing & Support
Feel free to open an Issue for bug reports, missing App Store Connect endpoints, or feature requests!

License: MIT
