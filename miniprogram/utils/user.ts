import { request } from './request';

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