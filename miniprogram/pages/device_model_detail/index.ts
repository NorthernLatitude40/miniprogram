// pages/device_model_detail/device_model_detail.ts
import { request } from '../../utils/request';

Page({
  data: {
    modelId: null as number | null,
    modelName: '',
    
    attrTypes: [
      { key: 'color', name: '專屬顏色' },
      { key: 'storage', name: '專屬容量' },
      { key: 'version', name: '版本地區' }
    ],
    currentTab: 'color',
    currentCategoryName: '專屬顏色',
    attrList: [] as Array<{ id: number; attr_value: string }>,

    isModalShow: false,
    newAttrValue: ''
  },

  onLoad(options: { model_id?: string; model_name?: string }) {
    if (options.model_id && options.model_name) {
      this.setData({
        modelId: Number(options.model_id),
        modelName: decodeURIComponent(options.model_name)
      }, () => {
        this.fetchAttrList();
      });
    }
  },

  onSwitchTab(e: WechatMiniprogram.CustomEvent) {
    const key = e.currentTarget.dataset.key;
    const cat = this.data.attrTypes.find(item => item.key === key);
    this.setData({
      currentTab: key,
      currentCategoryName: cat ? cat.name : ''
    }, () => {
      this.fetchAttrList();
    });
  },

  // 1. 查詢該機型專屬的 SKU 屬性列表
  async fetchAttrList() {
    if (!this.data.modelId) return;

    try {
      wx.showLoading({ title: '加載中...' });
      const res: any = await request({
        url: `/api/v1/dicts/device-models/${this.data.modelId}/attributes`,
        method: 'GET',
        data: { attr_type: this.data.currentTab }
      });
      this.setData({ attrList: res || [] });
    } catch (error: any) {
      wx.showToast({ title: error?.message || '獲取失敗', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  showAddModal() {
    this.setData({ isModalShow: true, newAttrValue: '' });
  },

  hideAddModal() {
    this.setData({ isModalShow: false });
  },

  onInputAttrValue(e: WechatMiniprogram.Input) {
    this.setData({ newAttrValue: e.detail.value });
  },

  // 2. 提交新增機型專屬屬性 (model_id = 特定ID)
  async onSubmitAttr() {
    const { newAttrValue, currentTab, modelId } = this.data;
    if (!newAttrValue.trim()) {
      wx.showToast({ title: '請輸入屬性值', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '提交中...' });
      await request({
        url: `/api/v1/dicts/device-models/${modelId}/attributes`,
        method: 'POST',
        data: {
          attr_type: currentTab,
          attr_value: newAttrValue.trim(),
          sort_order: 0
        }
      });

      wx.showToast({ title: '新增成功', icon: 'success' });
      this.hideAddModal();
      this.fetchAttrList();
    } catch (error: any) {
      wx.showToast({ title: error?.detail || error?.message || '新增失敗', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 3. 刪除機型專屬屬性
  onDeleteAttr(e: WechatMiniprogram.CustomEvent) {
    const { id, value } = e.currentTarget.dataset;

    wx.showModal({
      title: '確認刪除',
      content: `確定要刪除專屬屬性「${value}」嗎？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '刪除中...' });
            await request({
              url: `/api/v1/dicts/attributes/${id}`,
              method: 'DELETE'
            });

            wx.showToast({ title: '已刪除', icon: 'success' });
            this.fetchAttrList();
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