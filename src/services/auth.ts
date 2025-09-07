import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import { AppStoreConnectConfig } from '../types/index.js';

export class AuthService {
  constructor(private config: AppStoreConnectConfig) {}

  async generateToken(): Promise<string> {
    const privateKey = await fs.readFile(this.config.privateKeyPath, 'utf-8');
    
    const token = jwt.sign({}, privateKey, {
      algorithm: 'ES256',
      expiresIn: '20m', // App Store Connect tokens can be valid for up to 20 minutes
      audience: 'appstoreconnect-v1',
      keyid: this.config.keyId,
      issuer: this.config.issuerId,
    });

    return token;
  }

  validateConfig(): void {
    if (!this.config.keyId || !this.config.issuerId || !this.config.privateKeyPath) {
      throw new Error(
        "Missing required environment variables. Please set: " +
        "APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_P8_PATH"
      );
    }
  }
}