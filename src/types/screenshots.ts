export type ScreenshotDisplayType = 
  | 'APP_IPHONE_65' 
  | 'APP_IPHONE_55' 
  | 'APP_IPHONE_67'
  | 'APP_IPHONE_61'
  | 'APP_IPHONE_58'
  | 'APP_IPAD_PRO_3GEN_129'
  | 'APP_IPAD_PRO_129'
  | 'APP_IPAD_PRO_11'
  | 'APP_IPAD_10_9'
  | 'APP_IPAD_10_5'
  | 'APP_IPAD_9_7';

export interface ScreenshotSet {
  id: string;
  type: string;
  attributes: {
    screenshotDisplayType: ScreenshotDisplayType;
    deviceType: string;
  };
}

export interface ListScreenshotSetsResponse {
  data: ScreenshotSet[];
}

export const SCREENSHOT_DIMENSIONS: Record<ScreenshotDisplayType, { width: number; height: number }> = {
  'APP_IPHONE_65': { width: 1284, height: 2778 },
  'APP_IPHONE_55': { width: 1242, height: 2208 },
  'APP_IPHONE_67': { width: 1290, height: 2796 },
  'APP_IPHONE_61': { width: 1179, height: 2556 },
  'APP_IPHONE_58': { width: 1170, height: 2532 },
  'APP_IPAD_PRO_3GEN_129': { width: 2048, height: 2732 },
  'APP_IPAD_PRO_129': { width: 2048, height: 2732 },
  'APP_IPAD_PRO_11': { width: 1668, height: 2388 },
  'APP_IPAD_10_9': { width: 1640, height: 2360 },
  'APP_IPAD_10_5': { width: 1668, height: 2224 },
  'APP_IPAD_9_7': { width: 1536, height: 2048 },
};