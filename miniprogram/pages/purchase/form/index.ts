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

    // 1. 表單單選欄位與字典選項
    form: {
      network: '',
      conditionDetail: ''
    },
    options: {
      network: ['全網通 5G', '外版無鎖', '外版有鎖(卡貼)', '移動/聯通/電信單網', 'WiFi版'],
      conditionDetail: ['全原無拆修', '換過電池', '換過螢幕', '小修/拆修過', '主板大修/擴容', '功能小瑕疵'],
      color: ['黑色', '白色', '藍色', '粉色', '自然鈦色'],
      storage: ['128GB', '256GB', '512GB', '1TB']
    },
    networkIndex: 0,
    conditionDetailIndex: 0,

    items: [
      { 
        modelName: '', 
        color: '',
        storage: '',
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

  // 2. 網絡選擇事件 handler
  onNetworkChange(e: any) {
    const index = e.detail.value;
    this.setData({
      networkIndex: index,
      'form.network': this.data.options.network[index]
    });
  },

  // 3. 機況選擇事件 handler
  onConditionDetailChange(e: any) {
    const index = e.detail.value;
    this.setData({
      conditionDetailIndex: index,
      'form.conditionDetail': this.data.options.conditionDetail[index]
    });
  },

  // 4. 點擊選擇機型顏色與內存 Tag
  onSelectModelTag(e: any) {
    const { itemindex, type, value } = e.currentTarget.dataset;
    const items = [...this.data.items];
    const currentVal = (items[itemindex] as any)[type];

    // 點擊已選中的標籤可取消選擇，點擊其他則選取
    (items[itemindex] as any)[type] = currentVal === value ? '' : value;

    this.setData({ items });
  },

  // 自動計算採購總額
  calculateTotalAmount() {
    let total = 0;
    this.data.items.forEach((item: any) => {
      const price = parseFloat(item.costPrice) || 0;
      const count = item.devices.length > 0 ? item.devices.length : (item.inputImei ? 1 : 0);
      total += price * count;
    });

    this.setData({
      totalAmount: total > 0 ? total.toFixed(2) : ''
    });
  },

  onPartnerChange(e: any) {
    const { phone, name, partnerId } = e.detail;
    this.setData({
      supplierPhone: phone,
      supplierName: name,
      partnerId: partnerId
    });
  },

  onAmountInput(e: any) {
    this.setData({ totalAmount: e.detail.value });
  },

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
      { modelName: '', color: '', storage: '', costPrice: '', inputImei: '', devices: [] }
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

  onImeiInput(e: any) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    this.setData({
      [`items[${index}].inputImei`]: value
    }, () => {
      this.calculateTotalAmount();
    });
  },

  addImeiManual(e: any) {
    const index = e.currentTarget.dataset.index;
    const currentItem = this.data.items[index];
    const imeiVal = (currentItem.inputImei || '').trim();

    if (!imeiVal) {
      wx.showToast({ title: '請先輸入 SN/IMEI', icon: 'none' });
      return;
    }

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
    if (!this.data.supplierPhone) {
      wx.showToast({ title: '請輸入聯繫電話', icon: 'none' });
      return;
    }
  
    const hasEmptyModel = this.data.items.some((item: any) => !item.modelName);
    if (hasEmptyModel) {
      wx.showToast({ title: '請填寫機型名稱', icon: 'none' });
      return;
    }
  
    if (this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });

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
        color: item.color || '',       // 💡 帶上顏色
        storage: item.storage || '',   // 💡 帶上內存
        serials: serialList,
        cost_price: isNaN(parsedCost) ? 0 : parsedCost,
        network: this.data.form.network,
        condition_detail: this.data.form.conditionDetail
      };
    });
  
    const payload = {
      supplier_phone: this.data.supplierPhone,
      supplier_name: this.data.supplierName || '',
      partner_id: this.data.partnerId,
      total_amount: parseFloat(this.data.totalAmount) || 0,
      status: 'pending',
      network: this.data.form.network,
      condition_detail: this.data.form.conditionDetail,
      items: formattedItems
    };
  
    wx.showLoading({ title: '提交中...', mask: true });
  
    request({
      url: '/api/v1/inventory/device/add',
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