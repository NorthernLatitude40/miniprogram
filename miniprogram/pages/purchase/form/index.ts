import { i18nBehavior } from '../../../utils/i18n/i18n';
import { request } from '../../../utils/request';

Page({
  behaviors: [i18nBehavior],

  data: {
    type: 1, 
    supplierPhone: '',
    supplierName: '',
    partnerId: null as number | null,
    totalAmount: '',
    isSubmitting: false,
    items: [
      { 
        modelName: '', 
        costPrice: '', 
        inputImei: '', 
        devices: [] as Array<{ imei: string }> 
      }
    ]
  },

  onLoad(options: any) {
    if (options.type) {
      this.setData({ type: Number(options.type) });
    }
  },

  // 自動計算採購總額（單台成本價 × 錄入的串號數量，若無串號則按 1 台計算或為 0）
  calculateTotalAmount() {
    let total = 0;
    this.data.items.forEach((item: any) => {
      const price = parseFloat(item.costPrice) || 0;
      // 若已有錄入串號則按串號數量計算，若尚無串號但有未新增的輸入框內容，視為 1 台
      const count = item.devices.length > 0 ? item.devices.length : (item.inputImei ? 1 : 0);
      total += price * count;
    });

    this.setData({
      totalAmount: total > 0 ? total.toFixed(2) : ''
    });
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


  // 允許使用者手動覆蓋總金額
  onAmountInput(e: any) {
    this.setData({ totalAmount: e.detail.value });
  },

  // 1. 監聽成本價輸入 + 自動重新計算總金額
  onCostPriceInput(e: any) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    this.setData({
      [`items[${index}].costPrice`]: value
    }, () => {
      this.calculateTotalAmount();
    });
  },

  addModelItem() {
    const items = [
      ...this.data.items, 
      { modelName: '', costPrice: '', inputImei: '', devices: [] }
    ];
    this.setData({ items }, () => {
      this.calculateTotalAmount();
    });
  },

  removeModelItem(e: any) {
    const index = e.currentTarget.dataset.index;
    const items = this.data.items.filter((_, i) => i !== index);
    this.setData({ items }, () => {
      this.calculateTotalAmount();
    });
  },

  onModelNameInput(e: any) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    this.setData({
      [`items[${index}].modelName`]: value
    });
  },

  // 2. 監聽 SN 手動輸入框
  onImeiInput(e: any) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    this.setData({
      [`items[${index}].inputImei`]: value
    }, () => {
      this.calculateTotalAmount();
    });
  },

  // 3. 手動點擊「+ 新增」觸發 + 重新計算總金額
  addImeiManual(e: any) {
    const index = e.currentTarget.dataset.index;
    const currentItem = this.data.items[index];
    const imeiVal = (currentItem.inputImei || '').trim();

    if (!imeiVal) {
      wx.showToast({ title: '請先輸入 SN/IMEI', icon: 'none' });
      return;
    }

    // 全局 SN 查重
    const isDuplicate = this.data.items.some(item =>
      item.devices.some(d => d.imei === imeiVal)
    );

    if (isDuplicate) {
      wx.showToast({ title: '該串號已在列表中', icon: 'none' });
      return;
    }

    const updatedDevices = [...currentItem.devices, { imei: imeiVal }];
    this.setData({
      [`items[${index}].devices`]: updatedDevices,
      [`items[${index}].inputImei`]: ''
    }, () => {
      this.calculateTotalAmount();
    });
  },

  scanIMEI(e: any) {
    const itemIndex = e.currentTarget.dataset.index;
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        const imei = res.result.trim();
        if (!imei) return;

        const isDuplicate = this.data.items.some(item =>
          item.devices.some(d => d.imei === imei)
        );

        if (isDuplicate) {
          wx.showToast({ title: '該串號已在列表中', icon: 'none' });
          return;
        }

        const currentItem = this.data.items[itemIndex];
        const updatedDevices = [...currentItem.devices, { imei }];
        this.setData({
          [`items[${itemIndex}].devices`]: updatedDevices
        }, () => {
          this.calculateTotalAmount();
        });
      }
    });
  },

  removeIMEI(e: any) {
    const { itemindex, devindex } = e.currentTarget.dataset;
    const currentItem = this.data.items[itemindex];
    const updatedDevices = currentItem.devices.filter((_, i) => i !== devindex);
    
    this.setData({
      [`items[${itemindex}].devices`]: updatedDevices
    }, () => {
      this.calculateTotalAmount();
    });
  },

  async submitForm() {
    // 1. 表單基本校驗
    if (!this.data.supplierPhone) {
      wx.showToast({ title: '請輸入聯繫電話', icon: 'none' });
      return;
    }
  
    const hasEmptyModel = this.data.items.some((item: any) => !item.modelName);
    if (hasEmptyModel) {
      wx.showToast({ title: '請填寫機型名稱', icon: 'none' });
      return;
    }
  
    // 2. 防重複提交
    if (this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });

    // 3. 預處理 items：處理 cost_price 數值與自動補入殘留 SN
    const formattedItems = this.data.items.map((item: any) => {
      const serialList = item.devices.map((d: any) => d.imei);
      const pendingInput = (item.inputImei || '').trim();

      if (pendingInput && !serialList.includes(pendingInput)) {
        serialList.push(pendingInput);
      }

      const parsedCost = parseFloat(item.costPrice);

      return {
        type: this.data.type,
        model_name: item.modelName,
        serials: serialList,
        cost_price: isNaN(parsedCost) ? 0 : parsedCost
      };
    });
  
    // 4. 構造請求 Body
    const payload = {
      supplier_phone: this.data.supplierPhone,
      supplier_name: this.data.supplierName || '',
      partner_id: this.data.partnerId,
      total_amount: parseFloat(this.data.totalAmount) || 0,
      status: 'pending',
      items: formattedItems
    };
  
    wx.showLoading({ title: '提交中...', mask: true });
  
    // 5. 調用 API 接口
    request({
      url: '/api/v1/inventories/device/add',
      method: 'POST',
      data: payload
    }).then((res: any) => {
      wx.hideLoading();
      wx.showToast({
        title: '單據提交成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          setTimeout(() => wx.navigateBack(), 1500);
        }
      });
    }).catch((err: any) => {
      wx.hideLoading();
      console.error('提交待入庫單據失敗:', err);
      wx.showToast({
        title: err?.message || err?.errMsg || '提交失敗，請重試',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({ isSubmitting: false });
    });
  }
});