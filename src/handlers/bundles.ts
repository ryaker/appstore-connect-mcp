import { AppStoreConnectClient } from '../services/index.js';
import { 
  ListBundleIdsResponse,
  BundleIdResponse,
  CreateBundleIdRequest,
  EnableCapabilityRequest,
  BundlePlatform,
  CapabilityType,
  CapabilitySetting
} from '../types/index.js';
import { validateRequired, sanitizeLimit, buildFilterParams, buildFieldParams } from '../utils/index.js';

export class BundleHandlers {
  constructor(private client: AppStoreConnectClient) {}

  async createBundleId(args: {
    identifier: string;
    name: string;
    platform: BundlePlatform;
    seedId?: string;
  }): Promise<BundleIdResponse> {
    const { identifier, name, platform, seedId } = args;
    
    validateRequired(args, ['identifier', 'name', 'platform']);

    const requestBody: CreateBundleIdRequest = {
      data: {
        type: "bundleIds",
        attributes: {
          identifier,
          name,
          platform,
          seedId
        }
      }
    };

    return this.client.post<BundleIdResponse>('/bundleIds', requestBody);
  }

  async listBundleIds(args: {
    limit?: number;
    sort?: string;
    filter?: {
      identifier?: string;
      name?: string;
      platform?: BundlePlatform;
      seedId?: string;
    };
    include?: string[];
  } = {}): Promise<ListBundleIdsResponse> {
    const { limit = 100, sort, filter, include } = args;
    
    const params: Record<string, any> = {
      limit: sanitizeLimit(limit)
    };

    if (sort) {
      params.sort = sort;
    }

    Object.assign(params, buildFilterParams(filter));

    if (Array.isArray(include) && include.length > 0) {
      params.include = include.join(',');
    }

    return this.client.get<ListBundleIdsResponse>('/bundleIds', params);
  }

  async getBundleIdInfo(args: {
    bundleIdId: string;
    include?: string[];
    fields?: {
      bundleIds?: string[];
    };
  }): Promise<BundleIdResponse> {
    const { bundleIdId, include, fields } = args;
    
    validateRequired(args, ['bundleIdId']);

    const params: Record<string, any> = {};

    Object.assign(params, buildFieldParams(fields));

    if (include?.length) {
      params.include = include.join(',');
    }

    return this.client.get<BundleIdResponse>(`/bundleIds/${bundleIdId}`, params);
  }

  async enableBundleCapability(args: {
    bundleIdId: string;
    capabilityType: CapabilityType;
    settings?: CapabilitySetting[];
  }): Promise<any> {
    const { bundleIdId, capabilityType, settings } = args;
    
    validateRequired(args, ['bundleIdId', 'capabilityType']);

    const requestBody: EnableCapabilityRequest = {
      data: {
        type: "bundleIdCapabilities",
        attributes: {
          capabilityType,
          settings
        },
        relationships: {
          bundleId: {
            data: {
              id: bundleIdId,
              type: "bundleIds"
            }
          }
        }
      }
    };

    return this.client.post('/bundleIdCapabilities', requestBody);
  }

  async disableBundleCapability(args: {
    capabilityId: string;
  }): Promise<{ success: boolean; message: string }> {
    const { capabilityId } = args;
    
    validateRequired(args, ['capabilityId']);

    await this.client.delete(`/bundleIdCapabilities/${capabilityId}`);

    return { 
      success: true, 
      message: "Capability disabled successfully" 
    };
  }
}