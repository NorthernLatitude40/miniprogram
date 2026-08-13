// pages/invite-accept/index.ts
import { request } from '../../utils/request';

// 定义接受邀请成功的返回数据结构 (包含了 Token)
interface AcceptInviteResult {
  token: string;
  shop_id: number | string;
  staff_id?: number | string;
  role?: string;
  message?: string;
}

Page({
  data: {
    inviteToken: '',
    shopId: '',
    loading: false
  },

  onLoad(options: any): void {
    // 🌟 支持两种入参模式：
    // 1. 成员专属邀请：带 token 参数
    // 2. 店铺通用邀请：带 shop_id 参数
    const { token, shop_id } = options;

    if (token) {
      // 凭证存在，写入 inviteToken
      this.setData({ inviteToken: token });
    } else if (shop_id) {
      // 店铺通用邀请降级逻辑
      this.setData({ shopId: shop_id });
    } else {
      // 两者都没有，提示无效链接
      wx.showModal({
        title: '提示',
        content: '无效或过期的邀请链接',
        showCancel: false
      });
      return;
    }
  },

  // 统一的首页跳转逻辑（带兜底捕获）
  navigateToHome(): void {
    // 💡 优先使用 reLaunch，清空页面栈并直接切到首页
    wx.reLaunch({
      url: '/pages/index/index',
      fail: (err) => {
        console.error('reLaunch 失败，尝试 switchTab 跳转:', err);
        // 防御兜底：降级为 switchTab
        wx.switchTab({
          url: '/pages/index/index',
          fail: (switchErr) => {
            console.error('页面跳转完全失败，请检查 app.json 中的路径映射:', switchErr);
            wx.showToast({ title: '跳转失败，请手动返回首页', icon: 'none' });
          }
        });
      }
    });
  },

  // 点击【接受邀请，加入店铺】按钮
  async handleAccept(): Promise<void> {
    // 如果既没有 token 也没有 shopId，拦住请求
    if (!this.data.inviteToken && !this.data.shopId) {
      wx.showToast({ title: '邀请凭证缺失', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      // 🌟 1. 调用微信原生的 wx.login 获取临时登录 code
      const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      if (!loginRes.code) {
        throw new Error('获取微信登录凭证失败');
      }

      // 🌟 2. 构建请求 payload（包含 code 与邀请凭证）
      const payload: Record<string, any> = {
        code: loginRes.code
      };

      if (this.data.inviteToken) {
        payload.invite_token = this.data.inviteToken;
      } else {
        payload.shop_id = this.data.shopId;
      }

      // 🌟 3. 提交绑定并获取 Access Token
      const res = await request<AcceptInviteResult>({
        url: '/api/v1/shop/accept-invite',
        method: 'POST',
        data: payload
      });

      // 💡 4. 成功拿到返回数据
      if (res && res.shop_id) {
        // 🌟 关键：保存正式的登录凭证 Token
        if (res.token) {
          wx.setStorageSync('token', res.token);
        }

        // 写入全局店铺 ID 缓存
        wx.setStorageSync('current_shop_id', res.shop_id);

        wx.showModal({
          title: '绑定成功',
          content: '你已成功加入该店铺！',
          showCancel: false,
          success: () => {
            // 点击弹窗确认后安全跳转首页
            this.navigateToHome();
          }
        });
      }
    } catch (err: any) {
      console.error('接受邀请失败:', err);

      // 符合 RFC 7807 错误规范
      const errorMsg = err?.detail || err?.title || err?.errMsg || '绑定失败，请稍后再试';

      wx.showModal({
        title: '提示',
        content: errorMsg,
        showCancel: false
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});