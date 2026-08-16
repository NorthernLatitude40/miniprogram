import { request } from '../../utils/request'; 
import { fetchUserInfo } from '../../utils/user';

interface ShopItem {
  id: number;
  name: string;
  role: string;
  staff_id: number;
  is_default?: boolean;
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuTop: 40,
    menuHeight: 32,
    userInfo: {
      id: null,
      nickname: '--',
      role: 'staff',
      roleName: '--',
      phone: '--',
      shop_id: null,
      shopName: '--',
      avatar: ''
    }
  },

  onLoad(): void {
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const systemInfo = wx.getSystemInfoSync();

    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height;

    this.setData({
      statusBarHeight,
      navBarHeight,
      menuTop: menuButton.top,
      menuHeight: menuButton.height
    });
  },

  // 🌟 使用 onShow 确保从其他页面返回时能刷新最新数据
  onShow(): void {
    this.loadUserInfo();
  },

  /**
   * 加载最新用户信息
   */
  loadUserInfo(): void {
    fetchUserInfo().then((userInfo) => {
      this.setData({ userInfo });
    }).catch((err: any) => {
      console.error('获取用户信息失败:', err);
      if (err?.status === 401) {
        wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
      } else {
        wx.showToast({ title: '获取个人信息失败', icon: 'none' });
      }
    });
  },

  // 1. 设置默认店铺/身份 API 逻辑 (单独解耦，不再触发 /me 刷新)
  setDefaultShopApi(selectedShop: ShopItem): void {
    wx.showLoading({ title: '设置中...', mask: true });

    request({
      url: '/api/v1/user/default-identity',
      method: 'PUT',
      data: {
        default_shop_id: selectedShop.id,
        default_staff_id: selectedShop.staff_id
      }
    }).then(() => {
      wx.hideLoading();
      // 成功提示，不触发个人资料页的数据重绘与更新
      wx.showToast({ title: '默认店铺设置成功', icon: 'success' });
    }).catch((err) => {
      wx.hideLoading();
      console.error('设置默认店铺失败:', err);
      wx.showToast({ 
        title: err?.data?.detail || '设置默认店铺失败', 
        icon: 'none' 
      });
    });
  },

  // 2. 选择默认店铺列表逻辑
  handleSelectDefaultShop(): void {
    wx.showLoading({ title: '加载店铺列表中...', mask: true });

    // 获取当前用户绑定的所有店铺（包含同一店铺的不同身份）
    request<ShopItem[]>({
      url: '/api/v1/shops/my-shops',
      method: 'GET'
    }).then((shops) => {
      wx.hideLoading();

      if (!Array.isArray(shops) || shops.length === 0) {
        wx.showToast({ title: '暂无关联店铺', icon: 'none' });
        return;
      }

      // 全量保留所有数据，拼接格式：店铺名 (角色) (当前默认)
      const itemList = shops.map(s => {
        const roleText = s.role ? ` (${s.role})` : '';
        const defaultText = s.is_default ? ' (当前默认)' : '';
        return `${s.name}${roleText}${defaultText}`;
      });

      wx.showActionSheet({
        itemList: itemList,
        success: (res) => {
          const selectedShop = shops[res.tapIndex];
          if (!selectedShop) return;

          // 若点击的就是当前后端已记为默认的身份，无需重复发起更新
          if (selectedShop.is_default) {
            wx.showToast({ title: '该身份已经是默认设置', icon: 'none' });
            return;
          }

          // 调用解耦后的新 API 设置为默认店铺与身份
          this.setDefaultShopApi(selectedShop);
        }
      });
    }).catch((err) => {
      wx.hideLoading();
      console.error('获取店铺列表失败:', err);
      wx.showToast({ title: '获取店铺列表失败', icon: 'none' });
    });
  },  

  /**
   * 提交更新用户信息请求（修改昵称、手机号等）
   */
  updateProfileApi(data: { nickname?: string; phone?: string; avatar_url?: string }) {
    wx.showLoading({ title: '保存中...', mask: true });

    const currentShopId = wx.getStorageSync('current_shop_id') || wx.getStorageSync('shop_id') || '';
    const role = wx.getStorageSync('role') || 'staff';

    request({
      url: '/api/v1/auth/me',
      method: 'PUT',
      header: {
        'X-Shop-Id': String(currentShopId),
        'X-User-Role': role,
      },
      data
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '修改成功', icon: 'success' });
      
      // 重新刷新页面数据
      this.loadUserInfo();
    }).catch((err: any) => {
      wx.hideLoading();
      console.error('更新用户信息失败:', err);
      wx.showToast({ 
        title: err?.data?.detail || '修改失败', 
        icon: 'none' 
      });
    });
  },

  /**
   * 点击修改昵称触发
   */
  handleEditNickname(): void {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      content: this.data.userInfo.nickname !== '--' ? this.data.userInfo.nickname : '',
      success: (res) => {
        if (res.confirm && res.content) {
          const newNickname = res.content.trim();
          if (!newNickname) {
            wx.showToast({ title: '昵称不能为空', icon: 'none' });
            return;
          }
          this.updateProfileApi({ nickname: newNickname });
        }
      }
    });
  },

  /**
   * 点击修改手机号触发
   */
  handleEditPhone(): void {
    wx.showModal({
      title: '修改手机号',
      editable: true,
      placeholderText: '请输入新的手机号',
      content: this.data.userInfo.phone !== '--' ? this.data.userInfo.phone : '',
      success: (res) => {
        if (res.confirm && res.content) {
          const newPhone = res.content.trim();
          if (!/^1[3-9]\d{9}$/.test(newPhone)) {
            wx.showToast({ title: '手机号格式不正确', icon: 'none' });
            return;
          }
          this.updateProfileApi({ phone: newPhone });
        }
      }
    });
  },

  goBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  handleLogout(): void {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      confirmColor: '#e53935',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('current_shop_id');
          wx.removeStorageSync('current_staff_id');
          wx.removeStorageSync('role');
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/login/login'
            });
          }, 1200);
        }
      }
    });
  }
});