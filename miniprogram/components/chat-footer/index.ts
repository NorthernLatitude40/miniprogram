import { i18nBehavior } from '../../utils/i18n/i18n';

Component({
  behaviors: [i18nBehavior],

  properties: {
    loading: {
      type: Boolean,
      value: false
    },
    // 當前使用者角色（用於判斷是否展示經營看板）
    userRole: {
      type: String,
      value: 'staff'
    },
    // 經營數據看板
    stats: {
      type: Object,
      value: { profit: 0, income: 0, expense: 0, stockCount: 0 }
    }
  },

  data: {
    inputMsg: '',
    showMenu: false
  },

  methods: {
    // 展開/收起業務菜單
    toggleMenu() {
      this.setData({ showMenu: !this.data.showMenu });
    },

    // 監聽輸入框
    onInput(e: WechatMiniprogram.Input) {
      this.setData({ inputMsg: e.detail.value });
    },

    // 發送消息
    sendToAgent() {
      const text = this.data.inputMsg.trim();
      if (!text || this.data.loading) return;

      this.triggerEvent('sendMessage', { text });
      this.setData({ inputMsg: '', showMenu: false });
    },

    // 点击业务菜单项（快捷发送指令或跳转）
    onMenuItemClick(e: WechatMiniprogram.TouchEvent) {
      const { action, text } = e.currentTarget.dataset;
      console.log('--------------------------',action)
      // 如果有对应页面路由
      // if (action === 'goToMy') {
      //   wx.navigateTo({ url: '/pages/my/index' });
      //   return;
      // }
      // if (action === 'goToBusiness') {
      //   wx.navigateTo({ url: '/pages/business/index' });
      //   return;
      // }
      // 新增：跳转到月历预约页面
      if (action === 'goToBooking') {
        wx.navigateTo({ url: '/pages/booking/month/index' });
        return;
      }

      // 若点击的是发送指令（如：查库存）
      // if (text) {
      //   this.triggerEvent('sendMessage', { text });
      //   this.setData({ showMenu: false });
      // }
    }
  }
});