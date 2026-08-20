import { i18nBehavior } from '../../../utils/i18n/i18n';
import { request } from '../../../utils/request';
import { formatToLocalTime } from '../../../utils/user';

Page({
  behaviors: [i18nBehavior],

  data: {
    loading: false,
    orderId: null as string | number | null,
    order: null as any
  },

  onLoad(options: any) {
    if (options.id) {
      this.setData({ orderId: options.id });
      this.fetchSalesDetail(options.id);
    }
  },

  // 1. 調用銷售單詳情 API
  async fetchSalesDetail(id: string | number) {
    this.setData({ loading: true });
    try {
      const res: any = await request({
        url: `/api/v1/inventories/detail/${id}`,
        method: 'GET'
      });

      if (res && res.code === 200 && res.data) {
        const raw = res.data;
        const orderData = {
          id: raw.id,
          orderSn: raw.order_sn || `SO-${raw.id}`,
          status: raw.status === 2 ? 'completed' : 'returned',
          customerName: raw.partner_name || '散客',
          customerPhone: raw.partner_phone || '-',
          totalAmount: raw.total_amount ?? 0,
          createdAt: formatToLocalTime(raw.created_at) || '',
          devices: (raw.devices || []).map((item: any) => ({
            modelName: item.model_name || '未知機型',
            imei: item.imei || item.sn || '-',
            price: item.price ?? 0
          }))
        };

        this.setData({ order: orderData });
      } else {
        wx.showToast({ title: res.msg || '獲取詳情失敗', icon: 'none' });
      }
    } catch (err) {
      console.error('獲取銷售單詳情異常：', err);
      wx.showToast({ title: '網路異常，請重試', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 2. 調用退貨 API
  handleReturn() {
    if (!this.data.orderId) return;

    wx.showModal({
      title: '辦理退貨',
      content: '確認要將該銷售單內的設備辦理退貨並還原庫存嗎？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '處理中...' });
          try {
            const result: any = await request({
              url: `/api/v1/inventories/refund`,
              method: 'POST',
              data: { id: this.data.orderId }
            });

            wx.hideLoading();

            if (result && result.code === 200) {
              this.setData({ 'order.status': 'returned' });
              wx.showToast({ title: '已成功退貨', icon: 'success' });
            } else {
              wx.showToast({ title: result.msg || '退貨失敗', icon: 'none' });
            }
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '請求失敗，請重試', icon: 'none' });
          }
        }
      }
    });
  }
});