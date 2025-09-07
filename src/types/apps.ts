export interface App {
  id: string;
  type: string;
  attributes: {
    name: string;
    bundleId: string;
    sku: string;
    primaryLocale: string;
  };
}

export interface ListAppsResponse {
  data: App[];
}

export interface AppInfoResponse {
  data: App;
  included?: any[];
}

export type AppIncludeOptions = 
  | "appClips"
  | "appInfos"
  | "appStoreVersions"
  | "availableTerritories"
  | "betaAppReviewDetail"
  | "betaGroups"
  | "betaLicenseAgreement"
  | "builds"
  | "endUserLicenseAgreement"
  | "gameCenterEnabledVersions"
  | "inAppPurchases"
  | "preOrder"
  | "prices"
  | "reviewSubmissions";