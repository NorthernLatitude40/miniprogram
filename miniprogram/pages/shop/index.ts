import { request } from '../../utils/request';
import { fetchUserInfo } from '../../utils/user';

// 1. 店鋪數據結構
interface ShopItem {
  id: number;
  name: string;
  logo?: string;
  staff_id: number;
  role: string;
  is_default?: boolean;
}

interface ShopInfo {
  shopName: string;
  staffCount: number;
}

// 2. 頁面 Data 型態定義
interface IPageData {
  statusBarHeight: number;
  navBarHeight: number;
  menuTop: number;
  menuHeight: number;
  defaultShopIcon: string;
  shopInfo: ShopInfo;
  userInfo?: any;
}

// 3. 頁面 Custom 方法型態定義
interface IPageCustom {
  fetchShopInfo: () => void;
  goBack: () => void;
  onSwitchShop: () => void;
  onTapShopInfo: () => void;
  goToCreateShop: () => void;
  onTapStaffPermission: () => void;
}

Page<IPageData, IPageCustom>({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuTop: 40,
    menuHeight: 32,
    defaultShopIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231976d2'><path d='M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z'/></svg>",
    shopInfo: {
      shopName: '演示',
      staffCount: 1
    },
    userInfo: null
  },

  onLoad() {
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
    
    // 初始化时同步加载用户信息
    fetchUserInfo().then((userInfo) => {
      this.setData({ userInfo });
    }).catch((err) => {
      console.error('初始化用户信息失败:', err);
    });
  },

  // 獲取當前店鋪詳細資訊
  fetchShopInfo() {
    request({
      url: '/api/v1/shops/current',
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

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  // 🌟 核心：点击顶部图标/店铺名称，调用 API 并弹出选单切换
  onSwitchShop() {
    wx.showLoading({ title: '加载店铺列表中...', mask: true });

    request<ShopItem[]>({
      url: '/api/v1/shops/my-shops',
      method: 'GET'
    }).then((shops) => {
      wx.hideLoading();

      if (!Array.isArray(shops) || shops.length === 0) {
        wx.showToast({ title: '暂无关联店铺', icon: 'none' });
        return;
      }

      // 🌟 以 staff_id 作为当前身份的唯一判定依据
      const currentStaffId = wx.getStorageSync('current_staff_id');

      if (shops.length === 1) {
        wx.showToast({ title: '当前仅有一个可选身份', icon: 'none' });
        return;
      }

      // 🌟 格式化菜单显示的文本：店铺名 (角色) [#staff_id] (当前)
      const formatItemText = (s: ShopItem): string => {
        const isCurrent = String(s.staff_id) === String(currentStaffId);
        const roleText = s.role ? ` (${s.role})` : '';
        const staffText = s.staff_id ? ` [#${s.staff_id}]` : '';
        const currentText = isCurrent ? ' (当前)' : '';
        return `${s.name}${roleText}${staffText}${currentText}`;
      };

      // 🌟 核心：切换逻辑处理
      const doSwitch = (selectedShop: ShopItem) => {
        if (!selectedShop) return;

        // 若点击的就是当前生效的身份，不重复切换
        if (String(selectedShop.staff_id) === String(currentStaffId)) {
          wx.showToast({ title: '当前已处于该身份', icon: 'none' });
          return;
        }

        // 1. 更新 Storage 核心会话 ID
        wx.setStorageSync('current_staff_id', selectedShop.staff_id);
        wx.setStorageSync('current_shop_id', selectedShop.id);
        if (selectedShop.role) {
          wx.setStorageSync('role', selectedShop.role);
        }

        // 2. 原位更新已有 userInfo Storage 对象的字段
        const oldUserInfo = wx.getStorageSync('userInfo') || {};
        const updatedUserInfo = {
          ...oldUserInfo,
          shop_id: selectedShop.id,
          staff_id: selectedShop.staff_id,
          role: selectedShop.role || oldUserInfo.role
        };
        wx.setStorageSync('userInfo', updatedUserInfo);

        // 3. 同步 App 全局变量
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.currentStaffId = selectedShop.staff_id;
          app.globalData.currentShopId = selectedShop.id;
          app.globalData.role = selectedShop.role;
          app.globalData.userInfo = updatedUserInfo;
        }

        wx.showToast({
          title: `已切换至: ${selectedShop.name}`,
          icon: 'success',
          duration: 1200,
          mask: true
        });

        // 4. 延迟重新获取新身份下的完整 userInfo 与店铺详情
        setTimeout(() => {
          this.fetchShopInfo();

          fetchUserInfo().then((newUserInfo) => {
            wx.setStorageSync('userInfo', newUserInfo);
            this.setData({ userInfo: newUserInfo });
          }).catch((err) => {
            console.error('切换店铺后获取用户信息失败:', err);
          });
        }, 1200);
      };

      // 🌟 判断身份数量：6 个以内用 ActionSheet，超过 6 个分批展示
      if (shops.length <= 6) {
        const itemList = shops.map(s => formatItemText(s));

        wx.showActionSheet({
          itemList: itemList,
          success: (res) => {
            doSwitch(shops[res.tapIndex]);
          }
        });
      } else {
        const firstBatch = shops.slice(0, 5);
        const itemList = firstBatch.map(s => formatItemText(s));
        itemList.push(`👉 查看其余 ${shops.length - 5} 个身份...`);

        wx.showActionSheet({
          itemList: itemList,
          success: (res) => {
            if (res.tapIndex < 5) {
              doSwitch(shops[res.tapIndex]);
            } else {
              const nextBatch = shops.slice(5);
              const nextItemList = nextBatch.map(s => formatItemText(s));

              wx.showActionSheet({
                itemList: nextItemList,
                success: (nextRes) => {
                  doSwitch(nextBatch[nextRes.tapIndex]);
                }
              });
            }
          }
        });
      }

    }).catch((err) => {
      wx.hideLoading();
      console.error('获取店铺列表失败:', err);
      wx.showToast({ title: '获取店铺列表失败', icon: 'none' });
    });
  },

  onTapShopInfo() {
    wx.navigateTo({ url: '/pages/shop-edit/index?type=edit' });
  },

  goToCreateShop() {
    wx.navigateTo({ url: '/pages/shop-edit/index?type=create' });
  },

  onTapStaffPermission() {
    wx.navigateTo({ url: '/pages/staff/index' });
  }
});