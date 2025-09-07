/**
 * Express-based MCP Server using Official MCP TypeScript SDK
 * Implements Apple Store Connect API tools with proper OAuth authentication
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HttpTransport } from './transport/HttpTransport.js';
import { AppStoreConnectClient, type AppStoreConfig } from './appstore-client.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Apple Store Connect configuration - handle base64 encoded private key
let privateKey = process.env.APPLE_PRIVATE_KEY!.trim();
// Check if private key is base64 encoded (Vercel stores it this way)
if (!privateKey.includes('BEGIN PRIVATE KEY')) {
  try {
    const decoded = Buffer.from(privateKey, 'base64').toString('utf-8').trim();
    if (decoded.includes('BEGIN PRIVATE KEY')) {
      privateKey = decoded;
    }
  } catch (e) {
    // Not base64, try replacing escaped newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
} else {
  // Fix any escaped newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
}

const appStoreConfig: AppStoreConfig = {
  keyId: process.env.APPLE_KEY_ID!,
  issuerId: process.env.APPLE_ISSUER_ID!,
  privateKey: privateKey,
  bundleId: process.env.APPLE_BUNDLE_ID!,
  appStoreId: process.env.APPLE_APP_STORE_ID,
};

/**
 * Create and configure MCP Server with Apple Store Connect tools
 */
function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'appstore-connect-server',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize Apple Store Connect client
  const appStoreClient = new AppStoreConnectClient(appStoreConfig);

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_apps',
          description: 'List all apps in App Store Connect',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_app_info',
          description: 'Get detailed information about a specific app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The App Store Connect app ID',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'get_sales_data',
          description: 'Get sales and revenue data for a specific date',
          inputSchema: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description: 'Date in YYYY-MM-DD format (optional, defaults to today)',
              },
            },
          },
        },
        {
          name: 'get_analytics',
          description: 'Get app analytics data including installs, sessions, and retention',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The App Store Connect app ID',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'get_builds',
          description: 'Get TestFlight build information for an app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The App Store Connect app ID',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'create_app_store_version',
          description: 'Create a new app store version for an app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The ID of the app',
              },
              platform: {
                type: 'string',
                description: 'The platform (IOS, MAC_OS, TV_OS, VISION_OS)',
                enum: ['IOS', 'MAC_OS', 'TV_OS', 'VISION_OS'],
              },
              versionString: {
                type: 'string',
                description: 'Version string in format X.Y or X.Y.Z (e.g., "1.0" or "1.0.0")',
              },
              copyright: {
                type: 'string',
                description: 'Copyright text for this version (optional)',
              },
              releaseType: {
                type: 'string',
                description: 'How the app should be released (optional)',
                enum: ['MANUAL', 'AFTER_APPROVAL', 'SCHEDULED'],
              },
              earliestReleaseDate: {
                type: 'string',
                description: 'ISO 8601 date string for scheduled release (required when releaseType is SCHEDULED)',
              },
              buildId: {
                type: 'string',
                description: 'ID of the build to associate with this version (optional)',
              },
            },
            required: ['appId', 'platform', 'versionString'],
          },
        },
        {
          name: 'list_app_store_versions',
          description: 'List all app store versions for an app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The ID of the app',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'update_app_store_version_localization',
          description: 'Update app store version localization (descriptions, keywords, what\'s new)',
          inputSchema: {
            type: 'object',
            properties: {
              versionId: {
                type: 'string',
                description: 'The ID of the app store version',
              },
              locale: {
                type: 'string',
                description: 'The locale code (e.g., "en-US", "es-ES", "fr-FR")',
              },
              description: {
                type: 'string',
                description: 'App description for this locale (4000 chars max)',
              },
              keywords: {
                type: 'string',
                description: 'Keywords for app store search (100 chars max)',
              },
              whatsNew: {
                type: 'string',
                description: 'Release notes / what\'s new text (4000 chars max)',
              },
              promotionalText: {
                type: 'string',
                description: 'Promotional text (170 chars max)',
              },
              supportUrl: {
                type: 'string',
                description: 'Support URL for this locale',
              },
              marketingUrl: {
                type: 'string',
                description: 'Marketing URL for this locale',
              },
            },
            required: ['versionId', 'locale'],
          },
        },
        {
          name: 'list_beta_groups',
          description: 'List all TestFlight beta groups for an app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The ID of the app',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'add_tester_to_beta_group',
          description: 'Add a tester to a TestFlight beta group',
          inputSchema: {
            type: 'object',
            properties: {
              groupId: {
                type: 'string',
                description: 'The ID of the beta group',
              },
              email: {
                type: 'string',
                description: 'Email address of the tester',
              },
              firstName: {
                type: 'string',
                description: 'First name of the tester (optional)',
              },
              lastName: {
                type: 'string',
                description: 'Last name of the tester (optional)',
              },
            },
            required: ['groupId', 'email'],
          },
        },
        {
          name: 'get_customer_reviews',
          description: 'Get customer reviews for an app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The ID of the app',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of reviews to return (default: 50)',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'get_app_pricing',
          description: 'Get app pricing information',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The ID of the app',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'get_in_app_purchases',
          description: 'Get in-app purchases for an app',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The ID of the app',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'get_app_availability',
          description: 'Get app availability information',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The ID of the app',
              },
            },
            required: ['appId'],
          },
        },
        {
          name: 'get_app_info_details',
          description: 'Get detailed app info including categories and age rating',
          inputSchema: {
            type: 'object',
            properties: {
              appId: {
                type: 'string',
                description: 'The ID of the app',
              },
            },
            required: ['appId'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'list_apps': {
          const apps = await appStoreClient.listApps();
          return {
            content: [
              {
                type: 'text',
                text: `Found ${apps.length} apps:\n\n${apps
                  .map(
                    (app) =>
                      `• ${app.name} (${app.bundleId})\n  Status: ${app.status}\n  App Store ID: ${app.appStoreId || 'N/A'}\n  Platform: ${app.platform || 'N/A'}`
                  )
                  .join('\n\n')}`,
              },
            ],
          };
        }

        case 'get_app_info': {
          const { appId } = args as { appId: string };
          const appInfo = await appStoreClient.getAppInfo(appId);
          
          if (!appInfo) {
            return {
              content: [
                {
                  type: 'text',
                  text: `App not found with ID: ${appId}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `App Information:
• Name: ${appInfo.name}
• Bundle ID: ${appInfo.bundleId}
• App Store ID: ${appInfo.appStoreId || 'N/A'}
• Status: ${appInfo.status}
• Version: ${appInfo.version || 'N/A'}
• Platform: ${appInfo.platform || 'N/A'}`,
              },
            ],
          };
        }

        case 'get_sales_data': {
          const { date } = args as { date?: string };
          const salesData = await appStoreClient.getSalesData(date);

          return {
            content: [
              {
                type: 'text',
                text: `Sales Data for ${salesData.date}:
• Revenue: ${salesData.currency} ${salesData.revenue.toFixed(2)}
• Units Sold: ${salesData.units}
• Transaction Count: ${salesData.transactionCount}
• Currency: ${salesData.currency}`,
              },
            ],
          };
        }

        case 'get_analytics': {
          const { appId } = args as { appId: string };
          const analytics = await appStoreClient.getAnalytics(appId);

          return {
            content: [
              {
                type: 'text',
                text: `Analytics for App ${appId}:
• Total Installs: ${analytics.installs?.toLocaleString() || 'N/A'}
• Total Sessions: ${analytics.sessions?.toLocaleString() || 'N/A'}
• Active Users: ${analytics.activeUsers?.toLocaleString() || 'N/A'}
• Retention Rates:
  - Day 1: ${((analytics.retention?.day1 || 0) * 100).toFixed(1)}%
  - Day 7: ${((analytics.retention?.day7 || 0) * 100).toFixed(1)}%
  - Day 30: ${((analytics.retention?.day30 || 0) * 100).toFixed(1)}%`,
              },
            ],
          };
        }

        case 'get_builds': {
          const { appId } = args as { appId: string };
          const builds = await appStoreClient.getBuilds(appId);

          return {
            content: [
              {
                type: 'text',
                text: `TestFlight Builds for App ${appId}:

${builds
  .map(
    (build, index) =>
      `${index + 1}. Version ${build.version} (Build ${build.buildNumber})
   • Processing State: ${build.processingState}
   • Uploaded: ${new Date(build.uploadedDate).toLocaleDateString()}
   • Build ID: ${build.id}`
  )
  .join('\n\n')}`,
              },
            ],
          };
        }

        case 'create_app_store_version': {
          const { 
            appId, 
            platform, 
            versionString, 
            copyright, 
            releaseType, 
            earliestReleaseDate,
            buildId 
          } = args as { 
            appId: string;
            platform: string;
            versionString: string;
            copyright?: string;
            releaseType?: string;
            earliestReleaseDate?: string;
            buildId?: string;
          };

          const version = await appStoreClient.createAppStoreVersion({
            appId,
            platform,
            versionString,
            copyright,
            releaseType,
            earliestReleaseDate,
            buildId,
          });

          return {
            content: [
              {
                type: 'text',
                text: `✅ App Store Version Created Successfully:
• Version: ${version.versionString}
• Platform: ${version.platform}
• State: ${version.appStoreState}
• Release Type: ${version.releaseType || 'MANUAL'}
• Version ID: ${version.id}
${version.earliestReleaseDate ? `• Scheduled Release: ${version.earliestReleaseDate}` : ''}
${version.copyright ? `• Copyright: ${version.copyright}` : ''}
• Created: ${new Date(version.createdDate).toLocaleString()}`,
              },
            ],
          };
        }

        case 'list_app_store_versions': {
          const { appId } = args as { appId: string };
          const versions = await appStoreClient.listAppStoreVersions(appId);

          if (versions.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No app store versions found for app ID: ${appId}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `📱 App Store Versions for App ${appId}:

${versions
  .map(
    (version, index) =>
      `${index + 1}. Version ${version.versionString}
   • Platform: ${version.platform}
   • State: ${version.appStoreState}
   • Release Type: ${version.releaseType || 'MANUAL'}
   • Version ID: ${version.id}
   ${version.earliestReleaseDate ? `• Scheduled: ${new Date(version.earliestReleaseDate).toLocaleDateString()}` : ''}
   ${version.copyright ? `• Copyright: ${version.copyright}` : ''}
   • Created: ${new Date(version.createdDate).toLocaleDateString()}`
  )
  .join('\n\n')}`,
              },
            ],
          };
        }

        case 'update_app_store_version_localization': {
          const {
            versionId,
            locale,
            description,
            keywords,
            whatsNew,
            promotionalText,
            supportUrl,
            marketingUrl,
          } = args as {
            versionId: string;
            locale: string;
            description?: string;
            keywords?: string;
            whatsNew?: string;
            promotionalText?: string;
            supportUrl?: string;
            marketingUrl?: string;
          };

          const localization = await appStoreClient.updateAppStoreVersionLocalization({
            versionId,
            locale,
            description,
            keywords,
            whatsNew,
            promotionalText,
            supportUrl,
            marketingUrl,
          });

          return {
            content: [
              {
                type: 'text',
                text: `✅ App Store Version Localization Updated:
• Version ID: ${versionId}
• Locale: ${locale}
• Localization ID: ${localization.id}
${description ? `• Description: ${description.substring(0, 100)}...` : ''}
${keywords ? `• Keywords: ${keywords}` : ''}
${whatsNew ? `• What's New: ${whatsNew.substring(0, 100)}...` : ''}
${promotionalText ? `• Promotional Text: ${promotionalText}` : ''}
${supportUrl ? `• Support URL: ${supportUrl}` : ''}
${marketingUrl ? `• Marketing URL: ${marketingUrl}` : ''}`,
              },
            ],
          };
        }

        case 'list_beta_groups': {
          const { appId } = args as { appId: string };
          const groups = await appStoreClient.listBetaGroups(appId);

          if (groups.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No beta groups found for app ID: ${appId}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `🧪 TestFlight Beta Groups for App ${appId}:

${groups
  .map(
    (group, index) =>
      `${index + 1}. ${group.name}
   • Group ID: ${group.id}
   • Type: ${group.isInternalGroup ? 'Internal' : 'External'}
   ${group.publicLinkEnabled ? `• Public Link: ${group.publicLink}` : ''}
   ${group.publicLinkLimitEnabled ? `• Limit: ${group.publicLinkLimit} testers` : ''}
   • Created: ${new Date(group.createdDate).toLocaleDateString()}`
  )
  .join('\n\n')}`,
              },
            ],
          };
        }

        case 'add_tester_to_beta_group': {
          const { groupId, email, firstName, lastName } = args as {
            groupId: string;
            email: string;
            firstName?: string;
            lastName?: string;
          };

          const result = await appStoreClient.addTesterToBetaGroup({
            groupId,
            email,
            firstName,
            lastName,
          });

          return {
            content: [
              {
                type: 'text',
                text: `✅ ${result.message}
• Email: ${result.email}
• Group ID: ${result.groupId}
• Tester ID: ${result.testerId}
${firstName || lastName ? `• Name: ${firstName || ''} ${lastName || ''}` : ''}`,
              },
            ],
          };
        }

        case 'get_customer_reviews': {
          const { appId, limit } = args as {
            appId: string;
            limit?: number;
          };

          const reviews = await appStoreClient.getCustomerReviews(appId, limit || 50);

          return {
            content: [
              {
                type: 'text',
                text: `📝 Customer Reviews for App ${appId}:

${reviews.length === 0 ? 'No reviews found.' : reviews
  .map(
    (review, index) =>
      `${index + 1}. ${review.title || 'Untitled'}
   • Rating: ${'⭐'.repeat(review.rating)}
   • Reviewer: ${review.reviewerNickname}
   • Territory: ${review.territory}
   • Date: ${new Date(review.createdDate).toLocaleDateString()}
   ${review.body ? `• Review: ${review.body.substring(0, 200)}${review.body.length > 200 ? '...' : ''}` : ''}`
  )
  .join('\n\n')}`,
              },
            ],
          };
        }

        case 'get_app_pricing': {
          const { appId } = args as {
            appId: string;
          };

          const pricing = await appStoreClient.getAppPricing(appId);

          return {
            content: [
              {
                type: 'text',
                text: pricing ? `💰 App Pricing for App ${appId}:

• Base Territory: ${pricing.baseTerritory}
• Currency: ${pricing.currency}

${pricing.prices.length === 0 ? 'No pricing data available.' : pricing.prices
  .map(
    (price: any, index: number) =>
      `${index + 1}. ${price.territory}
   • Customer Price: ${price.price}
   • Developer Proceeds: ${price.proceeds}`
  )
  .join('\n\n')}` : `No pricing information found for app ${appId}.`,
              },
            ],
          };
        }

        case 'get_in_app_purchases': {
          const { appId } = args as {
            appId: string;
          };

          const purchases = await appStoreClient.getInAppPurchases(appId);

          return {
            content: [
              {
                type: 'text',
                text: `🛒 In-App Purchases for App ${appId}:

${purchases.length === 0 ? 'No in-app purchases found.' : purchases
  .map(
    (iap, index) =>
      `${index + 1}. ${iap.name}
   • Product ID: ${iap.productId}
   • Type: ${iap.inAppPurchaseType}
   • State: ${iap.state}
   • Family Sharable: ${iap.familySharable ? 'Yes' : 'No'}
   • Available in All Territories: ${iap.availableInAllTerritories ? 'Yes' : 'No'}
   ${iap.reviewNote ? `• Review Note: ${iap.reviewNote}` : ''}`
  )
  .join('\n\n')}`,
              },
            ],
          };
        }

        case 'get_app_availability': {
          const { appId } = args as {
            appId: string;
          };

          const availability = await appStoreClient.getAppAvailability(appId);

          return {
            content: [
              {
                type: 'text',
                text: availability ? `🌍 App Availability for App ${appId}:

• Available in New Territories: ${availability.availableInNewTerritories ? 'Yes' : 'No'}

Available Territories:
${availability.territories.length === 0 ? 'All territories' : availability.territories
  .map((territory: any, index: number) => `${index + 1}. ${territory}`)
  .join('\n')}` : `No availability information found for app ${appId}.`,
              },
            ],
          };
        }

        case 'get_app_info_details': {
          const { appId } = args as {
            appId: string;
          };

          const details = await appStoreClient.getAppInfoDetails(appId);

          return {
            content: [
              {
                type: 'text',
                text: details ? `ℹ️  Detailed App Info for App ${appId}:

• App Store State: ${details.appStoreState}
• Age Rating: ${details.appStoreAgeRating}
${details.brazilAgeRating ? `• Brazil Age Rating: ${details.brazilAgeRating}` : ''}
${details.kidsAgeBand ? `• Kids Age Band: ${details.kidsAgeBand}` : ''}

Categories:
• Primary Category ID: ${details.primaryCategory || 'Not set'}
${details.primarySubcategoryOne ? `• Primary Subcategory 1: ${details.primarySubcategoryOne}` : ''}
${details.primarySubcategoryTwo ? `• Primary Subcategory 2: ${details.primarySubcategoryTwo}` : ''}
${details.secondaryCategory ? `• Secondary Category: ${details.secondaryCategory}` : ''}
${details.secondarySubcategoryOne ? `• Secondary Subcategory 1: ${details.secondarySubcategoryOne}` : ''}
${details.secondarySubcategoryTwo ? `• Secondary Subcategory 2: ${details.secondarySubcategoryTwo}` : ''}` : `No detailed info found for app ${appId}.`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Start the MCP server with dual transport support (STDIO + HTTP)
 */
async function main() {
  console.log('🚀 Starting Apple Store Connect MCP Server...');
  
  // Validate required environment variables
  const requiredEnvVars = ['APPLE_KEY_ID', 'APPLE_ISSUER_ID', 'APPLE_PRIVATE_KEY', 'APPLE_BUNDLE_ID'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    process.exit(1);
  }

  // Create HTTP transport with OAuth (like KMSmcp)
  console.log('🌐 Starting HTTP transport...');
  const httpTransport = new HttpTransport({
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
    oauth: process.env.OAUTH_ENABLED === 'true' ? {
      enabled: true,
      issuer: process.env.STYTCH_PROJECT_DOMAIN || 'https://test.stytch.com',
      audience: process.env.STYTCH_PROJECT_ID || 'default-audience',
      jwksUri: process.env.STYTCH_JWKS_URI || `${process.env.STYTCH_PROJECT_DOMAIN || 'https://test.stytch.com'}/.well-known/jwks.json`,
    } : undefined,
  });

  // Set MCP server factory for HTTP transport
  httpTransport.setMcpServerFactory(() => createMcpServer());

  try {
    await httpTransport.start();
    console.log('✅ Apple Store Connect MCP Server is running!');
    console.log(`📱 Apps available: ${appStoreConfig.bundleId}`);
    console.log(`🔑 OAuth Authentication: ${process.env.OAUTH_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
    if (process.env.OAUTH_ENABLED === 'true') {
      console.log(`🔐 OAuth Issuer: ${process.env.STYTCH_PROJECT_DOMAIN || 'https://test.stytch.com'}`);
      console.log(`👥 OAuth Audience: ${process.env.STYTCH_PROJECT_ID}`);
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🔌 Shutting down gracefully...');
    await httpTransport.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🔌 Shutting down gracefully...');
    await httpTransport.stop();
    process.exit(0);
  });
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Server crashed:', error);
    process.exit(1);
  });
}

export { createMcpServer };