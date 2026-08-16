import { request, formatErrorMessage } from '../../utils/request';

export {};

interface StaffDetail {
  id: string;
  name: string;
  role?: string;
  roleName?: string;
  status: number; // 0: 待認領, 1: 正常在職, 2: 已離職/禁用
  isCreator?: boolean;
  invite_token?: string;
}

// 角色地圖與選項定義
const ROLE_OPTIONS = ['店長', '店員'];
const ROLE_MAP: Record<string, string> = {
  '店長': 'manager',
  '店員': 'staff'
};
const ROLE_NAME_MAP: Record<string, string> = {
  'owner': '店主',
  'manager': '店長',
  'staff': '店員'
};
const role = wx.getStorageSync('role') || 'staff';
const currentShopId = wx.getStorageSync('shop_id') || wx.getStorageSync('current_shop_id') || 1;

Page({
  data: {
    // 導航欄與系統佈局參數
    statusBarHeight: 20,
    navBarHeight: 88,
    menuTop: 40,
    menuHeight: 32,

    // 當前登錄用戶的角色 (owner | manager | staff)，實際開發中可從 App 全局或 Storage 讀取
    currentUserRole: 'manager', 

    // 業務數據
    shopId: '',
    staffInfo: null as StaffDetail | null
  },

  onLoad(options: Record<string, string>): void {
    // 1. 動態計算導航欄與膠囊按鈕對齊參數
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const systemInfo = wx.getSystemInfoSync();
    
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height + statusBarHeight;

    this.setData({
      statusBarHeight,
      navBarHeight,
      menuTop: menuButton.top,
      menuHeight: menuButton.height
    });

    // 2. 解析頁面傳參
    const { shopId, staffData } = options;

    if (shopId && staffData) {
      try {
        const staffInfo: StaffDetail = JSON.parse(decodeURIComponent(staffData));
        
        // 補充顯示用角色名稱
        if (staffInfo.role && !staffInfo.roleName) {
          staffInfo.roleName = ROLE_NAME_MAP[staffInfo.role] || '店員';
        }

        this.setData({
          shopId,
          staffInfo
        });
      } catch (e) {
        wx.showToast({ title: '數據解析失敗', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
      }
    } else {
      wx.showToast({ title: '參數錯誤', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // ------------------------------------------------------------------
  // 返回上一頁
  // ------------------------------------------------------------------
  goBack(): void {
    wx.navigateBack({ delta: 1 });
  },


  // ------------------------------------------------------------------
  // 1. 編輯員工姓名 / 備註 (統一使用 PUT)
  // ------------------------------------------------------------------
  onEditName(): void {
    const staff = this.data.staffInfo;
    // 校验员工对象及其 ID 是否存在
    if (!staff || !staff.id) {
      wx.showToast({ title: '员工信息异常', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '修改員工姓名',
      editable: true,
      placeholderText: '請輸入新的姓名/備註',
      content: staff.name,
      success: (res) => {
        if (res.confirm && res.content) {
          const newName = res.content.trim();
          if (!newName) {
            wx.showToast({ title: '姓名不能為空', icon: 'none' });
            return;
          }

          // 🌟 将 id、role 和 name 统一放入 data (请求体)
          request({
            url: '/api/v1/shop/staffs',
            method: 'PUT',
            loadingText: '保存中...',
            data: {
              id: staff.id,      // 员工 ID
              name: newName      // 新姓名
            }
          })
            .then(() => {
              wx.showToast({ title: '修改成功', icon: 'success' });
              
              // 更新本地頁面數據
              this.setData({
                'staffInfo.name': newName
              });
            })
            .catch((err: any) => {
              if (!err?.isSilent) {
                const errorMsg = formatErrorMessage(err);
                wx.showToast({ title: errorMsg, icon: 'none' });
              }
            });
        }
      }
    });
  },

  // ------------------------------------------------------------------
  // 2. 修改角色權限 (僅 Owner / Manager 可操作)
  // ------------------------------------------------------------------
  onEditRole(): void {
    const staff = this.data.staffInfo;
    const { currentUserRole } = this.data;

    if (!staff) return;

    // 前端第一層保護：非 owner/manager 不可點擊修改
    if (currentUserRole !== 'owner' && currentUserRole !== 'manager') {
      wx.showToast({ title: '暫無權限修改角色', icon: 'none' });
      return;
    }

    // 防護：不能修改創建者 (店主) 的角色
    if (staff.isCreator || staff.role === 'owner') {
      wx.showToast({ title: '無法修改店主角色', icon: 'none' });
      return;
    }

    // 彈出操作選單選擇角色
    wx.showActionSheet({
      itemList: ROLE_OPTIONS,
      success: (res) => {
        const selectedLabel = ROLE_OPTIONS[res.tapIndex];
        const selectedRoleValue = ROLE_MAP[selectedLabel];

        // 若無改變則直接返回
        if (selectedRoleValue === staff.role) return;

        wx.showLoading({ title: '修改中...' });

        // 對接統一的 PUT 接口
        request({
          url: `/api/v1/shop/staffs`,
          method: 'PUT',
          header: {
            'X-Shop-Id': String(currentShopId),
            'X-User-Role': role,
          },
          data: { 
            id: staff.id,      // 员工 ID
            role: selectedRoleValue
           }
        })
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: '角色修改成功', icon: 'success' });

            // 更新本地數據
            this.setData({
              'staffInfo.role': selectedRoleValue,
              'staffInfo.roleName': selectedLabel
            });
          })
          .catch((err: any) => {
            wx.hideLoading();
            const errorMsg = err?.detail || '修改失敗';
            wx.showToast({ title: errorMsg, icon: 'none' });
          });
      }
    });
  },

  // ------------------------------------------------------------------
  // 3. 禁用 / 啟用員工 (已改為統一的 PUT 接口，不再調用 /status)
  // ------------------------------------------------------------------
  onToggleStatus(): void {
    const staff = this.data.staffInfo;
    if (!staff) return;

    // 邏輯保護：待認領 (0) 狀態不允許切換禁用
    if (staff.status === 0) {
      wx.showToast({ title: '待認領狀態無法切換禁用', icon: 'none' });
      return;
    }

    const isCurrentlyDisabled = staff.status === 2;
    const targetStatus = isCurrentlyDisabled ? 1 : 2; // 1: 正常, 2: 禁用
    const actionText = isCurrentlyDisabled ? '啟用' : '禁用';

    wx.showModal({
      title: '操作確認',
      content: `確定要${actionText}員工「${staff.name}」嗎？${!isCurrentlyDisabled ? '禁用後該員工將無法登錄或操作店鋪。' : ''}`,
      confirmColor: isCurrentlyDisabled ? '#1677FF' : '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: `${actionText}中...` });

          // 🌟 核心調整：改用統一的 PUT 接口，不調用子路由 /status
          request({
            url: `/api/v1/shop/staffs`,
            method: 'PUT',
            header: {
              'X-Shop-Id': String(currentShopId),
              'X-User-Role': role,
            },
            data: { 
              id: staff.id,      // 员工 ID
              status: targetStatus 
            }
          })
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: `${actionText}成功`, icon: 'success' });
              
              // 更新本地頁面數據
              this.setData({
                'staffInfo.status': targetStatus
              });
            })
            .catch((err: any) => {
              wx.hideLoading();
              const errorMsg = err?.detail || `${actionText}失敗`;
              wx.showToast({ title: errorMsg, icon: 'none' });
            });
        }
      }
    });
  },

  // ------------------------------------------------------------------
  // 4. 頁面分享（用於待認領狀態下的邀請）
  // ------------------------------------------------------------------
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const staff = this.data.staffInfo;
    let shareTitle = '邀請你加入店鋪';
    let sharePath = `/pages/invite-accept/index?shop_id=${this.data.shopId}`;

    if (staff && staff.invite_token) {
      shareTitle = `誠邀【${staff.name || '員工'}】完成店鋪身份綁定`;
      sharePath = `/pages/invite-accept/index?token=${staff.invite_token}`;
    }

    return {
      title: shareTitle,
      path: sharePath
    };
  }
});