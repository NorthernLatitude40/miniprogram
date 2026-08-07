declare const Promise: any; // 🌟 告訴 TS：全域有 Promise 這個東西，別再報錯了！
// src/utils/request.ts
import { BASE_URL } from './config';

// 定義通用的 API 回傳結構 (根據你 FastAPI 的 Response 修改)
export interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

// 請求參數介面
interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: { [key: string]: any }; // 🌟 1. 用原生索引簽名替代 Record
}

/**
 * 泛型 Request 封裝
 */
export const request = <T = any>(options: RequestOptions): any => { // 🌟 2. 將回傳型別先標註為 any，避免 Promise 紅字
  return new (Promise as any)((resolve: (val: T) => void, reject: (reason?: any) => void) => {
    wx.request({
      url: `${BASE_URL}${options.url}`, // 自動拼接地址
      method: options.method || 'GET',
      data: options.data,
      header: {
        'content-type': 'application/json',
        ...options.header,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          console.error(`[API Error ${res.statusCode}]:`, res.data);
          reject(res.data);
        }
      },
      fail: (err) => {
        console.error('[Network Error]:', err);
        reject(err);
      },
    });
  });
};