import { request } from '../../utils/request';

export {}; // 隔绝全局作用域

interface StaffItem {
  id: string;
  name: string;
  isCreator: boolean;
  roleName?: string;
  phone?: string;
  isActive?: boolean;
}

interface IPageData {
  statusBarHeight: number;
  navBarHeight: number;
  menuTop: number;
  menuHeight: number;
  staffList: StaffItem[];
  shopId: string;
  // 用于分享的临时凭证与名字
  shareToken: string;
  shareName: string;
}

interface IPageCustom {
  fetchStaffList: () => void;
  prepareInviteToken: (staffList: any[]) => void;
  goBack: () => void;
  onTapStaff: (e: WechatMiniprogram.TouchEvent) => void;
  onAddStaff: () => void;
  onShareAppMessage: (opts?: WechatMiniprogram.Page.IShareAppMessageOption) => WechatMiniprogram.Page.ICustomShareContent;
}

Page<IPageData, IPageCustom>({
  data: {
    statusBarHeight: 20,
    navBarHeight: 88,
    menuTop: 40,
    menuHeight: 32,
    staffList: [],
    shopId: '',
    shareToken: '',
    shareName: ''
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

    // 3. 拉取员工列表
    this.fetchStaffList();
  },

  // 查询当前店铺下的所有员工
  fetchStaffList(): void {
    wx.showLoading({ title: '加载中...' });

    request({
      url: `/api/v1/shop/staff/list`,
      method: 'GET',
      data: { shopId: this.data.shopId }
    }).then((res: any) => {
      wx.hideLoading();
      const list = res?.data || res || [];
      this.setData({ staffList: list });

      // 🌟 核心：列表加载完后，静默预生成“未激活员工”的 Token！
      this.prepareInviteToken(list);
    }).catch((err: any) => {
      wx.hideLoading();
      console.error('获取员工列表失败:', err);
      // 测试 Mock 降级
      this.setData({
        staffList: [
          { id: '1', name: '超级管理员', isCreator: true, roleName: '创建人' }
        ]
      });
    });
  },

  // 🌟 提前准备 Token 的私有函数（用户点“邀请”按钮前就已经准备好）
  prepareInviteToken(staffList: any[]): void {
    // 兼容后端返回的 is_active 或 isActive 字段
    const pendingStaff = staffList.find((item: any) => item.is_active === false || item.isActive === false);
    if (!pendingStaff) {
      // 如果没有待激活的员工，清空旧 token
      this.setData({ shareToken: '', shareName: '' });
      return;
    }

    request({
      url: '/api/v1/shop/staff/generate-invite',
      method: 'POST',
      data: { 
        shopId: this.data.shopId,
        user_id: pendingStaff.id 
      }
    }).then((res: any) => {
      // 提前赋值到 data，为原生分享做准备
      this.setData({
        shareToken: res.data.invite_token,
        shareName: res.data.staff_name || pendingStaff.name || '新员工'
      });
    }).catch((err) => {
      console.error('预生成邀请Token失败:', err);
    });
  },

  goBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  onTapStaff(e: WechatMiniprogram.TouchEvent): void {
    const item = e.currentTarget.dataset.item;
    console.log('点击员工：', item);
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

          // 调用后端：创建员工档案 (遵循 Bare Payload + RFC 7807 规范)
          request({
            url: '/api/v1/shop/staff/create',
            method: 'POST',
            data: {
              nickname: staffName,
              role: 'staff' // 默认员工角色
            }
          })
            .then(() => {
              wx.showToast({ title: '档案创建成功', icon: 'success' });
              // 刷新列表（刷新后会自动触发 prepareInviteToken 准备新员工的 Token）
              this.fetchStaffList();
            })
            .catch((err: any) => {
              // 💡 符合 RFC 7807 标准：错误体字段固定为 err.detail 或 err.title
              const errorMsg = err?.detail || err?.title || '创建失败，请稍后再试';
              wx.hideLoading();
              wx.showToast({
                title: errorMsg,
                icon: 'none',
                duration: 2000
              });
            })
            .finally(() => {

            });
        }
      }
    });
  },

  // ------------------------------------------------------------------
  // 微信原生分享钩子（用户点击 open-type="share" 按钮时自动调用）
  // ------------------------------------------------------------------
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const token = this.data.shareToken;
    const name = this.data.shareName;

    // 如果还没有生成 Token（比如没有待邀请员工）
    if (!token) {
      wx.showToast({
        title: '暂无待邀请的员工档案',
        icon: 'none'
      });
    }

    return {
      title: token ? `诚邀【${name}】加入我们的店铺` : '邀请你加入我们的店铺管理',
      path: `/pages/invite-accept/index?token=${token || ''}`,
      imageUrl: '/assets/logo.png'
    };
  }
});