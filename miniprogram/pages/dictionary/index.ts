// 引入你項目中封裝好的 request 工具
import { request } from '../../utils/request';

Page({
  data: {
    categories: [
      { key: 'condition', name: '機況成色' },
      { key: 'network', name: '網絡類型' },
      { key: 'condition_detail', name: '機況細項' },
      { key: 'version', name: '版本地區' },
      { key: 'storage', name: '記憶體容量' }
    ],
    currentTab: 'condition',
    currentCategoryName: '機況成色',
    dictList: [] as Array<{ id: number; label: string; sort_order: number }>,
    isModalShow: false,
    newLabel: ''
  },

  onLoad() {
    this.fetchDictionaryList();
  },

  onSwitchTab(e: WechatMiniprogram.CustomEvent) {
    const key = e.currentTarget.dataset.key;
    const category = this.data.categories.find(c => c.key === key);
    
    this.setData({
      currentTab: key,
      currentCategoryName: category ? category.name : ''
    }, () => {
      this.fetchDictionaryList();
    });
  },

  // 1. 獲取字典列表
  async fetchDictionaryList() {
    try {
      wx.showLoading({ title: '加載中...' });
      
      const res: any = await request({
        url: '/api/v1/dicts',
        method: 'GET',
        data: { attr_type: this.data.currentTab }
      });

      // 映射數據結構 (attr_value -> label)
      const list = (res || []).map((item: any) => ({
        id: item.id,
        label: item.attr_value,
        sort_order: item.sort_order
      }));

      this.setData({ dictList: list });
    } catch (error: any) {
      wx.showToast({ title: error?.message || '獲取失敗', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  showAddModal() {
    this.setData({ isModalShow: true, newLabel: '' });
  },

  hideAddModal() {
    this.setData({ isModalShow: false });
  },

  onInputLabel(e: WechatMiniprogram.Input) {
    this.setData({ newLabel: e.detail.value });
  },

  // 2. 新增標籤
  async onSubmitDict() {
    const { newLabel, currentTab } = this.data;
    if (!newLabel.trim()) {
      wx.showToast({ title: '請輸入標籤名稱', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '提交中...' });

      await request({
        url: '/api/v1/dicts',
        method: 'POST',
        data: {
          attr_type: currentTab,
          attr_value: newLabel.trim(),
          sort_order: 0
        }
      });

      wx.showToast({ title: '新增成功', icon: 'success' });
      this.hideAddModal();
      this.fetchDictionaryList();
    } catch (error: any) {
      wx.showToast({ title: error?.detail || error?.message || '新增失敗', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 3. 刪除標籤
  onDeleteDict(e: WechatMiniprogram.CustomEvent) {
    const { id, label } = e.currentTarget.dataset;

    wx.showModal({
      title: '確認刪除',
      content: `確定要刪除標籤「${label}」嗎？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '刪除中...' });

            await request({
              url: `/api/v1/dicts/${id}`,
              method: 'DELETE'
            });

            wx.showToast({ title: '已刪除', icon: 'success' });
            this.fetchDictionaryList();
          } catch (error: any) {
            wx.showToast({ title: error?.detail || error?.message || '刪除失敗', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  }
});