import { i18nBehavior } from '../../../utils/i18n/i18n';
// 假設你有封裝好的 request 工具，如果沒有請替換為 wx.request
import { request } from '../../../utils/request'; 
import { formatToLocalTime } from '../../../utils/user';

Page({
  behaviors: [i18nBehavior],

  data: {
    loading: false,
    orderId: null as number | string | null,
    order: null as any
  },

  onLoad(options: any) {
    if (options.id) {
      this.setData({ orderId: options.id });
      this.fetchOrderDetail(options.id);
    }
  },

  // 1. 調用詳情 API 接口
  async fetchOrderDetail(id: string | number) {
    this.setData({ loading: true });
    try {
      // 請根據實際後端路由修改 URL（例如 /api/purchase/detail 或 /api/inventory/detail）
      const res: any = await request({
        url: `/api/v1/purchases/detail/${id}`,
        method: 'GET'
      });

      if (res && res.code === 200 && res.data) {
        const raw = res.data;

        // 格式化與兼容後端字段
        const orderData = {
          id: raw.id,
          orderSn: raw.order_sn || raw.orderSn || `IN-${raw.id}`,
          type: raw.category === 1 ? 'new' : 'used',
          status: raw.status === 1 ? 'pending' : 'completed',
          supplierName: raw.partner_name || raw.supplierName || '未知供應商',
          supplierPhone: raw.partner_phone || raw.supplierPhone || '-',
          totalAmount: raw.total_amount ?? raw.purchase_price ?? 0,
          createdAt: formatToLocalTime(raw.created_at) || formatToLocalTime(raw.createdAt) || '',
          // 處理設備清單 details/items
          items: (raw.items || raw.details || []).map((item: any) => ({
            modelName: item.model_name || item.title || item.name || '未命名商品',
            devices: (item.devices || item.imeis || []).map((d: any) => ({
              imei: typeof d === 'string' ? d : (d.imei || d.sn)
            }))
          }))
        };

        this.setData({ order: orderData });
      } else {
        wx.showToast({ title: res.msg || '獲取詳情失敗', icon: 'none' });
      }
    } catch (err) {
      console.error('獲取訂單詳情異常：', err);
      wx.showToast({ title: '網路異常，請重試', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 2. 確認入庫接口調用
  confirmInbound() {
    if (!this.data.orderId) return;

    wx.showModal({
      title: '確認入庫',
      content: '確認將該單據設備寫入庫存總表？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '處理中...' });
          try {
            // 調用後端確認入庫 API
            const result: any = await request({
              url: `/api/v1/purchases/confirm-inbound`,
              method: 'POST',
              data: { id: this.data.orderId }
            });

            wx.hideLoading();

            if (result && result.code === 200) {
              this.setData({ 'order.status': 'completed' });
              wx.showToast({ title: '已成功入庫', icon: 'success' });
            } else {
              wx.showToast({ title: result.msg || '操作失敗', icon: 'none' });
            }
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '請求失敗', icon: 'none' });
          }
        }
      }
    });
  }
});