export type AnalyticsReportCategory = 
  | 'APP_STORE_ENGAGEMENT' 
  | 'APP_STORE_COMMERCE' 
  | 'APP_USAGE' 
  | 'FRAMEWORKS_USAGE' 
  | 'PERFORMANCE';

export type AnalyticsAccessType = 'ONGOING' | 'ONE_TIME_SNAPSHOT';

export interface AnalyticsReportRequest {
  data: {
    type: 'analyticsReportRequests';
    attributes: {
      accessType: AnalyticsAccessType;
    };
    relationships: {
      app: {
        data: {
          id: string;
          type: 'apps';
        };
      };
    };
  };
}

export interface AnalyticsReportRequestResponse {
  data: {
    id: string;
    type: 'analyticsReportRequests';
    attributes: {
      accessType: AnalyticsAccessType;
      stoppedDueToInactivity: boolean;
    };
    relationships: {
      app: {
        data: {
          id: string;
          type: 'apps';
        };
      };
      reports: {
        data: Array<{
          id: string;
          type: 'analyticsReports';
        }>;
      };
    };
  };
}

export interface AnalyticsReport {
  id: string;
  type: 'analyticsReports';
  attributes: {
    category: AnalyticsReportCategory;
    name: string;
    instancesCount: number;
  };
}

export interface AnalyticsReportSegment {
  id: string;
  type: 'analyticsReportSegments';
  attributes: {
    checksum: string;
    sizeInBytes: number;
    url: string;
  };
}

export interface ListAnalyticsReportsResponse {
  data: AnalyticsReport[];
}

export interface ListAnalyticsReportSegmentsResponse {
  data: AnalyticsReportSegment[];
}

// Sales and Finance Reports Types
export type SalesReportType = 'SALES';
export type SalesReportSubType = 'SUMMARY' | 'DETAILED';
export type SalesReportFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface SalesReportResponse {
  data: string; // CSV data
}

export interface FinanceReportResponse {
  data: string; // CSV data
}

export interface SalesReportFilters {
  reportDate: string;
  reportType: SalesReportType;
  reportSubType: SalesReportSubType;
  frequency: SalesReportFrequency;
  vendorNumber: string;
}

export interface FinanceReportFilters {
  reportDate: string;
  regionCode: string;
  vendorNumber: string;
}