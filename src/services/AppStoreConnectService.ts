/**
 * App Store Connect API Service
 * Handles all interactions with Apple's App Store Connect API
 */

import jwt from 'jsonwebtoken';
import axios, { AxiosInstance } from 'axios';

export interface AppStoreConnectConfig {
  keyId: string;
  issuerId: string;
  privateKey: string;
}

export class AppStoreConnectService {
  private config: AppStoreConnectConfig;
  private apiClient: AxiosInstance;
  private token?: string;
  private tokenExpiry?: Date;
  
  constructor(config: AppStoreConnectConfig) {
    this.config = config;
    this.apiClient = axios.create({
      baseURL: 'https://api.appstoreconnect.apple.com/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  /**
   * Generate JWT token for App Store Connect API
   */
  private generateToken(): string {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + (20 * 60); // 20 minutes
    
    const payload = {
      iss: this.config.issuerId,
      iat: now,
      exp: expiry,
      aud: 'appstoreconnect-v1',
    };
    
    const token = jwt.sign(payload, this.config.privateKey, {
      algorithm: 'ES256',
      keyid: this.config.keyId,
    });
    
    this.token = token;
    this.tokenExpiry = new Date(expiry * 1000);
    
    return token;
  }
  
  /**
   * Get valid authentication token
   */
  private getAuthToken(): string {
    if (!this.token || !this.tokenExpiry || this.tokenExpiry < new Date()) {
      return this.generateToken();
    }
    return this.token;
  }
  
  /**
   * Make authenticated API request
   */
  private async makeRequest(endpoint: string, params?: any) {
    const token = this.getAuthToken();
    
    try {
      const response = await this.apiClient.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });
      
      return response.data;
    } catch (error: any) {
      console.error(`API request failed: ${endpoint}`, error.response?.data || error.message);
      throw new Error(`App Store Connect API error: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }
  
  /**
   * List all apps
   */
  async listApps() {
    const response = await this.makeRequest('/apps');
    return response.data.map((app: any) => ({
      id: app.id,
      name: app.attributes.name,
      bundleId: app.attributes.bundleId,
      sku: app.attributes.sku,
      primaryLocale: app.attributes.primaryLocale,
    }));
  }
  
  /**
   * Get detailed app information
   */
  async getAppInfo(appId: string) {
    const response = await this.makeRequest(`/apps/${appId}`);
    const app = response.data;
    
    return {
      id: app.id,
      name: app.attributes.name,
      bundleId: app.attributes.bundleId,
      sku: app.attributes.sku,
      primaryLocale: app.attributes.primaryLocale,
      availableInNewTerritories: app.attributes.availableInNewTerritories,
      contentRightsDeclaration: app.attributes.contentRightsDeclaration,
      isOrEverWasMadeForKids: app.attributes.isOrEverWasMadeForKids,
    };
  }
  
  /**
   * List builds for an app
   */
  async listBuilds(appId: string) {
    const response = await this.makeRequest(`/apps/${appId}/builds`);
    return response.data.map((build: any) => ({
      id: build.id,
      version: build.attributes.version,
      uploadedDate: build.attributes.uploadedDate,
      expirationDate: build.attributes.expirationDate,
      expired: build.attributes.expired,
      processingState: build.attributes.processingState,
      usesNonExemptEncryption: build.attributes.usesNonExemptEncryption,
    }));
  }
  
  /**
   * Get sales and download reports
   */
  async getSalesReport(reportType: string, frequency: string, date: string) {
    // Note: Sales reports use a different API endpoint and authentication
    // This is a simplified implementation
    const reportEndpoint = `/salesReports`;
    const params = {
      'filter[reportType]': reportType,
      'filter[frequency]': frequency,
      'filter[reportDate]': date,
      'filter[vendorNumber]': process.env.APPLE_VENDOR_NUMBER,
    };
    
    const response = await this.makeRequest(reportEndpoint, params);
    return response.data;
  }
  
  /**
   * List certificates or provisioning profiles
   */
  async listCertificates(type: 'certificates' | 'profiles') {
    const endpoint = type === 'certificates' ? '/certificates' : '/profiles';
    const response = await this.makeRequest(endpoint);
    
    return response.data.map((item: any) => ({
      id: item.id,
      name: item.attributes.name,
      platform: item.attributes.platform,
      expirationDate: item.attributes.expirationDate,
      certificateType: item.attributes.certificateType,
    }));
  }
}