import { request } from './request';

// ==================== 接口定义 ====================
export interface TrendItem {
  date: string;
  income: number;
  expense: number;
  profit: number;
}

export interface UserInfo {
  id?: number;
  nickname: string;
  role: string;
  roleName: string;
  phone: string;
  shop_id?: number;
  shopName: string;
  avatar: string;
  avatar_url?: string;
  [key: string]: any;
}

export interface DashboardOverviewData {
  profit: number;
  income: number;
  expense: number;
  order_count: number;
  in_stock_devices: number; // 修正：移除 TypeScript 不支援的 int，僅保留 number
  today_profit?: number;
  today_income?: number;
  today_expense?: number;
  [key: string]: any;
}

export interface DashboardStatsResult {
  profit: number;
  income: number;
  expense: number;
  orderCount: number;
  stockCount: number;
  trend: TrendItem[];
}

export interface PartnerSearchResult {
  id?: number | null;
  name?: string;
  phone?: string;
  [key: string]: any;
}

// ==================== API 请求函数 ====================

/**
 * 统一获取并更新个人信息
 */
export function fetchUserInfo(): Promise<UserInfo> {
  const currentShopId = wx.getStorageSync('current_shop_id') || '';
  const role = wx.getStorageSync('role') || '';

  return request({
    url: '/api/v1/auth/me',
    method: 'GET',
    header: {
      'X-Shop-Id': String(currentShopId),
      'X-User-Role': role,
    },
  }).then((res: any) => {
    const d = res?.data || res || {};

    // 保持后端原始字段 (id, shop_id, role) 并补充前端 UI 常用字段
    const userInfo: UserInfo = {
      ...d,
      id: d.id,
      nickname: d.nickname || '微信用户',
      role: d.role || role || 'staff',
      roleName: d.role_name || d.roleName || d.role || '店员',
      phone: d.phone || d.mobile || '--',
      shop_id: d.shop_id || Number(currentShopId) || null,
      shopName: d.shop_name || d.shopName || '默认店铺',
      avatar: d.avatar_url || d.avatar || ''
    };

    // 1. 同步更新本地存储
    wx.setStorageSync('userInfo', userInfo);

    // 2. 缓存到 App 全局对象
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.userInfo = userInfo;
    }

    return userInfo;
  }).catch((err: any) => {
    console.error('获取用户信息失败:', err);
    throw err;
  });
}

/**
 * 获取首页概览与报表数据
 * @param range 时间维度: 'today' | '7days' | 'month'，默认 'today'
 */
export function fetchDashboardStats(range: string = 'today'): Promise<DashboardStatsResult> {
  const currentShopId = wx.getStorageSync('current_shop_id') || '';

  return request<DashboardOverviewData>({
    url: '/api/v1/dashboard/overview',
    method: 'GET',
    data: { range },
    header: {
      'X-Shop-Id': String(currentShopId),
    }
  })
    .then((data: any) => {
      const d = data?.data || data || {};

      // 优先使用后端扩展的通用字段 (profit, income, expense, order_count)，降级兼容旧版的 today_* 字段
      const stats: DashboardStatsResult = {
        profit: d.profit ?? d.today_profit ?? 0,
        income: d.income ?? d.today_income ?? 0,
        expense: d.expense ?? d.today_expense ?? 0,
        orderCount: d.order_count ?? 0,
        stockCount: d.in_stock_devices ?? 0,
        trend: Array.isArray(d.trend) ? d.trend : [],
      };

      return stats;
    })
    .catch((err: any) => {
      console.error('获取看板数据失败:', err);
      if (err?.status === 403) {
        wx.showToast({
          title: err.detail || '无权查看财务概览',
          icon: 'none'
        });
      } else if (err?.detail) {
        wx.showToast({ title: err.detail, icon: 'none' });
      } else {
        wx.showToast({ title: '获取概览数据失败', icon: 'none' });
      }
      throw err;
    });
}

/**
 * 查询客户/供应商信息
 * @param phone 手机号
 */
export function searchPartner(phone: string): Promise<PartnerSearchResult | null> {
  wx.showLoading({ title: '查詢客戶中...', mask: false });
  
  return request({
    url: `/api/v1/partners/search`,
    method: 'GET',
    data: { phone }
  }).then((res: any) => {
    wx.hideLoading();
    const data = res?.data || res;
    if (data && data.name) {
      wx.showToast({ title: '已帶出歷史記錄', icon: 'success' });
      return data as PartnerSearchResult;
    }
    return null;
  }).catch((err: any) => {
    wx.hideLoading();
    console.error('查詢客戶資訊失敗:', err);
    throw err;
  });
}


/**
 * 將 ISO/UTC 時間字串轉換為本地時區格式 (YYYY-MM-DD HH:mm)
 * @param timeStr ISO 格式的時間字串
 * @param fallback 為空或解析失敗時的預設回傳值，預設為 '-'
 */
export function formatToLocalTime(
  isoString: string | null | undefined,
  fallback: string = '-'
): string {
  if (!isoString) return fallback;

  let formattedString = isoString;

  // 1. 處理帶空白的情況，將空白換成 'T' (如 "2026-08-20 13:46:00" -> "2026-08-20T13:46:00")
  formattedString = formattedString.replace(' ', 'T');

  // 2. 關鍵：如果字串結尾沒有 Z 也沒有 +00:00 等時區標記，強制補上 Z
  if (!formattedString.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(formattedString)) {
    formattedString += 'Z';
  }

  const date = new Date(formattedString);
  
  if (isNaN(date.getTime())) return fallback;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}