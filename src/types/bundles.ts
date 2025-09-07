export type BundlePlatform = "IOS" | "MAC_OS" | "UNIVERSAL";

export interface BundleId {
  id: string;
  type: string;
  attributes: {
    identifier: string;
    name: string;
    platform: BundlePlatform;
    seedId?: string;
  };
}

export interface CreateBundleIdRequest {
  data: {
    type: "bundleIds";
    attributes: {
      identifier: string;
      name: string;
      platform: BundlePlatform;
      seedId?: string;
    };
  };
}

export interface ListBundleIdsResponse {
  data: BundleId[];
}

export interface BundleIdResponse {
  data: BundleId;
}

export type CapabilityType = 
  | "ICLOUD"
  | "IN_APP_PURCHASE"
  | "GAME_CENTER"
  | "PUSH_NOTIFICATIONS"
  | "WALLET"
  | "INTER_APP_AUDIO"
  | "MAPS"
  | "ASSOCIATED_DOMAINS"
  | "PERSONAL_VPN"
  | "APP_GROUPS"
  | "HEALTHKIT"
  | "HOMEKIT"
  | "WIRELESS_ACCESSORY_CONFIGURATION"
  | "APPLE_PAY"
  | "DATA_PROTECTION"
  | "SIRIKIT"
  | "NETWORK_EXTENSIONS"
  | "MULTIPATH"
  | "HOT_SPOT"
  | "NFC_TAG_READING"
  | "CLASSKIT"
  | "AUTOFILL_CREDENTIAL_PROVIDER"
  | "ACCESS_WIFI_INFORMATION"
  | "NETWORK_CUSTOM_PROTOCOL"
  | "COREMEDIA_HLS_LOW_LATENCY"
  | "SYSTEM_EXTENSION_INSTALL"
  | "USER_MANAGEMENT"
  | "APPLE_ID_AUTH";

export interface CapabilitySetting {
  key: string;
  options: Array<{
    key: string;
    enabled: boolean;
  }>;
}

export interface EnableCapabilityRequest {
  data: {
    type: "bundleIdCapabilities";
    attributes: {
      capabilityType: CapabilityType;
      settings?: CapabilitySetting[];
    };
    relationships: {
      bundleId: {
        data: {
          id: string;
          type: "bundleIds";
        };
      };
    };
  };
}