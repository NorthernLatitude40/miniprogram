// pages/my/index.ts

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuTop: 40,
    menuHeight: 32
  },

  onLoad(): void {
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const systemInfo = wx.getSystemInfoSync();

    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height;

    this.setData({
      statusBarHeight,
      navBarHeight,
      menuTop: menuButton.top,       // 胶囊到顶部的距离
      menuHeight: menuButton.height  // 胶囊本身的高度
    });
  },

  goBack(): void {
    wx.navigateBack({
      delta: 1
    });
  },

  goToProfile(): void {
    wx.navigateTo({
      url: '/pages/profile/index'
    });
  },

  goToShopManagement(): void {
    wx.navigateTo({
      url: '/pages/shop/index'
    });
  }
});