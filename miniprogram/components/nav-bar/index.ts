Component({
  properties: {
    title: { type: String, value: '' },
    showBack: { type: Boolean, value: true }
  },

  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    menuTop: 0,
    menuHeight: 32
  },

  lifetimes: {
    attached() {
      // 自動獲取系統膠囊位置，精準對齊，防止錯位
      const sysInfo = wx.getSystemInfoSync();
      const menuButton = wx.getMenuButtonBoundingClientRect();
      
      const statusBarHeight = sysInfo.statusBarHeight || 0;
      const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height;

      this.setData({
        statusBarHeight,
        navBarHeight,
        menuTop: menuButton.top,
        menuHeight: menuButton.height
      });
    }
  },

  methods: {
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.reSwitchTab ? wx.reSwitchTab({ url: '/pages/index/index' }) : wx.switchTab({ url: '/pages/index/index' });
      }
    }
  }
});