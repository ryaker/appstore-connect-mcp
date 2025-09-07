/**
 * Vercel Serverless Function for Apple Store Connect MCP Server
 * Uses KMSMcp pattern with StreamableHTTPServerTransport
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { HttpTransport } from '../dist/transport/HttpTransport.js';
import { createMcpServer } from '../dist/index.js';

// Debug environment variables (without exposing sensitive data)
console.log('🔍 Debug: OAUTH_ENABLED =', process.env.OAUTH_ENABLED);
console.log('🔍 Debug: OAuth configured =', !!process.env.OAUTH_ISSUER);

// Create OAuth config from environment variables
const oauthConfig = process.env.OAUTH_ENABLED?.trim() === 'true' ? {
  enabled: true,
  issuer: process.env.OAUTH_ISSUER?.trim(),
  audience: process.env.OAUTH_AUDIENCE?.trim(),
  jwksUri: process.env.OAUTH_JWKS_URI?.trim() || `${process.env.OAUTH_ISSUER?.trim()}/.well-known/jwks.json`,
} : undefined;

console.log('🔍 Debug: OAuth config =', JSON.stringify(oauthConfig, null, 2));

// Create HTTP Transport using KMSMcp pattern
const httpTransport = new HttpTransport({
  port: 3001, // Not used in Vercel
  host: '0.0.0.0',
  cors: {
    origin: '*',
    credentials: true,
  },
  oauth: oauthConfig,
});

// Set MCP server factory
httpTransport.setMcpServerFactory(() => createMcpServer());

// Get the Express app from HttpTransport
const app = (httpTransport as any).app as express.Application;

// Add a test route to verify app is working
app.get('/test-oauth', (req, res) => {
  res.json({ 
    message: 'OAuth test route working',
    oauth_enabled: process.env.OAUTH_ENABLED,
    config: oauthConfig ? 'OAuth config present' : 'OAuth config missing'
  });
});

// Note: Following KMSmcp pattern - we are ONLY a resource server
// We do NOT handle authorization - that's Stytch's job
// Clients should be configured to use Stytch directly for authorization












// Export for Vercel
export default app;