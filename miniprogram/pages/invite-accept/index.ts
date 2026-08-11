// pages/invite-accept/index.ts
import { request } from '../../utils/request';

// 定义接受邀请成功的 Bare Payload 返回数据结构
interface AcceptInviteResult {
  shop_id: number | string;
  staff_id?: number | string;
  role?: string;
  message?: string;
}

Page({
  data: {
    inviteToken: '',
    loading: false
  },

  onLoad(options: { token?: string }) {
    console.log('=== 接收到的完整 options ===', options);
    if (options.token) {
      this.setData({ inviteToken: decodeURIComponent(options.token) });
    } else {
      wx.showModal({
        title: '提示',
        content: '无效或过期的邀请链接',
        showCancel: false,
        success: () => {
          // 没有 token 时自动关闭或跳转首页
          this.navigateToHome();
        }
      });
    }
  },

  // 统一的首页跳转逻辑（带兜底捕获）
  navigateToHome(): void {
    // 💡 优先使用 reLaunch，清空页面栈并直接切到首页（无论首页是否为 Tab 页均有效）
    wx.reLaunch({
      url: '/pages/index/index',
      fail: (err) => {
        console.error('reLaunch 失败，尝试 switchTab 跳转:', err);
        // 防御兜底：如果首页是 TabBar 页面且 reLaunch 失败，降级为 switchTab
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
    if (!this.data.inviteToken) {
      wx.showToast({ title: '邀请凭证缺失', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      // 1. 确保先静默登录，拿到当前微信用户的身份 token / openid
      // await app.checkLogin(); 

      // 2. 提交绑定 (Bare Payload 裸响应模式)
      const res = await request<AcceptInviteResult>({
        url: '/api/v1/shop/accept-invite',
        method: 'POST',
        data: { invite_token: this.data.inviteToken }
      });

      // 💡 成功拿到 res (直接就是数据对象，状态码非 2xx 会自动走 catch)
      if (res && res.shop_id) {
        // 写入全局店铺 ID 缓存
        wx.setStorageSync('current_shop_id', res.shop_id);

        wx.showModal({
          title: '绑定成功',
          content: '你已成功加入该店铺！',
          showCancel: false,
          success: () => {
            // 💡 点击弹窗确认后，安全跳转首页
            this.navigateToHome();
          }
        });
      }
    } catch (err: any) {
      console.error('接受邀请失败:', err);

      // 💡 符合 RFC 7807 错误规范：直接提取后端的 detail 或 title
      const errorMsg = err?.detail || err?.title || '绑定失败，请稍后再试';

      wx.showModal({
        title: '提示',
        content: errorMsg, // 完美显示：例如 "邀请信息已失效或不存在"
        showCancel: false
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});