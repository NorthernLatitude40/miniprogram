// src/utils/request.ts
import { BASE_URL } from './config';

// 1. RFC 7807 标准错误对象定义
export interface RFC7807Error {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  invalid_params?: Array<{ loc: string[]; msg: string; type: string }>;
}

// 2. 局部定义 wx.request 参数中 header 的类型
export type RequestHeader = { [key: string]: any };

// 3. 规范请求参数接口
export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: RequestHeader;
}

/**
 * 泛型 HTTP Request 封装 (基于 Bare Payload & RFC 7807 规范)
 */
export const request = <T = any>(options: RequestOptions): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    // 🌟 1. 自动读取本地存储中的 Token 与当前店铺 ID
    const token = wx.getStorageSync('token');
    const currentShopId = wx.getStorageSync('current_shop_id');

    // 🌟 2. 构建基础 Header
    const authHeader: RequestHeader = {
      'content-type': 'application/json'
    };

    if (token) {
      authHeader['Authorization'] = `Bearer ${token}`;
    }

    if (currentShopId) {
      authHeader['X-Shop-Id'] = currentShopId;
    }

    // 🌟 3. 发送微信网络请求
    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        ...authHeader,
        ...options.header,
      },
      success: (res) => {
        // A. 2xx 成功响应：遵守 Bare Payload 规范，res.data 即为最终实体数据
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
          return;
        }

        // B. 解析后端符合 RFC 7807 规范的错误体
        const resBody = (res.data || {}) as Record<string, any>;
        const rfcError: RFC7807Error = {
          status: res.statusCode,
          type: resBody.type || 'about:blank',
          title: resBody.title || 'HTTP_ERROR',
          detail: resBody.detail || '系统响应异常',
          instance: resBody.instance || options.url,
          invalid_params: resBody.invalid_params,
        };

        // C. 401 身份过期拦截处理
        if (res.statusCode === 401) {
          console.warn('[401 Unauthorized] Token 已失效，自动清理并跳转登录页');
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('current_shop_id');

          wx.showToast({
            title: rfcError.detail || '登录状态已失效，请重新登录',
            icon: 'none',
            duration: 2000
          });

          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login'
            });
          }, 1000);

          reject(rfcError);
          return;
        }

        // D. 其他 4xx / 5xx 错误（如 403, 422, 500 等）
        console.error(`[API Error ${res.statusCode}]:`, rfcError);
        reject(rfcError);
      },
      fail: (err) => {
        // 网络层/断网错误处理
        console.error('[Network Error]:', err);
        const networkError: RFC7807Error = {
          status: 500,
          title: 'NETWORK_ERROR',
          detail: err.errMsg || '网络连接失败，请检查网络设置',
          instance: options.url,
        };

        wx.showToast({
          title: '网络连接失败',
          icon: 'none'
        });

        reject(networkError);
      },
    });
  });
};