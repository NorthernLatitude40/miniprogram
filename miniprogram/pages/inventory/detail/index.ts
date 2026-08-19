import { i18nBehavior } from '../../../utils/i18n/i18n';
import { request } from '../../../utils/request';

// 狀態碼映射：1-在庫, 2-已售出, 3-維修中, 4-已報廢
const STATUS_MAP: Record<number, string> = {
  0: '已退貨',
  1: '待入庫',
  2: '在庫中',
  3: '已售出',
  4: '維修中',
  5: '已報廢',
  6: '已取消'
};

Page({
  behaviors: [i18nBehavior],

  data: {
    loading: false,
    inventoryId: null as string | number | null,
    statusTextMap: STATUS_MAP,
    device: null as any
  },

  onLoad(options: any) {
    // 支援傳入 id 或 imei/sn
    const targetId = options.id || options.imei;
    if (targetId) {
      this.setData({ inventoryId: targetId });
      this.fetchDeviceDetail(targetId);
    }
  },

  // 1. 獲取設備詳情 API
  async fetchDeviceDetail(id: string | number) {
    this.setData({ loading: true });
    try {
      const res: any = await request({
        url: `/api/v1/inventories/inventory/detail/${id}`,
        method: 'GET'
      });
      
      if (res && res.code === 200 && res.data) {
        const raw = res.data;
        this.setData({
          device: {
            id: raw.id,
            imei: raw.sn_code || '-',
            modelName: raw.spec ? `${raw.title} ${raw.spec}` : raw.title,
            category: raw.category,
            type: raw.category === 1 ? 'new' : 'used',
            status: raw.status, // 數字型狀態：1, 2, 3, 4
            costPrice: raw.purchase_price ?? 0,
            salePrice: raw.selling_price ?? 0,
            purchaseOrderId: raw.purchase_order_sn || `-`,
            supplierName: raw.supplier_name || '未知供應商',
            supplierPhone: raw.supplier_phone || '-',
            inboundDate: raw.in_stock_time || '-'
          }
        });
      } else {
        wx.showToast({ title: res.msg || '獲取詳情失敗', icon: 'none' });
      }
    } catch (err) {
      console.error('獲取設備詳情失敗：', err);
      wx.showToast({ title: '網絡異常', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 2. 更新設備狀態通用函數
  async updateStatus(targetStatus: number, successText: string) {
    if (!this.data.inventoryId) return;

    wx.showLoading({ title: '處理中...' });
    try {
      const res: any = await request({
        url: `/api/v1/inventories/status`,
        method: 'POST',
        data: {
          id: this.data.device?.id || this.data.inventoryId,
          status: targetStatus
        }
      });

      wx.hideLoading();

      if (res && res.code === 200) {
        this.setData({ 'device.status': targetStatus });
        wx.showToast({ title: successText, icon: 'success' });
      } else {
        wx.showToast({ title: res.msg || '操作失敗', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '網絡請求失敗', icon: 'none' });
    }
  },

  // 標記維修 (Status = 3)
  markRepair() {
    wx.showModal({
      title: '標記維修',
      content: '確認將該設備狀態變更為「維修中」？',
      success: (res) => {
        if (res.confirm) {
          this.updateStatus(3, '已標記維修');
        }
      }
    });
  },

  // 標記報廢 (Status = 4)
  markScrap() {
    wx.showModal({
      title: '標記報廢',
      content: '確認將該設備狀態變更為「已報廢」？',
      confirmColor: '#ee0a24',
      success: (res) => {
        if (res.confirm) {
          this.updateStatus(4, '已標記報廢');
        }
      }
    });
  }
});