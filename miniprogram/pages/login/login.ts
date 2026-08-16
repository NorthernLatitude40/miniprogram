import { request } from '../../utils/request';
import { fetchUserInfo } from '../../utils/user';

interface WxLoginResponse {
  code: number;
  message: string;
  data?: {
    token: string;
    user_info: {
      id: number;
      nickname: string;
      role: string;
      shop_id?: number;
    };
  };
  detail?: string;
}

interface ShopItem {
  id: number;
  name: string;
  role: string;
  staff_id: number;
  is_default?: boolean;
}

Page({
  data: {
    isLoading: false
  },

  handleWxLogin() {
    if (this.data.isLoading) return;

    const self = this;
    self.setData({ isLoading: true });
    wx.showLoading({ title: '安全登录中...', mask: true });

    // 1. 调用微信官方登录接口
    wx.login({
      success(wxRes) {
        if (!wxRes.code) {
          wx.hideLoading();
          self.setData({ isLoading: false });
          wx.showModal({
            title: '登录失败',
            content: '未获取到微信授权码 code',
            showCancel: false
          });
          return;
        }

        // 2. 发送 code 到后台进行登录验证
        request({
          url: '/api/v1/auth/wx-login',
          method: 'POST',
          data: { code: wxRes.code }
        }).then((res: any) => {
          const resData = (res.data || res) as WxLoginResponse;

          if (resData && (resData.code === 200 || (resData as any).token)) {
            const dataObj: any = resData.data || resData;

            // 存储 Token 凭证
            wx.setStorageSync('token', dataObj.token);
            debugger
            // 3. 登录成功后，获取用户关联的所有店铺列表，判断进入哪个店铺
            self.loadShopListAndNavigate(dataObj.user_info);

          } else {
            wx.hideLoading();
            self.setData({ isLoading: false });
            wx.showModal({
              title: '登录失败',
              content: resData.detail || resData.message || '登录异常',
              showCancel: false
            });
          }
        }).catch((err: any) => {
          wx.hideLoading();
          self.setData({ isLoading: false });
          wx.showModal({
            title: '网络连接失败',
            content: err?.detail || err?.errMsg || '无法连接到服务器',
            showCancel: false
          });
        });
      },
      fail(err) {
        wx.hideLoading();
        self.setData({ isLoading: false });
        wx.showModal({
          title: '微信调用失败',
          content: err.errMsg,
          showCancel: false
        });
      }
    });
  },

  /**
   * 获取店铺列表并按策略自动选择默认店铺跳转
   */
  loadShopListAndNavigate(userInfoFromLogin?: any) {
    wx.showLoading({ title: '正在匹配店铺信息...', mask: true });

    request<ShopItem[]>({
      url: '/api/v1/shops/my-shops',
      method: 'GET'
    }).then((shops) => {
      wx.hideLoading();
      this.setData({ isLoading: false });

      if (!Array.isArray(shops) || shops.length === 0) {
        wx.showModal({
          title: '提示',
          content: '当前账号未关联任何店铺，请联系管理员添加',
          showCancel: false
        });
        return;
      }

      // 🌟 重新厘清匹配优先级：
      // 1. 上次手动切店缓存的 current_staff_id / current_shop_id
      // 2. 后端数据库显式标记的 default 店铺 (is_default: true)
      // 3. 登录接口传回的 shop_id 匹配项
      // 4. 兜底列表第 0 项
      const savedStaffId = wx.getStorageSync('current_staff_id');
      const savedShopId = wx.getStorageSync('current_shop_id');

      const targetShop = 
        shops.find(s => savedStaffId && String(s.staff_id) === String(savedStaffId)) ||
        shops.find(s => savedShopId && String(s.id) === String(savedShopId)) ||
        shops.find(s => s.is_default) || 
        shops.find(s => userInfoFromLogin?.shop_id && String(s.id) === String(userInfoFromLogin.shop_id)) || 
        shops[0];

      // 🌟 写入全局缓存（修复 Bug：正确存入数字 staff_id，非字符串 role）
      wx.setStorageSync('current_shop_id', targetShop.id);
      wx.setStorageSync('current_staff_id', targetShop.staff_id);
      wx.setStorageSync('role', targetShop.role || userInfoFromLogin?.role || 'staff');

      const app = getApp();
      if (app && app.globalData) {
        app.globalData.currentShopId = targetShop.id;
        app.globalData.currentStaffId = targetShop.staff_id;
        app.globalData.role = targetShop.role;
      }

      // 同步获取完整用户信息
      fetchUserInfo().catch((err) => {
        console.error('获取用户信息失败:', err);
      });

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1200
      });

      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index',
          fail() {
            wx.redirectTo({ url: '/pages/index/index' });
          }
        });
      }, 1000);

    }).catch((err: any) => {
      wx.hideLoading();
      this.setData({ isLoading: false });
      console.error('获取店铺列表失败:', err);
      wx.showToast({ title: '获取店铺列表失败', icon: 'none' });
    });
  }
});