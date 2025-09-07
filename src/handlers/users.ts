import { AppStoreConnectClient } from '../services/index.js';
import { 
  ListUsersResponse,
  UserFilters,
  UserSortOptions,
  UserIncludeOptions
} from '../types/index.js';
import { sanitizeLimit, buildFilterParams } from '../utils/index.js';

export class UserHandlers {
  constructor(private client: AppStoreConnectClient) {}

  async listUsers(args: {
    limit?: number;
    sort?: UserSortOptions;
    filter?: UserFilters;
    include?: UserIncludeOptions[];
  } = {}): Promise<ListUsersResponse> {
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

    return this.client.get<ListUsersResponse>('/users', params);
  }
}