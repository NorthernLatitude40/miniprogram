// pages/profile/index.ts
import { request } from '../../utils/request'; 

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuTop: 40,
    menuHeight: 32,
    userInfo: {
      nickname: '--',
      roleName: '--',
      phone: '--',
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

    this.fetchUserInfo();
  },

  /**
   * 获取个人信息
   */
  fetchUserInfo(): void {
    request({
      url: '/api/v1/auth/me',
      method: 'GET'
    }).then((res: any) => {
      const d = res?.data || res;
      if (d) {
        this.setData({
          userInfo: {
            nickname: d.nickname || '微信用户',
            roleName: d.role_name || d.roleName || d.role || '店员',
            phone: d.phone || d.mobile || '--',
            shopName: d.shop_name || d.shopName || '默认店铺',
            avatar: d.avatar_url || d.avatar || ''
          }
        });
      }
    }).catch((err: any) => {
      console.error('获取用户信息失败:', err);
      if (err?.status === 401) {
        wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
      } else {
        wx.showToast({ title: '获取个人信息失败', icon: 'none' });
      }
    });
  },

  /**
   * 提交更新用户信息请求
   */
  updateProfileApi(data: { nickname?: string; phone?: string; avatar_url?: string }) {
    wx.showLoading({ title: '保存中...', mask: true });

    request({
      url: '/api/v1/auth/me',
      method: 'PUT',
      data
    }).then((res: any) => {
      wx.hideLoading();
      wx.showToast({ title: '修改成功', icon: 'success' });
      
      // 重新刷新页面数据
      this.fetchUserInfo();
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