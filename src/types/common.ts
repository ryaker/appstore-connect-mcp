export interface AppStoreConnectConfig {
  keyId: string;
  issuerId: string;
  privateKeyPath: string;
  vendorNumber?: string; // Optional vendor number for sales and finance reports
}

export interface BaseApiResponse<T> {
  data: T;
  links?: {
    self?: string;
    first?: string;
    next?: string;
    prev?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
}

export interface ApiError {
  id: string;
  status: string;
  code: string;
  title: string;
  detail: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
}

export interface ApiErrorResponse {
  errors: ApiError[];
}