// src/utils/request.ts
import { BASE_URL } from './config';

// 1. RFC 7807 标准错误对象定义（扩展 isSilent 标记）
export interface RFC7807Error {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  invalid_params?: Array<{ loc: string[]; msg: string; type: string }>;
  isSilent?: boolean; // 是否静默处理（如主动 abort 的请求无需弹出 Toast）
}

// 2. 局部定义 wx.request 参数中 header 的类型
export type RequestHeader = { [key: string]: any };

// 3. 规范请求参数接口
export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: RequestHeader;
  showLoading?: boolean;
  loadingText?: string;
  getTask?: (task: any) => void; // 回调导出 RequestTask，方便外部手动执行 task.abort()
}

/**
 * 格式化 RFC 7807 或 Pydantic 错误信息
 */
export const formatErrorMessage = (error: RFC7807Error | any): string => {
  if (!error) return '操作失败，请重试';

  // 1. 优先使用 RFC 7807 的 detail
  if (typeof error.detail === 'string' && error.detail) {
    return error.detail;
  }

  // 2. 针对 Pydantic/FastAPI 的 422 invalid_params 校验错误进行解析
  if (Array.isArray(error.invalid_params) && error.invalid_params.length > 0) {
    const firstErr = error.invalid_params[0];
    const field = firstErr.loc ? firstErr.loc[firstErr.loc.length - 1] : '';
    return `${field ? field + ': ' : ''}${firstErr.msg || '参数格式不正确'}`;
  }

  // 3. 通用 message 兜底
  if (error.message) return error.message;
  if (error.title && error.title !== 'HTTP_ERROR') return error.title;

  return '请求异常，请稍后再试';
};

/**
 * 格式化 URL 拼接（防止 BASE_URL 与 url 间出现多余的斜杠 //）
 */
const buildUrl = (baseUrl: string, url: string): string => {
  const formattedBase = baseUrl.replace(/\/+$/, '');
  const formattedUrl = url.startsWith('/') ? url : `/${url}`;
  return `${formattedBase}${formattedUrl}`;
};

/**
 * 统一清除身份缓存并重定向至登录页
 */
const clearSessionAndRedirect = (message: string) => {
  console.warn('[Auth Interceptor] 清理本地凭证并重定向至登录页:', message);
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  wx.removeStorageSync('current_shop_id');
  wx.removeStorageSync('current_staff_id');
  wx.removeStorageSync('role');

  wx.showToast({
    title: message,
    icon: 'none',
    duration: 2000
  });

  setTimeout(() => {
    wx.redirectTo({
      url: '/pages/login/login',
      fail: () => {
        wx.reLaunch({ url: '/pages/login/login' });
      }
    });
  }, 1200);
};

/**
 * 泛型 HTTP Request 封装 (基于 Bare Payload & RFC 7807 规范)
 */
export const request = <T = any>(options: RequestOptions): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    // 🌟 1. 处理 Loading 逻辑
    const needLoading = options.showLoading ?? false;
    if (needLoading) {
      wx.showLoading({
        title: options.loadingText || '加载中...',
        mask: true
      });
    }

    const hideLoadingIfNeed = () => {
      if (needLoading) {
        wx.hideLoading();
      }
    };

    // 🌟 2. 自动读取本地存储中的 Token 与当前店铺/员工 ID
    const token = wx.getStorageSync('token');
    const currentShopId = wx.getStorageSync('current_shop_id');
    const currentStaffId = wx.getStorageSync('current_staff_id');

    // 🌟 3. 构建基础 Header
    const authHeader: RequestHeader = {
      'content-type': 'application/json'
    };

    if (token) {
      authHeader['Authorization'] = `Bearer ${token}`;
    }

    if (currentShopId) {
      authHeader['X-Shop-Id'] = currentShopId;
    }

    if (currentStaffId) {
      authHeader['X-Staff-Id'] = currentStaffId;
    }

    // 🌟 4. 发送微信网络请求
    const requestTask = wx.request({
      url: buildUrl(BASE_URL, options.url),
      method: options.method || 'GET',
      data: options.data,
      header: {
        ...authHeader,
        ...options.header,
      },
      success: (res) => {
        hideLoadingIfNeed();

        // A. 2xx (200~299) 成功响应：遵循 Bare Payload 规范
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
          isSilent: false
        };

        // C. 401 身份过期拦截处理
        if (res.statusCode === 401) {
          clearSessionAndRedirect(rfcError.detail || '登录状态已失效，请重新登录');
          reject(rfcError);
          return;
        }

        // 🌟 D. 403 权限不足 / 员工账号禁用拦截处理
        if (res.statusCode === 403) {
          clearSessionAndRedirect(rfcError.detail || '非店铺员工或权限不足，请重新登录');
          reject(rfcError);
          return;
        }

        // E. 其他 4xx / 5xx 错误
        console.error(`[API Error ${res.statusCode}]:`, rfcError);
        reject(rfcError);
      },
      fail: (err) => {
        hideLoadingIfNeed();

        console.error('[Network Error]:', err);
        const errMsg = err.errMsg || '';

        // 1. 主动中断请求 (abort)
        if (errMsg.includes('abort')) {
          const abortError: RFC7807Error = {
            status: 0,
            title: 'REQUEST_ABORTED',
            detail: '请求已取消',
            instance: options.url,
            isSilent: true // 静默标记
          };
          reject(abortError);
          return;
        }

        // 2. 请求超时 (timeout)
        if (errMsg.includes('timeout')) {
          const timeoutError: RFC7807Error = {
            status: 408,
            title: 'REQUEST_TIMEOUT',
            detail: '网络响应较慢，请稍后重试',
            instance: options.url,
            isSilent: false
          };

          wx.showToast({
            title: timeoutError.detail!,
            icon: 'none'
          });

          reject(timeoutError);
          return;
        }

        // 3. 断网或网络不可用
        const networkError: RFC7807Error = {
          status: 500,
          title: 'NETWORK_ERROR',
          detail: '网络连接失败，请检查网络设置',
          instance: options.url,
          isSilent: false
        };

        wx.showToast({
          title: networkError.detail!,
          icon: 'none'
        });

        reject(networkError);
      },
    });

    // 🌟 5. 导出 RequestTask（支持外部手动中断请求）
    if (typeof options.getTask === 'function') {
      options.getTask(requestTask);
    }
  });
};