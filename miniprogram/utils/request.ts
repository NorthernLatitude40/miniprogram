// src/utils/request.ts
import { BASE_URL } from './config';

declare const Promise: any; // 🌟 告訴 TS：全域有 Promise 這個東西，別再報錯了！

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
  header?: { [key: string]: any }; // 🌟 用原生索引簽名替代 Record
}

/**
 * 泛型 Request 封裝
 */
export const request = <T = any>(options: RequestOptions): any => {
  return new (Promise as any)((resolve: (val: T) => void, reject: (reason?: any) => void) => {
    
    // 🌟 1. 自動從本地快取讀取 Token
    const token = wx.getStorageSync('token');

    // 🌟 2. 構建 Header，確保預設帶上 Authorization: Bearer <token>
    const authHeader: { [key: string]: any } = {
      'content-type': 'application/json'
    };

    if (token) {
      // 注意：Bearer 和 Token 之間必须有一个空格！
      authHeader['Authorization'] = `Bearer ${token}`;
    }

    wx.request({
      url: `${BASE_URL}${options.url}`, // 自動拼接地址
      method: options.method || 'GET',
      data: options.data,
      // 🌟 3. 將內建 Token Header 與傳入的自訂 Header 合併
      header: {
        ...authHeader,
        ...options.header,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else if (res.statusCode === 401) {
          // 💡 4. 如果遇到 401，說明 Token 無效或已過期，自動清除並導向登入頁
          console.warn('[401 Unauthorized] Token 已失效，自動跳轉至登入頁');
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          
          wx.showToast({
            title: '登入已過期，請重新登入',
            icon: 'none',
            duration: 2000
          });

          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login'
            });
          }, 1000);

          reject(res.data);
        } else {
          console.error(`[API Error ${res.statusCode}]:`, res.data);
          reject(res.data);
        }
      },
      fail: (err) => {
        console.error('[Network Error]:', err);
        wx.showToast({
          title: '網路連接失敗',
          icon: 'none'
        });
        reject(err);
      },
    });
  });
};