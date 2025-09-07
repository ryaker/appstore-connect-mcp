import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
const keyId = process.env.APPLE_KEY_ID;
const issuerId = process.env.APPLE_ISSUER_ID;

console.log('Key ID:', keyId);
console.log('Issuer ID:', issuerId);
console.log('Private Key (first 50 chars):', privateKey.substring(0, 50));

try {
  const payload = {
    iss: issuerId,
    exp: Math.floor(Date.now() / 1000) + (20 * 60),
    aud: 'appstoreconnect-v1'
  };

  const token = jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    keyid: keyId,
  });

  console.log('\nGenerated JWT successfully!');
  console.log('Token (first 100 chars):', token.substring(0, 100));
  
  // Test the token with Apple's API
  const options = {
    hostname: 'api.appstoreconnect.apple.com',
    path: '/v1/apps',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  console.log('\nTesting with Apple API...');
  
  const req = https.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log('Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.end();
  
} catch (error) {
  console.error('Error generating JWT:', error.message);
  console.error('Stack:', error.stack);
}