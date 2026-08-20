import { i18nBehavior } from '../../../utils/i18n/i18n';
import { request } from '../../../utils/request';
import { formatToLocalTime } from '../../../utils/user';

Page({
  behaviors: [i18nBehavior],

  data: {
    activeTab: 'pending', // 'pending' (待入庫) | 'completed' (已完成)
    searchKeyword: '',
    purchaseList: [] as Array<any>,
    loading: false,
    page: 1,
    pageSize: 20,
    hasMore: true,
    totalCount: 0
  },

  onShow() {
    this.refreshData();
  },

  // 映射 Tab 到後端 status 狀態值 (1: 待入庫, 2: 已完成)
  getStatusByTab(tab: string): number {
    return tab === 'completed' ? 2 : 1;
  },

  // 重置分頁並刷新數據
  refreshData() {
    this.setData({ page: 1, purchaseList: [], hasMore: true }, () => {
      this.fetchPurchaseList();
    });
  },

  // 切換 Tab (待入庫 / 已完成)
  onTabChange(e: any) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    
    this.setData({ activeTab: tab }, () => {
      this.refreshData();
    });
  },

  // 搜尋關鍵字輸入 (支持串號/電話)
  onSearchInput(e: any) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch() {
    this.refreshData();
  },

  // 獲取進貨單據列表
  async fetchPurchaseList() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });

    // 過濾無效關鍵字，避免傳遞 "undefined" 或空白字串
    const cleanKeyword = this.data.searchKeyword ? this.data.searchKeyword.trim() : '';
    const status = this.getStatusByTab(this.data.activeTab);

    try {
      // 構建請求參數
      const queryParams: Record<string, any> = {
        order_type: 1,
        page: this.data.page,
        page_size: this.data.pageSize,
        status: status
      };

      if (cleanKeyword && cleanKeyword !== 'undefined') {
        queryParams.keyword = cleanKeyword;
      }

      const res: any = await request({
        url: '/api/v1/purchases/list', // 請調整為你後端的實際 API 路徑
        method: 'GET',
        data: queryParams
      });

      // 相容 Bare Payload (res.items) 與標準回應包裝 (res.data.items / res.data.list)
      const rawList = res.items || (res.data && res.data.items) || (res.data && res.data.list) || [];
      const totalNum = res.total ?? (res.data && res.data.total) ?? rawList.length;

      // 轉換後端欄位為頁面渲染所需的資料格式
      const fetchedList = rawList.map((item: any) => ({
        id: item.id || item.purchase_no,
        title: item.title,
        type: item.category === 1 ? 'new' : 'used',
        status: item.status,
        supplierName: item.partner_name || '未知供應商',
        supplierPhone: item.partner_phone || '-',
        totalAmount: item.total_amount || 0,
        itemCount: item.item_count || item.quantity || 0,
        createdAt: item.created_at ? formatToLocalTime(item.created_at) : '-'
      }));
      const newList = this.data.page === 1 ? fetchedList : [...this.data.purchaseList, ...fetchedList];

      this.setData({
        purchaseList: newList,
        totalCount: totalNum,
        hasMore: rawList.length === this.data.pageSize,
        page: this.data.page + 1
      });
    } catch (error) {
      console.error('獲取進貨單據列表失敗:', error);
      wx.showToast({ title: '網絡請求失敗', icon: 'none' });
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
    this.fetchPurchaseList();
  },

  // 跳轉至新建進貨頁 (新機 / 二手機)
  goToCreateForm(e: any) {
    const type = e.currentTarget.dataset.type; // 'new' | 'used'
    wx.navigateTo({
      url: `/pages/purchase/form/index?type=${type}`
    });
  },

  // 進入單據詳情或辦理入庫
  goToDetail(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/purchase/detail/index?id=${id}`
    });
  }
});