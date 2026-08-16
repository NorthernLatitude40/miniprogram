import { request } from '../../utils/request';

export {}; // 隔绝全局作用域

interface StaffItem {
  id: string;
  name: string;
  isCreator: boolean;
  roleName?: string;
  phone?: string;
  isActive?: boolean;
  is_active?: boolean;
  status?: number; // 0: 待认领, 1: 正常， 2：禁用
  invite_token?: string; // 🌟 接收后端返回的加密 Token
}

interface IPageData {
  statusBarHeight: number;
  navBarHeight: number;
  menuTop: number;
  menuHeight: number;
  staffList: StaffItem[];
  shopId: string;
}

interface IPageCustom {
  fetchStaffList: () => void;
  goBack: () => void;
  onTapStaff: (e: WechatMiniprogram.TouchEvent) => void;
  onAddStaff: () => void;
  preventBubble: () => void;
  onShareAppMessage: (opts?: WechatMiniprogram.Page.IShareAppMessageOption) => WechatMiniprogram.Page.ICustomShareContent;
}

Page<IPageData, IPageCustom>({
  data: {
    statusBarHeight: 20,
    navBarHeight: 88,
    menuTop: 40,
    menuHeight: 32,
    staffList: [],
    shopId: ''
  },

  // 🌟 每次頁面顯示（包含初始化、從詳情頁返回）都會執行
  onShow() {
    // 3. 拉取员工列表
    this.fetchStaffList();
  },

  onLoad(): void {
    // 1. 获取当前 shopId
    const currentShopId = wx.getStorageSync('current_shop_id') || '';
    this.setData({ shopId: currentShopId });

    // 2. 自定义导航栏计算
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navBarHeight = menuButton.bottom 
      ? menuButton.bottom + (menuButton.top - statusBarHeight)
      : statusBarHeight + 44;

    this.setData({
      statusBarHeight,
      navBarHeight,
      menuTop: menuButton.top || statusBarHeight + 6,
      menuHeight: menuButton.height || 32
    });

  },

  // 查询当前店铺下的所有员工
  fetchStaffList(): void {
    wx.showLoading({ title: '加载中...' });

    request({
      url: `/api/v1/shop/staffs`,
      method: 'GET'
    })
      .then((res: any) => {
        wx.hideLoading();
        const list = res?.data || res || [];
        this.setData({ staffList: list });
      })
      .catch((err: any) => {
        wx.hideLoading();
        console.error('获取员工列表失败:', err);
        // 测试 Mock 降级
        this.setData({
          staffList: [
            { id: '101', name: '超级管理员', isCreator: true, roleName: '创建人', isActive: true },
            { id: '102', name: '海德薇', isCreator: false, roleName: '员工', isActive: false, invite_token: 'mock_token_102' }
          ]
        });
      });
  },

  goBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  // 阻止卡片点击事件冒泡
  preventBubble(): void {},

// onTapStaff 事件：點擊員工條目進入詳情頁
onTapStaff(e: WechatMiniprogram.TouchEvent): void {
  const item: StaffItem = e.currentTarget.dataset.item;
  if (!item) return;

  // encodeURIComponent 避免姓名或數據中包含特殊字符導致 URL 解析失敗
  const staffData = encodeURIComponent(JSON.stringify(item));

  wx.navigateTo({
    url: `/pages/staff-detail/index?shopId=${this.data.shopId}&staffData=${staffData}`
  });
},

  // ------------------------------------------------------------------
  // 【+ 新增员工信息】逻辑
  // ------------------------------------------------------------------
  onAddStaff(): void {
    wx.showModal({
      title: '新增员工档案',
      editable: true,
      placeholderText: '请输入员工姓名/备注',
      success: (res) => {
        if (res.confirm && res.content) {
          const staffName = res.content.trim();
          if (!staffName) {
            wx.showToast({ title: '姓名不能为空', icon: 'none' });
            return;
          }
          
          wx.showLoading({ title: '创建中...' });

          // 调用后端：创建员工档案
          request({
            url: '/api/v1/shop/staffs/create',
            method: 'POST',
            data: {
              nickname: staffName,
              role: 'staff' // 默认员工角色
            }
          })
            .then(() => {
              wx.showToast({ title: '档案创建成功', icon: 'success' });
              // 刷新列表（后端会自动生成新员工的 invite_token 并在列表中返回）
              this.fetchStaffList();
            })
            .catch((err: any) => {
              const errorMsg = err?.detail || err?.title || '创建失败，请稍后再试';
              wx.hideLoading();
              wx.showToast({
                title: errorMsg,
                icon: 'none',
                duration: 2000
              });
            });
        }
      }
    });
  },

  // ------------------------------------------------------------------
  // 🌟 核心：微信原生分享钩子（精确读取按钮上的 invite_token 凭证）
  // ------------------------------------------------------------------
  onShareAppMessage(opts?: WechatMiniprogram.Page.IShareAppMessageOption): WechatMiniprogram.Page.ICustomShareContent {
    // 默认通用分享
    let shareTitle = '邀请你加入我们的店铺管理';
    let sharePath = `/pages/invite-accept/index?shop_id=${this.data.shopId}`;

    // 如果是通过按钮点击触发的（即点击了列表里的某个“邀请”按钮）
    if (opts && opts.from === 'button' && opts.target) {
      const { token, staffName } = opts.target.dataset;

      // 🌟 拿到了对应员工的专属 Token
      if (token) {
        shareTitle = `诚邀【${staffName || '员工'}】完成店铺身份绑定`;
        sharePath = `/pages/invite-accept/index?token=${token}`;
      }
    }

    return {
      title: shareTitle,
      path: sharePath,
      imageUrl: '/assets/logo.png' // 微信分享卡片封面路径
    };
  }
});