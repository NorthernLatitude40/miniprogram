App<IAppOption>({
  globalData: {},
  onLaunch() {
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);

    // 直接在 onLaunch 内调用
    wx.login({
      timeout: 3000,
      success: (res) => {
        if (res.code) {
          console.log('[wx.login success] code:', res.code);
        }
      },
      fail: (err) => {
        console.warn('[wx.login fail]:', err);
      }
    });
  }
});