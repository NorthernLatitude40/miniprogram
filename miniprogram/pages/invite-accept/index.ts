// pages/invite-accept/index.ts
import { request } from '../../utils/request';

Page({
  data: {
    inviteToken: '',
    loading: false
  },

  onLoad(options: { token?: string }) {
    console.log('=== 接收到的完整 options ===', options);
    if (options.token) {
      this.setData({ inviteToken: options.token });
    } else {
      wx.showToast({ title: '无效的邀请链接', icon: 'error' });
    }
  },

  // 点击【接受邀请，加入店铺】按钮
  async handleAccept() {
    if (!this.data.inviteToken) return;

    this.setData({ loading: true });

    try {
      // 1. 确保先静默登录，拿到当前微信用户的身份 token / openid
      // await app.checkLogin(); 

      // 2. 提交绑定
      const res: any = await request({
        url: '/api/v1/shop/accept-invite',
        method: 'POST',
        data: { invite_token: this.data.inviteToken }
      });

      if (res.code === 200) {
        // 写入全局店铺 ID 缓存
        wx.setStorageSync('current_shop_id', res.data.shop_id);

        wx.showModal({
          title: '绑定成功',
          content: '你已成功加入该店铺！',
          showCancel: false,
          success: () => {
            // 跳转到小程序主页
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.setData({ loading: false });
    }
  }
});