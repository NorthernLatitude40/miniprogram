// pages/login/login.ts
import { request } from '../../utils/request';

interface WxLoginResponse {
  code: number;
  message: string;
  data?: {
    token: string;
    user_info: {
      id: number;
      nickname: string;
      role: string;
    };
  };
  detail?: string;
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

        // 2. 发送 code 到后台
        request({
          url: '/api/v1/auth/wx-login',
          method: 'POST',
          data: { code: wxRes.code }
        }).then((res: any) => {
          wx.hideLoading();
          self.setData({ isLoading: false });

          const resData = (res.data || res) as WxLoginResponse;

          if (resData && (resData.code === 200 || (resData as any).token)) {
            // 🌟 加 : any 彻底解决 TS 报错
            const dataObj: any = resData.data || resData;

            // 3. 存储 Token 并跳转
            wx.setStorageSync('token', dataObj.token);
            wx.setStorageSync('role', dataObj.user_info?.role || 'staff');
            wx.setStorageSync('userInfo', dataObj.user_info);

            wx.showToast({
              title: '登录成功',
              icon: 'success',
              duration: 1500
            });

            setTimeout(() => {
              wx.switchTab({
                url: '/pages/index/index',
                fail() {
                  wx.redirectTo({ url: '/pages/index/index' });
                }
              });
            }, 1200);

          } else {
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
  }
});