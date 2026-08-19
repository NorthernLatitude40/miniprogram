import { i18nBehavior } from '../../../utils/i18n/i18n';
import { request } from '../../../utils/request';

Page({
  behaviors: [i18nBehavior],

  data: {
    activeTab: 'all',      // 'all' | 'new' | 'used'
    ageSortOrder: 'desc', // 'desc' (庫齡長->短) | 'asc' (庫齡短->長)
    searchKeyword: '',
    
    totalCount: 0,
    newCount: 0,
    usedCount: 0,
    
    inventoryList: [] as Array<any>,
    loading: false,
    page: 1,
    pageSize: 20,
    hasMore: true
  },

  onLoad(options: any) {
    // 依據入口傳入的 type 自動設定預設 Tab
    if (options.type === 'new') {
      this.setData({ activeTab: 'new' });
    } else if (options.type === 'used') {
      this.setData({ activeTab: 'used' });
    }
  },

  onShow() {
    this.refreshData();
  },

  // 映射 Tab 對應的 category 參數 (1: 新機, 2: 二手機)
  getCategoryByTab(tab: string): number | null {
    if (tab === 'new') return 1;
    if (tab === 'used') return 2;
    return null;
  },

  // 重置分頁並刷新數據
  refreshData() {
    this.setData({ page: 1, inventoryList: [], hasMore: true }, () => {
      this.loadData();
    });
  },

  // 切換 Tab 或切換庫齡正/倒序
  onTabChange(e: any) {
    const targetTab = e.currentTarget.dataset.tab;

    if (targetTab === this.data.activeTab) {
      // 1. 點擊已選中的 Tab -> 切換 庫齡降序 (↓) <-> 庫齡升序 (↑)
      const nextSort = this.data.ageSortOrder === 'desc' ? 'asc' : 'desc';
      this.setData({ ageSortOrder: nextSort }, () => {
        this.refreshData(); // 重新向後端請求排序數據
      });
    } else {
      // 2. 切換到新 Tab -> 變更分類，預設庫齡降序 (desc)
      this.setData({
        activeTab: targetTab,
        ageSortOrder: 'desc'
      }, () => {
        this.refreshData(); // 重新過濾並請求數據
      });
    }
  },

  onSearchInput(e: any) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch() {
    this.refreshData();
  },

  scanToSearch() {
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['barCode', 'qrCode'],
      success: (res) => {
        const code = res.result.trim();
        this.setData({ searchKeyword: code }, () => this.refreshData());
      }
    });
  },

  // 核心數據加載方法
  async loadData() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });

    const category = this.getCategoryByTab(this.data.activeTab);
    const cleanKeyword = this.data.searchKeyword ? this.data.searchKeyword.trim() : '';

    try {
      // 構建請求參數
      const queryParams: Record<string, any> = {
        page: this.data.page,
        page_size: this.data.pageSize,
        sort_by: 'stock_age',                // 按庫齡排序
        sort_order: this.data.ageSortOrder,  // 'desc' 或 'asc'
        stock_status: 2, // 在庫
        ...(category !== null ? { category } : {})
      };

      if (cleanKeyword) {
        queryParams.keyword = cleanKeyword;
      }

      const res: any = await request({
        url: '/api/v1/inventories/list',
        method: 'GET',
        data: queryParams
      });

      // 適應 Bare Payload 規範 ({ items: [...], total: N }) 或通用響應 ({ data: { items: [...] } })
      const rawList = res.items || (res.data && res.data.items) || (res.data && res.data.list) || [];
      const totalNum = res.total ?? (res.data && res.data.total) ?? rawList.length;

      // 轉換數據結構以完全對應 WXML 渲染需求
      const fetchedList = rawList.map((item: any) => {
        const ageDays = item.stock_age !== undefined 
          ? item.stock_age 
          : (item.in_stock_time ? this.calculateAgeDays(item.in_stock_time) : 0);

        return {
          id: item.id,
          sn_code: item.sn_code || item.imei || '無串號',
          imei: item.sn_code || item.imei || '無串號',
          modelName: item.title || item.modelName || '未知機型',
          type: (item.category === 1 || item.type === 'new') ? 'new' : 'used',
          costPrice: item.purchase_price || item.costPrice || '0.00',
          stock_age: ageDays,
          inboundDate: item.in_stock_time 
            ? item.in_stock_time.split(' ')[0] 
            : (item.created_at ? item.created_at.split('T')[0] : '-')
        };
      });

      const newList = this.data.page === 1 ? fetchedList : [...this.data.inventoryList, ...fetchedList];

      // 計算統計數字（若後端沒有直接傳統計數據，則按列表計算）
      const newCount = newList.filter(item => item.type === 'new').length;
      const usedCount = newList.filter(item => item.type === 'used').length;

      this.setData({
        inventoryList: newList,
        totalCount: totalNum,
        newCount: newCount,
        usedCount: usedCount,
        hasMore: rawList.length === this.data.pageSize,
        page: this.data.page + 1
      });
    } catch (error) {
      console.error("加載庫存數據失敗:", error);
      wx.showToast({ title: '網絡請求失敗', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 計算庫齡（天數）
  calculateAgeDays(inboundTimeString: string): number {
    const inboundDate = new Date(inboundTimeString.replace(/-/g, '/'));
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - inboundDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshData();
    wx.stopPullDownRefresh();
  },

  // 觸底加載更多
  onReachBottom() {
    this.loadData();
  },

  goToDetail(e: any) {
    const imei = e.currentTarget.dataset.imei;
    wx.navigateTo({ url: `/pages/inventory/detail/index?imei=${imei}` });
  }
});