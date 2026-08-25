// pages/device_models/device_models.js
import { request } from '../../utils/request';

Page({
  data: {
    brands: [],
    currentBrand: '',
    modelList: [],
    isModalShow: false,
    modalType: 'model', // 'brand' | 'model'
    inputName: ''
  },

  async onLoad() {
    await this.fetchBrands();
    this.fetchModelList();
  },

  // 1. 獲取品牌列表
  async fetchBrands() {
    try {
      const res = await request({
        url: '/api/v1/dicts/device-models/brands',
        method: 'GET'
      });
      const brands = res && res.length > 0 ? res : ['Apple'];
      this.setData({
        brands: brands,
        currentBrand: this.data.currentBrand || brands[0]
      });
    } catch (error) {
      this.setData({ brands: ['Apple'], currentBrand: 'Apple' });
    }
  },

  // 切換品牌
  onSelectBrand(e) {
    const brand = e.currentTarget.dataset.brand;
    if (brand === this.data.currentBrand) return;
    this.setData({ currentBrand: brand }, () => {
      this.fetchModelList();
    });
  },

  // 2. 獲取機型列表
  async fetchModelList() {
    if (!this.data.currentBrand) return;
    try {
      wx.showLoading({ title: '加載中...' });
      const res = await request({
        url: '/api/v1/dicts/device-models',
        method: 'GET',
        data: { brand: this.data.currentBrand }
      });
      this.setData({ modelList: res || [] });
    } catch (error) {
      wx.showToast({ title: '加載失敗', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 3. 跳轉至專屬 SKU 配置詳情頁
  goToSkuDetail(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id) {
      wx.showToast({ title: '機型 ID 異常', icon: 'none' });
      return;
    }

    // 對名稱編碼，防止特殊字符或中文導致 URL 解析斷裂
    const encodedName = encodeURIComponent(name || '');

    wx.navigateTo({
      // 請確保此頁面已在 app.json 中註冊
      url: `/pages/device_model_detail/index?model_id=${id}&model_name=${encodedName}`,
      fail(err) {
        console.error('跳轉失敗:', err);
        wx.showToast({ title: '頁面跳轉失敗，請檢查路徑', icon: 'none' });
      }
    });
  },

  // 彈窗控制
  showAddModal(e) {
    const type = e.currentTarget.dataset.type || 'model';
    this.setData({ isModalShow: true, modalType: type, inputName: '' });
  },

  hideAddModal() {
    this.setData({ isModalShow: false });
  },

  onInputName(e) {
    this.setData({ inputName: e.detail.value });
  },

  // 4. 提交新增
  async onSubmitModal() {
    const { inputName, modalType, currentBrand } = this.data;
    const name = inputName.trim();
    if (!name) {
      wx.showToast({ title: '名稱不能為空', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '提交中...' });
      if (modalType === 'brand') {
        await request({
          url: '/api/v1/dicts/device-models',
          method: 'POST',
          data: { brand: name, model_name: '基礎通用款', sort_order: 0 }
        });
        wx.showToast({ title: '品牌新增成功', icon: 'success' });
        this.setData({ currentBrand: name });
        await this.fetchBrands();
      } else {
        await request({
          url: '/api/v1/dicts/device-models',
          method: 'POST',
          data: { brand: currentBrand, model_name: name, sort_order: 0 }
        });
        wx.showToast({ title: '機型新增成功', icon: 'success' });
      }
      this.hideAddModal();
      this.fetchModelList();
    } catch (error) {
      wx.showToast({ title: error?.detail || '提交失敗', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 5. 刪除機型
  onDeleteModel(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '確認刪除',
      content: `確定要刪除機型「${name}」嗎？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '刪除中...' });
            await request({
              url: `/api/v1/dicts/device-models/${id}`,
              method: 'DELETE'
            });
            wx.showToast({ title: '已刪除', icon: 'success' });
            this.fetchModelList();
          } catch (error) {
            wx.showToast({ title: '刪除失敗', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  }
});