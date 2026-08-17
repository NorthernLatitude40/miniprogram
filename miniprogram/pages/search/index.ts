// pages/search/index.ts
import { request } from '../../utils/request';

interface SearchResultItem {
  id: string;
  type: 'stock' | 'order';
  typeText: string;
  title: string;
  status: string;
  imei?: string;
  orderNo?: string;
  customer?: string;
  price?: number;
  date: string;
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 88,
    keyword: '',
    historyList: [] as string[],
    activeTab: 'all', // 'all' | 'stock' | 'order'
    isSearching: false,
    
    // 搜索结果
    stockResults: [] as SearchResultItem[],
    orderResults: [] as SearchResultItem[],
    displayResults: [] as SearchResultItem[],
    totalCount: 0
  },

  onLoad(options: { keyword?: string }) {
    this.initNavBar();
    this.loadSearchHistory();

    // 如果从其他页面（如看板扫码）带了 keyword 参数过来，直接触发搜索
    if (options.keyword) {
      const decoded = decodeURIComponent(options.keyword);
      this.setData({ keyword: decoded });
      this.executeSearch(decoded);
    }
  },

  // 计算顶部导航高度
  initNavBar() {
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const menuButton = wx.getMenuButtonBoundingClientRect();

      const statusBarHeight = windowInfo.statusBarHeight || 20;
      const menuTop = menuButton.top || statusBarHeight + 6;
      const navBarHeight = menuButton.bottom
        ? menuButton.bottom + (menuTop - statusBarHeight)
        : statusBarHeight + 44;

      this.setData({ statusBarHeight, navBarHeight });
    } catch (e) {
      console.error('获取系统尺寸失败', e);
    }
  },

  // 输入框变化 handler
  onInput(e: any) {
    const val = e.detail.value.trim();
    this.setData({ keyword: val });
    if (!val) {
      this.setData({
        stockResults: [],
        orderResults: [],
        displayResults: [],
        totalCount: 0
      });
    }
  },

  // 点击键盘“搜索”按钮
  onSearch() {
    if (!this.data.keyword) return;
    this.saveSearchHistory(this.data.keyword);
    this.executeSearch(this.data.keyword);
  },

  // 执行搜索 API 请求
  executeSearch(keyword: string) {
    this.setData({ isSearching: true });
    const currentShopId = wx.getStorageSync('current_shop_id') || '';

    // 发起全局搜索接口请求
    request({
      url: `/api/v1/dashboard/search/global`,
      method: 'GET',
      data: { q: keyword },
      header: { 'X-Shop-Id': String(currentShopId) }
    })
      .then((res: any) => {
        const rawData = res?.data || res || {};
        const stocks: SearchResultItem[] = (rawData.stocks || []).map((s: any) => ({
          id: s.id,
          type: 'stock',
          typeText: '在库设备',
          title: `${s.brand || ''} ${s.model_name || s.model || ''}`,
          status: s.status || '在库',
          imei: s.imei,
          price: s.cost_price || s.price,
          date: s.created_at || ''
        }));

        const orders: SearchResultItem[] = (rawData.orders || []).map((o: any) => ({
          id: o.id,
          type: 'order',
          typeText: '业务订单',
          title: `订单: ${o.order_no}`,
          status: o.status || '已完成',
          orderNo: o.order_no,
          customer: o.customer_name || o.phone,
          price: o.total_amount,
          date: o.created_at || ''
        }));

        const total = stocks.length + orders.length;
        this.setData({
          stockResults: stocks,
          orderResults: orders,
          totalCount: total
        });

        this.filterDisplayResults();
      })
      .catch((err) => {
        console.error('搜索请求失败:', err);
        wx.showToast({ title: '搜索失败，请重试', icon: 'none' });
      })
      .finally(() => {
        this.setData({ isSearching: false });
      });
  },

  // 根据当前 selected Tab 过滤展示列表
  filterDisplayResults() {
    const { activeTab, stockResults, orderResults } = this.data;
    let list: SearchResultItem[] = [];

    if (activeTab === 'stock') {
      list = stockResults;
    } else if (activeTab === 'order') {
      list = orderResults;
    } else {
      list = [...stockResults, ...orderResults];
    }

    this.setData({ displayResults: list });
  },

  // Tab 切换
  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.filterDisplayResults();
  },

  // 扫码带入搜索
  scanIMEI() {
    wx.scanCode({
      scanType: ['barCode', 'qrCode'],
      success: (res) => {
        if (res.result) {
          this.setData({ keyword: res.result });
          this.onSearch();
        }
      }
    });
  },

  // 历史记录管理
  loadSearchHistory() {
    const history = wx.getStorageSync('search_history') || [];
    this.setData({ historyList: history });
  },

  saveSearchHistory(keyword: string) {
    let history: string[] = wx.getStorageSync('search_history') || [];
    history = history.filter((item) => item !== keyword);
    history.unshift(keyword);
    if (history.length > 10) history = history.slice(0, 10); // 只保留最近 10 条
    wx.setStorageSync('search_history', history);
    this.setData({ historyList: history });
  },

  clearHistory() {
    wx.removeStorageSync('search_history');
    this.setData({ historyList: [] });
  },

  clearInput() {
    this.setData({
      keyword: '',
      stockResults: [],
      orderResults: [],
      displayResults: [],
      totalCount: 0
    });
  },

  onTagTap(e: any) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ keyword });
    this.executeSearch(keyword);
  },

  // 点击卡片跳转详情
  onResultItemTap(e: any) {
    const item: SearchResultItem = e.currentTarget.dataset.item;
    if (item.type === 'stock') {
      wx.navigateTo({ url: `/pages/stock/detail?id=${item.id}` });
    } else {
      wx.navigateTo({ url: `/pages/sales/detail?id=${item.id}` });
    }
  },

  // 快捷联动 AI 对话
  askAIWithKeyword() {
    const kw = this.data.keyword;
    wx.navigateTo({
      url: `/pages/ai/index?prompt=${encodeURIComponent(`帮我分析查一下：${kw}`)}`
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/business/index' }) });
  }
});