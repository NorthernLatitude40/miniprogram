import { request } from '../../utils/request';

interface DeviceModelDict {
  id: number;
  model_name: string;
  colors: string[];
  storages: string[];
  versions: string[];
}

Page({
  data: {
    rawModelDictList: [] as DeviceModelDict[],
    modelNames: [] as string[],
    
    // 1. 頂層與表單內同步維護供應商資訊，解決 WXML 傳值無效問題
    supplierPhone: '',
    supplierName: '',
    partnerId: null as number | null,
    totalAmount: '',

    // 2. Picker 索引
    networkIndex: 0,
    conditionDetailIndex: 0,
    modelIndex: 0,

    form: {
      model: '',
      condition: '',
      color: '',
      storage: '',
      version: '',
      battery: '',
      system: '',
      network: '',
      conditionDetail: '',
      imei: '',
      sn: '',
      isOutofWarranty: true,
      costPrice: '',
      supplierPhone: '',
      supplierName: '',
      partnerId: null as number | null
    },

    // 3. 字典選項容器
    options: {
      condition: [] as string[],
      color: [] as string[],
      storage: [] as string[],
      version: [] as string[],
      network: [] as string[],
      conditionDetail: [] as string[]
    },
    submitting: false
  },

  onLoad(options: any) {
    if (options.type) {
      this.setData({ type: Number(options.type) });
    }
    this.fetchDeviceOptions();
  },

  // 獲取字典數據並初始化預設值
  async fetchDeviceOptions() {
    try {
      const res: any = await request({ url: '/api/v1/inventory/device/options', method: 'GET' });

      if (res.code === 200) {
        const models: DeviceModelDict[] = res.data.models || [];
        const conditions: string[] = res.data.conditions || [];
        const networks: string[] = res.data.networks || ['全網通 5G', '外版無鎖', '外版有鎖(卡貼)', '移動/聯通/電信單網', 'WiFi版'];
        const conditionDetails: string[] = res.data.condition_details || ['全原無拆修', '換過電池', '換過螢幕', '小修/拆修過', '主板大修/擴容', '功能小瑕疵'];
        
        const modelNames = models.map(m => m.model_name);

        this.setData({
          rawModelDictList: models,
          modelNames: modelNames,
          'options.condition': conditions,
          'options.network': networks,
          'options.conditionDetail': conditionDetails
        });

        if (models.length > 0) {
          this.applyModelAttributes(models[0]);
        }
      }
    } catch (err) {
      wx.showToast({ title: '加載字典失敗', icon: 'none' });
    }
  },

  // 💡 供應商選擇組件事件處理：同步更新頂層與 form 內部資料
  onPartnerChange(e: WechatMiniprogram.CustomEvent) {
    const detail = e.detail || {};
    const phone = detail.phone || '';
    const name = detail.name || detail.supplierName || '';
    const partnerId = detail.partnerId || detail.partner_id || detail.id || null;

    this.setData({
      supplierPhone: phone,
      supplierName: name,
      partnerId: partnerId,
      'form.supplierPhone': phone,
      'form.supplierName': name,
      'form.partnerId': partnerId
    });
  },

  // 機型 Picker 切換 Handler
  onModelPickerChange(e: WechatMiniprogram.CustomEvent) {
    const index = Number(e.detail.value);
    const selectedModel = this.data.rawModelDictList[index];
    if (selectedModel) {
      this.setData({ modelIndex: index });
      this.applyModelAttributes(selectedModel);
    }
  },

  // 網絡選擇器切換 Handler
  onNetworkChange(e: WechatMiniprogram.CustomEvent) {
    const index = Number(e.detail.value);
    const selectedNetwork = this.data.options.network[index] || '';
    this.setData({
      networkIndex: index,
      'form.network': selectedNetwork
    });
  },

  // 機況細項選擇器切換 Handler
  onConditionDetailChange(e: WechatMiniprogram.CustomEvent) {
    const index = Number(e.detail.value);
    const selectedDetail = this.data.options.conditionDetail[index] || '';
    this.setData({
      conditionDetailIndex: index,
      'form.conditionDetail': selectedDetail
    });
  },

  applyModelAttributes(targetModel: DeviceModelDict) {
    this.setData({
      'form.model': targetModel.model_name,
      'options.color': targetModel.colors,
      'options.storage': targetModel.storages,
      'options.version': targetModel.versions,
      'form.color': targetModel.colors[0] || '',
      'form.storage': targetModel.storages[0] || '',
      'form.version': targetModel.versions[0] || ''
    });
  },

  onSelectTag(e: WechatMiniprogram.CustomEvent) {
    const { type, value } = e.currentTarget.dataset;
    this.setData({ [`form.${type}`]: value });
  },

  onInputChange(e: WechatMiniprogram.CustomEvent) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onAmountInput(e: WechatMiniprogram.CustomEvent) {
    this.setData({ 
      totalAmount: e.detail.value,
      'form.costPrice': e.detail.value
    });
  },

  onSwitchChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ 'form.isOutofWarranty': e.detail.value });
  },

  onScanCode(e: WechatMiniprogram.CustomEvent) {
    const field = e.currentTarget.dataset.field;
    wx.scanCode({
      scanType: ['barCode', 'qrCode'],
      success: (res) => {
        this.setData({ [`form.${field}`]: res.result });
      }
    });
  },

  async onSubmit() {
    const { form, totalAmount, supplierPhone, supplierName, partnerId, submitting } = this.data;
    if (submitting) return;

    if (!form.model) {
      wx.showToast({ title: '請選擇機型', icon: 'none' });
      return;
    }

    const price = Number(totalAmount || form.costPrice) || 0;

    const payload = {
      supplier_phone: supplierPhone || form.supplierPhone || '',
      supplier_name: supplierName || form.supplierName || '',
      partner_id: partnerId || form.partnerId || null,
      total_amount: price,
      status: 'pending',
      network: form.network,
      condition_detail: form.conditionDetail,
      items: [
        {
          model_name: form.model,
          condition: form.condition,
          color: form.color,
          storage: form.storage,
          version: form.version,
          battery: form.battery ? `${form.battery}%` : '',
          system: form.system,
          network: form.network,
          condition_detail: form.conditionDetail,
          imei: form.imei,
          sn_code: form.sn,
          is_outof_warranty: form.isOutofWarranty,
          cost_price: price,
          total_amount: price
        }
      ]
    };

    this.setData({ submitting: true });
    wx.showLoading({ title: '正在提交入庫...', mask: true });

    try {
      await request({ url: '/api/v1/inventory/device/add-detailed', method: 'POST', data: payload });
      wx.hideLoading();
      this.setData({ submitting: false });

      wx.showToast({ title: '入庫成功！', icon: 'success' });
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1500);
    } catch (err: any) {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showModal({ title: '提交失敗', content: err?.detail || '請求失敗', showCancel: false });
    }
  }
});