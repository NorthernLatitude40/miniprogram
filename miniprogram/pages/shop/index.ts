import { request } from '../../utils/request';

interface ShopInfo {
  shopName: string;
  staffCount: number;
}

interface IPageData {
  statusBarHeight: number;
  navBarHeight: number;
  menuTop: number;
  menuHeight: number;
  defaultShopIcon: string;
  shopInfo: ShopInfo;
}

interface IPageCustom {
  fetchShopInfo: () => void;
  goBack: () => void;
  onSwitchShop: () => void;
  onTapShopInfo: () => void;
  onTapStaffPermission: () => void;
}

Page<IPageData, IPageCustom>({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuTop: 40,
    menuHeight: 32,
    // 蓝色小店铺 SVG 图标
    defaultShopIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231976d2'><path d='M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z'/></svg>",
    shopInfo: {
      shopName: '演示',
      staffCount: 1
    }
  },

  onLoad(): void {
    // 动态计算导航栏与胶囊位置
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const systemInfo = wx.getSystemInfoSync();

    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height;

    this.setData({
      statusBarHeight,
      navBarHeight,
      menuTop: menuButton.top,
      menuHeight: menuButton.height
    });

    this.fetchShopInfo();
  },

  fetchShopInfo(): void {
    request({
      url: '/api/v1/shop/current',
      method: 'GET'
    }).then((res: any) => {
      const d = res?.data || res;
      if (d) {
        this.setData({
          'shopInfo.shopName': d.name ? `${d.name}` : '演示',
          'shopInfo.staffCount': d.staff_count ?? d.staffCount ?? 1
        });
      }
    }).catch((err: any) => {
      console.error('获取店铺信息失败:', err);
    });
  },

  // 返回上一页
  goBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  onSwitchShop(): void {
    wx.showToast({
      title: '切换店铺',
      icon: 'none'
    });
  },

  onTapShopInfo(): void {
    wx.navigateTo({
      url: '/pages/shop-edit/index?type=edit'
    });
  },

  onTapStaffPermission(): void {
    wx.navigateTo({
      url: '/pages/staff/index'
    });
  }
});