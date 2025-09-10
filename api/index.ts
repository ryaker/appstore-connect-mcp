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
const oauthConfig = process.env.OAUTH_ENABLED?.trim() === 'true' && process.env.OAUTH_ISSUER ? {
  enabled: true,
  issuer: process.env.OAUTH_ISSUER.trim(),
  audience: process.env.OAUTH_AUDIENCE?.trim() || 'https://asconnect.abundancecoach.ai',
  jwksUri: process.env.OAUTH_JWKS_URI?.trim() || `${process.env.OAUTH_ISSUER.trim()}/.well-known/jwks.json`,
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

// Add test routes to verify app is working
app.get('/test-oauth', (req, res) => {
  res.json({ 
    message: 'OAuth test route working',
    oauth_enabled: process.env.OAUTH_ENABLED,
    config: oauthConfig ? 'OAuth config present' : 'OAuth config missing'
  });
});

app.get('/test-apple-config', (req, res) => {
  res.json({ 
    message: 'Apple Store Connect config check',
    APPLE_KEY_ID: process.env.APPLE_KEY_ID ? 'Set' : 'Not set',
    APPLE_ISSUER_ID: process.env.APPLE_ISSUER_ID ? 'Set' : 'Not set',
    APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY ? `Set (${process.env.APPLE_PRIVATE_KEY.substring(0, 20)}...)` : 'Not set',
    APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID ? 'Set' : 'Not set',
    APPLE_APP_STORE_ID: process.env.APPLE_APP_STORE_ID ? 'Set' : 'Not set'
  });
});

// Debug endpoint to test JWT generation
app.get('/test-jwt', async (req, res) => {
  try {
    const jwt = await import('jsonwebtoken');
    
    let privateKey = process.env.APPLE_PRIVATE_KEY || '';
    
    // Debug: Check if it's base64 encoded
    const isBase64 = !privateKey.includes('BEGIN PRIVATE KEY');
    
    if (isBase64) {
      try {
        const decoded = Buffer.from(privateKey, 'base64').toString('utf-8').trim();
        if (decoded.includes('BEGIN PRIVATE KEY')) {
          privateKey = decoded;
        }
      } catch (e) {
        console.error('Failed to decode base64:', e);
      }
    }
    
    // Debug: Check key format
    const hasBeginMarker = privateKey.includes('BEGIN PRIVATE KEY');
    const hasEndMarker = privateKey.includes('END PRIVATE KEY');
    
    const payload = {
      iss: process.env.APPLE_ISSUER_ID?.trim(),
      exp: Math.floor(Date.now() / 1000) + (20 * 60),
      aud: 'appstoreconnect-v1'
    };
    
    // Try to generate JWT
    let token = null;
    let error = null;
    
    try {
      token = jwt.default.sign(payload, privateKey, {
        algorithm: 'ES256',
        header: {
          alg: 'ES256',
          kid: process.env.APPLE_KEY_ID?.trim(),
          typ: 'JWT'
        }
      });
    } catch (e: any) {
      error = e.message;
    }
    
    res.json({
      success: !!token,
      debug: {
        wasBase64: isBase64,
        hasBeginMarker,
        hasEndMarker,
        keyLength: privateKey.length,
        keyPreview: privateKey.substring(0, 50) + '...',
        issuer: process.env.APPLE_ISSUER_ID?.trim(),
        keyId: process.env.APPLE_KEY_ID?.trim()
      },
      error: error,
      token: token ? token.substring(0, 50) + '...' : null
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Test endpoint for Apple Store Connect API
app.get('/test-apple-api', async (req, res) => {
  try {
    // Import and create client
    const { AppStoreConnectClient } = await import('../dist/appstore-client.js');
    
    let privateKey = process.env.APPLE_PRIVATE_KEY || '';
    
    // Decode if base64
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      try {
        const decoded = Buffer.from(privateKey, 'base64').toString('utf-8').trim();
        if (decoded.includes('BEGIN PRIVATE KEY')) {
          privateKey = decoded;
        }
      } catch (e) {
        console.error('Failed to decode base64:', e);
      }
    }
    
    const client = new AppStoreConnectClient({
      keyId: (process.env.APPLE_KEY_ID || '').trim(),
      issuerId: (process.env.APPLE_ISSUER_ID || '').trim(),
      privateKey: privateKey.trim(),
      bundleId: (process.env.APPLE_BUNDLE_ID || '').trim(),
      appStoreId: process.env.APPLE_APP_STORE_ID?.trim()
    });
    
    // Try to list apps
    const apps = await client.listApps();
    
    // Get detailed info about the first app if it exists
    let appDetails = null;
    if (apps.length > 0) {
      try {
        appDetails = await client.getAppInfo(apps[0].id);
      } catch (e) {
        console.error('Failed to get app details:', e);
      }
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      appleApiEndpoint: 'https://api.appstoreconnect.apple.com/v1/apps',
      authentication: {
        method: 'JWT ES256',
        issuer: (process.env.APPLE_ISSUER_ID || '').trim(),
        keyId: (process.env.APPLE_KEY_ID || '').trim()
      },
      apps: apps,
      appDetails: appDetails,
      count: apps.length,
      proof: {
        message: 'This data is fetched live from Apple Store Connect API',
        appStoreLink: apps.length > 0 ? `https://apps.apple.com/app/id${apps[0].id}` : null
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    });
  }
});

// Note: Following KMSmcp pattern - we are ONLY a resource server
// We do NOT handle authorization - that's Stytch's job
// Clients should be configured to use Stytch directly for authorization












// Export for Vercel
export default app;