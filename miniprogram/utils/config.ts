// src/utils/config.ts

// 1. 定義環境類別與型別
export type Environment = 'development' | 'production';

// interface EnvConfig {
//   baseUrl: string;
// }

// 2. 配置不同環境下的 Base URL
const CONFIG_MAP = {
  development: {
    baseUrl: 'http://127.0.0.1:8000',
  },
  production: {
    baseUrl: 'https://onto-agent.onrender.com',
  },
};

// 3. 自動獲取當前小程序環境 ( develop | trial | release )
const getEnvironment = (): Environment => {
  // 防護機制：確保在非小程序環境下不會 Crash
  if (typeof wx !== 'undefined' && wx.getAccountInfoSync) {
    const accountInfo = wx.getAccountInfoSync();
    const envVersion = accountInfo.miniProgram.envVersion;

    if (envVersion === 'release' || envVersion === 'trial') {
      return 'production';
    }
  }
  return 'development'; // 預設使用開發環境
};

// 4. 匯出當前環境的 Base URL
export const CURRENT_ENV: Environment = getEnvironment();
export const BASE_URL: string = CONFIG_MAP[CURRENT_ENV].baseUrl;