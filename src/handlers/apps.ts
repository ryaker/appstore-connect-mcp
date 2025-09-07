import { AppStoreConnectClient } from '../services/index.js';
import { ListAppsResponse, AppInfoResponse, AppIncludeOptions } from '../types/index.js';
import { validateRequired, sanitizeLimit } from '../utils/index.js';

export class AppHandlers {
  constructor(private client: AppStoreConnectClient) {}

  async listApps(args: { 
    limit?: number;
    bundleId?: string;
  } = {}): Promise<ListAppsResponse> {
    const { limit = 100, bundleId } = args;
    
    const params: Record<string, any> = {
      limit: sanitizeLimit(limit)
    };
    
    if (bundleId) {
      params['filter[bundleId]'] = bundleId;
    }
    
    return this.client.get<ListAppsResponse>('/apps', params);
  }

  async getAppInfo(args: { 
    appId: string; 
    include?: AppIncludeOptions[];
  }): Promise<AppInfoResponse> {
    const { appId, include } = args;
    
    validateRequired(args, ['appId']);

    const params: Record<string, any> = {};
    if (include?.length) {
      params.include = include.join(',');
    }

    return this.client.get<AppInfoResponse>(`/apps/${appId}`, params);
  }

  async findAppByBundleId(bundleId: string): Promise<{ id: string; attributes: { bundleId: string; name: string; sku: string; primaryLocale: string } } | null> {
    const response = await this.listApps({ bundleId, limit: 1 });
    
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    
    return null;
  }
}