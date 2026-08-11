// pages/shop-edit/index.ts
import { request } from '../../utils/request';
export {};

interface ShopFormData {
  logoUrl: string;
  shopName: string;
  contactPerson: string;
  contactPhone: string;
  region: string[];
  addressDetail: string;
}

interface IPageData {
  statusBarHeight: number;
  navBarHeight: number;
  menuTop: number;
  menuHeight: number;
  isEdit: boolean; // 补全类型定义
  formData: ShopFormData;
}

interface IPageCustom {
  goBack: () => void;
  onChooseLogo: () => void;
  onInputShopName: (e: WechatMiniprogram.Input) => void;
  onInputContactPerson: (e: WechatMiniprogram.Input) => void;
  onInputContactPhone: (e: WechatMiniprogram.Input) => void;
  onRegionChange: (e: WechatMiniprogram.CustomEvent) => void;
  onInputAddress: (e: WechatMiniprogram.Input) => void;
  onSave: () => void;
  fetchCurrentShopInfo: () => void; // 修复中文全角冒号
}

Page<IPageData, IPageCustom>({
  data: {
    statusBarHeight: 20,
    navBarHeight: 88,
    menuTop: 40,
    menuHeight: 32,
    isEdit: false,
    formData: {
      logoUrl: '',
      shopName: '', // 初始化为空
      contactPerson: '',
      contactPhone: '',
      region: [],
      addressDetail: ''
    }
  },

  onLoad(options?: Record<string, string | undefined>): void {
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;

    // 计算导航栏总高度
    const navBarHeight = menuButton.bottom + (menuButton.top - statusBarHeight);

    // 1. 判断是【新建模式】还是【编辑模式】
    if (options && options.type === 'edit') {
      this.setData({ isEdit: true });
      this.fetchCurrentShopInfo(); // 加载现有店铺数据回显
    }

    // 2. 更新状态栏与导航栏高度
    this.setData({
      statusBarHeight,
      navBarHeight,
      menuTop: menuButton.top,
      menuHeight: menuButton.height
    });
  },

  // 获取当前店铺数据填入表单
  fetchCurrentShopInfo(): void {
    wx.showLoading({ title: '加载中...' });
    request({ url: '/api/v1/shop/current', method: 'GET' })
      .then((res: any) => {
        wx.hideLoading();
        if (res.code === 200 && res.data) {
          const d = res.data;
          this.setData({
            'formData.shopName': d.name || '',
            'formData.logoUrl': d.logo || '',
            'formData.contactPerson': d.contact_name || '',
            'formData.contactPhone': d.contact_phone || '', // 修正为驼峰字段 contactPhone
            'formData.region': [d.province || '', d.city || '', d.district || ''],
            'formData.addressDetail': d.address_detail || ''
          });
        }
      })
      .catch(() => wx.hideLoading());
  },

  goBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  onChooseLogo(): void {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          'formData.logoUrl': tempFilePath
        });
      }
    });
  },

  onInputShopName(e): void {
    this.setData({ 'formData.shopName': e.detail.value });
  },

  onInputContactPerson(e): void {
    this.setData({ 'formData.contactPerson': e.detail.value });
  },

  onInputContactPhone(e): void {
    this.setData({ 'formData.contactPhone': e.detail.value });
  },

  onRegionChange(e): void {
    this.setData({ 'formData.region': e.detail.value });
  },

  onInputAddress(e): void {
    this.setData({ 'formData.addressDetail': e.detail.value });
  },

  // 点击【保存】按钮
  onSave(): void {
    const { shopName, logoUrl, contactPerson, contactPhone, region, addressDetail } = this.data.formData;

    if (!shopName.trim()) {
      wx.showToast({ title: '请输入店铺名称', icon: 'none' });
      return;
    }

    const isEdit = this.data.isEdit;
    const url = isEdit ? '/api/v1/shop/update' : '/api/v1/shop/create';
    const method = isEdit ? 'PUT' : 'POST';

    wx.showLoading({ title: isEdit ? '更新中...' : '正在创建...' });

    request({
      url,
      method,
      data: {
        name: shopName,
        logo: logoUrl,
        contact_name: contactPerson,
        contact_phone: contactPhone,
        province: region[0] || '',
        city: region[1] || '',
        district: region[2] || '',
        address_detail: addressDetail
      }
    }).then((res: any) => {
      wx.hideLoading();
      if (res.code === 200) {
        wx.showToast({
          title: isEdit ? '修改成功' : '创建成功',
          icon: 'success',
          duration: 1500
        });

        setTimeout(() => {
          if (isEdit) {
            wx.navigateBack({ delta: 1 }); // 编辑成功后返回上一页
          } else {
            wx.reLaunch({ url: '/pages/index/index' }); // 新建成功进入首页
          }
        }, 1500);
      }
    }).catch((err: any) => {
      wx.hideLoading();
      wx.showToast({
        title: err.data?.detail || '操作失败，请重试',
        icon: 'none'
      });
    });
  }
});