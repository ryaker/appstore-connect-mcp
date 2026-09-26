#!/usr/bin/env node
/**
 * STDIO entrypoint for local MCP clients (Claude Desktop, Claude Code, Cursor, ...).
 *
 * This is what `npx @ryaker/appstore-connect-mcp` runs. The HTTP server in
 * index.ts stays the entrypoint for remote deployments (`npm start`).
 */

import { readFileSync } from 'node:fs';

// stdout carries the MCP protocol, so any logging must go to stderr.
console.log = console.info = console.debug = (...args: unknown[]) => console.error(...args);

// Let the key be given as a path to the downloaded .p8 instead of its contents.
if (!process.env.APPLE_PRIVATE_KEY && process.env.APPLE_PRIVATE_KEY_PATH) {
  process.env.APPLE_PRIVATE_KEY = readFileSync(process.env.APPLE_PRIVATE_KEY_PATH, 'utf8');
}

// Imported after the console redirect so nothing they log reaches stdout.
const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
const { createMcpServer } = await import('./index.js');

await createMcpServer().connect(new StdioServerTransport());
