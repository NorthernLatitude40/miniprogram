import { i18nBehavior } from '../../../utils/i18n/i18n';
import { request } from '../../../utils/request';


// 宣告防抖定時器
let phoneTimer: number | null = null;

Page({
  behaviors: [i18nBehavior],

  data: {
    customerId: null as number | null,
    customerPhone: '',
    customerName: '',
    supplierPhone: '',
    supplierName: '',
    partnerId: null as number | null,
    inputImei: '',
    totalAmount: '',
    remark: '',
    submitting: false,
    selectedDevices: [] as Array<{
      inventoryId: number;
      imei: string;
      modelName: string;
      price: string | number;
    }>
  },

  onUnload() {
    // 頁面銷毀時清除定時器
    if (phoneTimer) {
      clearTimeout(phoneTimer);
      phoneTimer = null;
    }
  },

  onPartnerChange(e: any) {
    const { phone, name, partnerId } = e.detail;
    // 這裡必須正確 setData，否則父子組件狀態會不同步
    this.setData({
      supplierPhone: phone,
      supplierName: name,
      partnerId: partnerId
    });
  },

  onImeiInput(e: any) {
    this.setData({ inputImei: e.detail.value });
  },

  // 2. 根據 IMEI/SN 檢索在庫設備並添加到列表
  async searchAndAddDevice(imei: string) {
    const cleanImei = imei.trim();
    if (!cleanImei) return;

    // 檢查前端重複添加
    const exists = this.data.selectedDevices.some(item => item.imei === cleanImei);
    if (exists) {
      wx.showToast({ title: '該設備已在列表中', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '查詢庫存中...' });

    try {
      const result: any = await request({
        url: '/api/v1/inventories/search_by_sn',
        method: 'GET',
        data: { sn_code: cleanImei }
      });

      const device = result.data || result;

      if (!device || !device.id) {
        wx.showToast({ title: '未找到該 SN/IMEI 的在庫設備', icon: 'none' });
        return;
      }
      
      if (device.status !== 2) { // 2: 在庫
        wx.showToast({ title: '該設備非在庫狀態，無法銷售', icon: 'none' });
        return;
      }

      const matchedDevice = {
        inventoryId: device.id,
        imei: device.sn_code || cleanImei,
        modelName: device.title || '未知機型',
        price: device.selling_price || device.retail_price || 0
      };

      const list = [...this.data.selectedDevices, matchedDevice];
      this.setData({
        selectedDevices: list,
        inputImei: ''
      }, () => {
        this.calculateTotal();
      });
    } catch (error: any) {
      console.error('查詢設備失敗:', error);
      wx.showToast({
        title: error?.data?.detail || '未查到該設備或已被出售',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 掃碼添加
  scanIMEI() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        const imei = res.result ? res.result.trim() : '';
        if (imei) {
          this.searchAndAddDevice(imei);
        }
      }
    });
  },

  // 手動輸入添加
  addManualDevice() {
    if (!this.data.inputImei) {
      wx.showToast({ title: '請先輸入 IMEI 或 SN 碼', icon: 'none' });
      return;
    }
    this.searchAndAddDevice(this.data.inputImei);
  },

  // 修改價格
  onDevicePriceInput(e: any) {
    const index = e.currentTarget.dataset.index;
    const price = e.detail.value;
    const list = [...this.data.selectedDevices];
    list[index].price = price;
    this.setData({ selectedDevices: list }, () => {
      this.calculateTotal();
    });
  },

  // 修改總額
  onTotalAmountInput(e: any) {
    this.setData({ totalAmount: e.detail.value });
  },

  // 刪除設備
  removeDevice(e: any) {
    const index = e.currentTarget.dataset.index;
    const list = this.data.selectedDevices.filter((_, i) => i !== index);
    this.setData({ selectedDevices: list }, () => {
      this.calculateTotal();
    });
  },

  // 計算總價
  calculateTotal() {
    const sum = this.data.selectedDevices.reduce((acc, cur) => {
      return acc + (Number(cur.price) || 0);
    }, 0);
    this.setData({ totalAmount: sum ? sum.toString() : '' });
  },

  // 3. 提交銷售單
  async submitForm() {
    if (this.data.submitting) return;

    if (this.data.selectedDevices.length === 0) {
      wx.showToast({ title: '請至少添加一台設備', icon: 'none' });
      return;
    }

    const hasInvalidPrice = this.data.selectedDevices.some(item => !item.price || Number(item.price) <= 0);
    if (hasInvalidPrice) {
      wx.showToast({ title: '請填寫正確的設備銷售售價', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '開單處理中...' });

    try {
      const payload = {
        customer_id: this.data.partnerId || this.data.customerId,
        customer_phone: this.data.supplierPhone ||this.data.customerPhone || undefined,
        customer_name: this.data.supplierName || this.data.customerName || undefined,
        outbound_type: 1, // 1: 零售銷售
        items: this.data.selectedDevices.map(item => ({
          inventory_id: item.inventoryId,
          sale_price: Number(item.price)
        })),
        remark: this.data.remark || undefined
      };

      await request({
        url: '/api/v1/inventories/create',
        method: 'POST',
        data: payload
      });

      wx.hideLoading();
      wx.showToast({
        title: '銷售開單成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
    } catch (error: any) {
      wx.hideLoading();
      console.error('銷售開單失敗:', error);
      wx.showToast({
        title: error?.data?.detail || '開單失敗，請重試',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});