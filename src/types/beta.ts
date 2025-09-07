export interface BetaGroup {
  id: string;
  type: string;
  attributes: {
    name: string;
    isInternalGroup: boolean;
    publicLinkEnabled: boolean;
    publicLinkId?: string;
    publicLinkLimit?: number;
    createdDate: string;
  };
}

export interface BetaTester {
  id: string;
  type: string;
  attributes: {
    firstName: string;
    lastName: string;
    email: string;
    inviteType: string;
    betaGroups?: BetaGroup[];
  };
}

export interface ListBetaGroupsResponse {
  data: BetaGroup[];
}

export interface ListBetaTestersResponse {
  data: BetaTester[];
}

export interface AddTesterRequest {
  data: {
    type: "betaTesters";
    attributes: {
      email: string;
      firstName: string;
      lastName: string;
    };
    relationships: {
      betaGroups: {
        data: Array<{
          id: string;
          type: "betaGroups";
        }>;
      };
    };
  };
}

export interface RemoveTesterRequest {
  data: Array<{
    id: string;
    type: "betaTesters";
  }>;
}

// Beta Feedback Screenshot types
export interface BetaFeedbackScreenshotImage {
  url: string;
  height: number;
  width: number;
}

export interface BetaFeedbackScreenshotSubmission {
  id: string;
  type: "betaFeedbackScreenshotSubmissions";
  attributes: {
    createdDate?: string;
    comment?: string;
    email?: string;
    deviceModel?: string;
    osVersion?: string;
    locale?: string;
    timeZone?: string;
    architecture?: string;
    connectionType?: string;
    pairedAppleWatch?: string;
    appUptimeInMilliseconds?: number;
    diskBytesAvailable?: number;
    diskBytesTotal?: number;
    batteryPercentage?: number;
    screenWidthInPoints?: number;
    screenHeightInPoints?: number;
    appPlatform?: string;
    devicePlatform?: "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";
    deviceFamily?: string;
    buildBundleId?: string;
    screenshots?: BetaFeedbackScreenshotImage[];
  };
  relationships?: {
    build?: {
      data?: {
        id: string;
        type: "builds";
      };
    };
    tester?: {
      data?: {
        id: string;
        type: "betaTesters";
      };
    };
  };
}

export interface ListBetaFeedbackScreenshotSubmissionsRequest {
  appId?: string;
  bundleId?: string;
  buildId?: string;
  devicePlatform?: "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";
  appPlatform?: "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";
  deviceModel?: string;
  osVersion?: string;
  testerId?: string;
  limit?: number;
  sort?: "createdDate" | "-createdDate";
  includeBuilds?: boolean;
  includeTesters?: boolean;
}

export interface ListBetaFeedbackScreenshotSubmissionsResponse {
  data: BetaFeedbackScreenshotSubmission[];
  included?: Array<{
    id: string;
    type: string;
    attributes?: any;
  }>;
  links?: {
    self: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total: number;
      limit: number;
    };
  };
}

export interface BetaFeedbackScreenshotSubmissionResponse {
  data: BetaFeedbackScreenshotSubmission;
  included?: Array<{
    id: string;
    type: string;
    attributes?: any;
  }>;
  links?: {
    self: string;
  };
}