import { t } from '../../utils/i18n/i18n';

Component({
  properties: {
    // 卡片解析數據
    info: {
      type: Object,
      value: null
    },
    // 當前訊息在父組件列表中的索引
    index: {
      type: Number,
      value: 0
    },
    // 是否已點擊過確認（防重複點擊）
    isConfirmed: {
      type: Boolean,
      value: false
    },
    // 父組件傳入的當前庫存列表（用於代詞選單）
    stockList: {
      type: Array,
      value: []
    }
  },

  methods: {
    // 觸發父組件：確認入庫
    onConfirmAdd() {
      this.triggerEvent('confirmAdd', {
        info: this.data.info,
        index: this.data.index
      });
    },

    // 觸發父組件：確認出售
    onConfirmSell() {
      console.log('[AI-CARD] 點擊了出售按鈕，當前 info:', this.data.info);
      this.triggerEvent('confirmSell', {
        info: this.data.info,
        index: this.data.index
      });
    },

    // 觸發父組件：選擇代詞關聯設備
    onSelectStockDevice(e: WechatMiniprogram.CustomEvent) {
      this.triggerEvent('selectStockDevice', {
        msgIndex: this.data.index,
        value: e.detail.value
      });
    },

    // 🌟 一鍵複製卡片詳細資訊
    copyCardInfo() {
      const info = this.data.info;
      if (!info) return;

      const deviceName = info.selected_device
        ? (info.selected_device.title || info.selected_device.model)
        : (info.model || info.model_or_id || '');

      const lines = [
        `【設備資訊】`,
        `型號: ${deviceName}`,
        info.spec ? `規格: ${info.spec}` : '',
        info.sn || info.sn_code ? `SN: ${info.sn || info.sn_code}` : '',
        info.price || info.sell_price ? `售價: ¥${info.price || info.sell_price}` : '',
        info.cost || info.cost_price ? `成本: ¥${info.cost || info.cost_price}` : '',
        info.customer_name ? `客戶: ${info.customer_name}` : '',
        info.notes ? `備註: ${info.notes}` : ''
      ].filter(Boolean).join('\n');

      wx.setClipboardData({
        data: lines,
        success: () => {
          wx.showToast({
            title: t('copy_success') || '卡片資訊已複製',
            icon: 'success'
          });
        }
      });
    }
  }
});