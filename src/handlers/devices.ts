import { AppStoreConnectClient } from '../services/index.js';
import { 
  ListDevicesResponse,
  DeviceFilters,
  DeviceSortOptions,
  DeviceFieldOptions
} from '../types/index.js';
import { sanitizeLimit, buildFilterParams, buildFieldParams } from '../utils/index.js';

export class DeviceHandlers {
  constructor(private client: AppStoreConnectClient) {}

  async listDevices(args: {
    limit?: number;
    sort?: DeviceSortOptions;
    filter?: DeviceFilters;
    fields?: {
      devices?: DeviceFieldOptions[];
    };
  } = {}): Promise<ListDevicesResponse> {
    const { limit = 100, sort, filter, fields } = args;
    
    const params: Record<string, any> = {
      limit: sanitizeLimit(limit)
    };

    if (sort) {
      params.sort = sort;
    }

    Object.assign(params, buildFilterParams(filter));
    Object.assign(params, buildFieldParams(fields));

    return this.client.get<ListDevicesResponse>('/devices', params);
  }
}