export type DevicePlatform = "IOS" | "MAC_OS";
export type DeviceStatus = "ENABLED" | "DISABLED";
export type DeviceClass = "APPLE_WATCH" | "IPAD" | "IPHONE" | "IPOD" | "APPLE_TV" | "MAC";

export interface Device {
  id: string;
  type: string;
  attributes: {
    name: string;
    platform: DevicePlatform;
    udid: string;
    deviceClass: DeviceClass;
    status: DeviceStatus;
    model?: string;
    addedDate?: string;
  };
}

export interface ListDevicesResponse {
  data: Device[];
}

export interface DeviceFilters {
  name?: string;
  platform?: DevicePlatform;
  status?: DeviceStatus;
  udid?: string;
  deviceClass?: DeviceClass;
}

export type DeviceSortOptions = 
  | "name" | "-name"
  | "platform" | "-platform"
  | "status" | "-status"
  | "udid" | "-udid"
  | "deviceClass" | "-deviceClass"
  | "model" | "-model"
  | "addedDate" | "-addedDate";

export type DeviceFieldOptions = 
  | "name"
  | "platform"
  | "udid"
  | "deviceClass"
  | "status"
  | "model"
  | "addedDate";