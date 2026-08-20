import { i18nBehavior } from '../../../utils/i18n/i18n';
import { request } from '../../../utils/request';

Page({
  behaviors: [i18nBehavior],

  data: {
    activeTab: 'all', // 'all' (全部) | 'pending' (待出庫) | 'completed' (已完成)
    searchKeyword: '',
    saleList: [] as Array<any>,
    loading: false,
    page: 1,
    pageSize: 20,
    hasMore: true,
    totalCount: 0
  },

  onShow() {
    // 確保返回頁面時能正常重新加載最新狀態
    this.setData({ loading: false }, () => {
      this.refreshData();
    });
  },

  // 重置分頁並刷新資料
  refreshData() {
    this.setData({ page: 1, saleList: [], hasMore: true }, () => {
      this.loadData();
    });
  },

  // 映射 Tab 到後端狀態過濾 (all: undefined, pending: 1, completed: 2)
  getStatusByTab(tab: string): number | undefined {
    if (tab === 'pending') return 1;
    if (tab === 'completed') return 2;
    if (tab === 'returned') return 0;
    return undefined;
  },

  // 切換 Tab
  onTabChange(e: any) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;

    this.setData({ activeTab: tab }, () => {
      this.refreshData();
    });
  },

  // 搜尋關鍵字輸入
  onSearchInput(e: any) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch() {
    this.refreshData();
  },

  // 核心資料加載函數（調用真實接口）
  async loadData() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });

    const cleanKeyword = this.data.searchKeyword ? this.data.searchKeyword.trim() : '';
    const status = this.getStatusByTab(this.data.activeTab);

    try {
      // 構建 API 請求參數
      const queryParams: Record<string, any> = {
        order_type: 2, // 2: 銷售單據
        page: this.data.page,
        page_size: this.data.pageSize
      };

      if (status !== undefined) {
        queryParams.status = status;
      }

      if (cleanKeyword && cleanKeyword !== 'undefined') {
        queryParams.keyword = cleanKeyword;
      }

      // 調用合併後的通用單據列表接口
      const res: any = await request({
        url: '/api/v1/purchases/list',
        method: 'GET',
        data: queryParams
      });

      // 相容 Bare Payload (res.items)
      const rawList = res.items || (res.data && res.data.items) || [];
      const totalNum = res.total ?? (res.data && res.data.total) ?? rawList.length;


      

      // 轉換資料格式適配 View 層
      const fetchedList = rawList.map((item: any) => ({
        id: item.id,
        title: item.title,
        orderSn: item.order_sn,
        // 核心修復：強制轉成 Number，避免字串 "2" 比對失敗，並設置兜底值
        payment_status: item.status !== undefined && item.status !== null ? Number(item.status) : 0,
        customerName: item.partner_name || '散客/零售客戶',
        customerPhone: item.partner_phone || '-',
        totalAmount: item.total_amount || 0,
        totalProfit: item.total_profit || 0,
        totalQuantity: item.order_item_count,
        createdAt: item.created_at ? item.created_at.replace('T', ' ').substring(0, 16) : '-'
      }));

      const newList = this.data.page === 1 ? fetchedList : [...this.data.saleList, ...fetchedList];

      this.setData({
        saleList: newList,
        totalCount: totalNum,
        hasMore: rawList.length === this.data.pageSize,
        page: this.data.page + 1
      });
    } catch (error) {
      console.error('獲取銷售單據失敗:', error);
      wx.showToast({ title: '網路請求失敗', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
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

  // 跳轉至新建銷售頁
  goToCreateForm() {
    wx.navigateTo({ url: '/pages/sale/form/index' });
  },

  // 進入單據詳情頁
  goToDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/sale/detail/index?id=${id}` });
  }
});