import { i18nBehavior } from '../../utils/i18n/i18n';

Component({
  // 引入 Behavior
  behaviors: [i18nBehavior],

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuTop: 40,
    menuHeight: 32
  },

  // Component 的生命週期（對應 Page 的生命週期）
  methods: {
    onLoad(): void {
      const menuButton = wx.getMenuButtonBoundingClientRect();
      const systemInfo = wx.getSystemInfoSync();

      const statusBarHeight = systemInfo.statusBarHeight || 20;
      const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height;

      this.setData({
        statusBarHeight,
        navBarHeight,
        menuTop: menuButton.top,      // 膠囊到頂部的距離
        menuHeight: menuButton.height // 膠囊本身的高度
      });
    },

    onShow(): void {
      // 每次展示頁面時刷新語言字典
      this.updateLanguage();
    },

    goBack(): void {
      wx.navigateBack({ delta: 1 });
    },

    goToProfile(): void {
      wx.navigateTo({ url: '/pages/profile/index' });
    },

    goToShopManagement(): void {
      wx.navigateTo({ url: '/pages/shop/index' });
    },

    // 點擊觸發語言選擇器 ActionSheet
    onSelectLanguage(): void {
      const langOptions = [
        { label: (this.data as any).t?.lang_system || '跟隨系統', value: 'system' },
        { label: '繁體中文（香港）', value: 'zh_HK' },
        { label: '简体中文', value: 'zh_CN' },
        { label: 'English', value: 'en' },
        { label: '日本語', value: 'ja' }, 
      ];
    
      wx.showActionSheet({
        itemList: langOptions.map(item => item.label),
        success: (res) => {
          const selected = langOptions[res.tapIndex];
          if (selected) {
            this.setAppLanguage(selected.value);
            wx.showToast({
              title: (this.data as any).t?.switch_success || '切換成功',
              icon: 'success'
            });
          }
        }
      });
    }
  }
});