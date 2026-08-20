Component({
  properties: {
    messages: { type: Array, value: [] },
    lastMsgId: { type: String, value: '' },
    stockList: { type: Array, value: [] },
    loading: { type: Boolean, value: false },
    userRole: { type: String, value: '' },
    stats: { type: Object, value: {} }
  },

  methods: {
    // 轉發消息給主頁面打 API
    onSendMessage(e: any) {
      this.triggerEvent('sendMessage', e.detail);
    },
    // 轉發卡片確認事件
    onConfirmAdd(e: any) {
      this.triggerEvent('confirmAdd', e.detail);
    },
    onConfirmSell(e: any) {
      console.log('2[AI-CARD] 點擊了出售按鈕，當前 info:', e.detail);
      this.triggerEvent('confirmSell', e.detail);
    },
    onSelectStockDevice(e: any) {
      this.triggerEvent('selectStockDevice', e.detail);
    },
    onCopyText(e: any) {
      const text = e.currentTarget.dataset.text;
      if (text) wx.setClipboardData({ data: text });
    }
  }
});