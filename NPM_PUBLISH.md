# NPM Publishing Instructions

The package is built and ready to publish. Follow these steps to publish to npm:

## 1. Login to npm

```bash
npm login
```

You'll need to enter:
- Username: Your npm username
- Password: Your npm password  
- Email: Your email address
- One-time password: From your authenticator app (if 2FA is enabled)

## 2. Verify Login

```bash
npm whoami
```

This should show your npm username.

## 3. Publish the Package

```bash
npm publish --access public
```

The `--access public` flag is required for scoped packages (`@ryaker/appstore-connect-mcp`).

## Package Details

- **Package Name**: `@ryaker/appstore-connect-mcp`
- **Version**: 1.0.0
- **Size**: ~65 KB (compressed)
- **Files**: 110 files included in the package
- **Main Entry**: `dist/index.js`

## What's Included

The package includes:
- Compiled JavaScript files in `dist/`
- TypeScript definitions (`.d.ts` files)
- README.md
- LICENSE
- package.json
- server.json (for MCP Registry)

## What's Excluded

The `.npmignore` file excludes:
- Source TypeScript files
- Test files
- Build configurations
- Environment files
- Documentation guides
- Next.js/Vercel artifacts

## After Publishing

Once published, the package will be available at:
- npm: https://www.npmjs.com/package/@ryaker/appstore-connect-mcp
- Install: `npm install @ryaker/appstore-connect-mcp`

Then you can proceed with publishing to the MCP Registry using the instructions in PUBLISHING.md.

## Updating the Package

To publish updates:
1. Update version in package.json (e.g., 1.0.1)
2. Run `npm run build`
3. Run `npm publish`

## Notes

- The package is already built (`npm run build` completed successfully)
- The `.npmignore` file is configured to exclude unnecessary files
- The package.json includes the required `mcpName` field for MCP Registry validation