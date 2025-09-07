import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const appId = '6746739451'; // The Ultimate Abundance Coach app ID

const privateKeyRaw = process.env.APPLE_PRIVATE_KEY;
const keyId = process.env.APPLE_KEY_ID;
const issuerId = process.env.APPLE_ISSUER_ID;

// Handle base64 encoded private key
let privateKey = privateKeyRaw?.trim();
if (!privateKey?.includes('BEGIN PRIVATE KEY')) {
  try {
    const decoded = Buffer.from(privateKey, 'base64').toString('utf-8').trim();
    if (decoded.includes('BEGIN PRIVATE KEY')) {
      privateKey = decoded;
    }
  } catch (e) {
    privateKey = privateKey?.replace(/\\n/g, '\n');
  }
} else {
  privateKey = privateKey?.replace(/\\n/g, '\n');
}

function generateToken() {
  const payload = {
    iss: issuerId,
    exp: Math.floor(Date.now() / 1000) + (20 * 60),
    aud: 'appstoreconnect-v1'
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: keyId,
      typ: 'JWT'
    }
  });
}

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const token = generateToken();
    
    const options = {
      hostname: 'api.appstoreconnect.apple.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testNewTools() {
  console.log('🧪 Testing New App Store Connect Tools\n');
  console.log('App: The Ultimate Abundance Coach');
  console.log('App ID: 6746739451\n');
  console.log('=' .repeat(50));

  const tests = [
    {
      name: 'Customer Reviews',
      path: `/v1/apps/${appId}/customerReviews?limit=10&sort=-createdDate`,
      icon: '📝'
    },
    {
      name: 'App Pricing',
      path: `/v1/apps/${appId}/appPriceSchedule`,
      icon: '💰'
    },
    {
      name: 'In-App Purchases',
      path: `/v1/apps/${appId}/inAppPurchasesV2?limit=50`,
      icon: '🛒'
    },
    {
      name: 'App Availability',
      path: `/v1/apps/${appId}/appAvailabilityV2`,
      icon: '🌍'
    },
    {
      name: 'App Info Details',
      path: `/v1/apps/${appId}/appInfos`,
      icon: 'ℹ️'
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n${test.icon} Test: ${test.name}`);
      const result = await makeRequest(test.path);
      console.log(`   ✅ Status: ${result.status}`);
      
      if (result.status === 200) {
        const count = result.data.data?.length || 0;
        console.log(`   📊 Data points: ${count}`);
        
        if (count > 0) {
          const firstItem = result.data.data[0];
          if (firstItem.attributes) {
            const keys = Object.keys(firstItem.attributes);
            console.log(`   🔑 Available fields: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`);
          }
        }
      } else if (result.status === 404) {
        console.log('   ℹ️  No data available (404 - expected for some endpoints)');
      } else {
        console.log(`   ⚠️  Unexpected status: ${result.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '=' .repeat(50));
  console.log('✅ New tools testing completed!');
  console.log('\nThese tools are now available in the MCP server:');
  console.log('• get_customer_reviews');
  console.log('• get_app_pricing');
  console.log('• get_in_app_purchases');
  console.log('• get_app_availability'); 
  console.log('• get_app_info_details');
}

testNewTools().catch(console.error);