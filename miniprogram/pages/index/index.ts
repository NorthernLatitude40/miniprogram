// pages/index/index.ts
import { request } from '../../utils/request';

interface StockItem {
  id: number | string;
  model: string;
  spec?: string;
  cost: number;
  stock_quantity?: number;
}

interface ReportData {
  profit: number;
  income: number;
  expense: number;
  sales_count: number;
}

interface ParsedDeviceData {
  type?: 'in' | 'out';
  action?: 'in' | 'sell' | 'query_stock' | 'query_report';
  model?: string;
  model_or_id?: string;
  cost?: number;
  cost_price?: number;
  price?: number;
  sell_price?: number;
  notes?: string;
  time_range_text?: string;
  report?: ReportData;
  keyword?: string;
  total_count?: number;
  items?: StockItem[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  parsedData?: ParsedDeviceData | null;
  isConfirmed?: boolean;
}

interface ShopStats {
  profit: number;
  income: number;
  expense: number;
  stockCount: number;
}

interface AgentApiResponse {
  reply?: any;
  parsedData?: ParsedDeviceData;
}

// 1. 裸响应数据类型定义 (Bare Payload)
interface DashboardOverviewData {
  today_profit: number;
  today_income: number;
  today_expense: number;
  in_stock_devices: number;
}

// 2. 页面 Data 接口 (补齐 userRole 解决 ts2769 报错)
interface PageData {
  userRole: string;
  navHeight: number;
  stats: ShopStats;
  showMenu: boolean;
  inputMsg: string;
  lastMsgId: string;
  messages: ChatMessage[];
}

// 3. 页面 CustomMethods 接口 (补齐 goToMy 解决自定义方法报错)
interface PageCustomMethods {
  toggleMenu: () => void;
  onInput: (e: WechatMiniprogram.Input) => void;
  sendToAgent: () => void;
  confirmAdd: (e: WechatMiniprogram.CustomEvent) => void;
  confirmSell: (e: WechatMiniprogram.CustomEvent) => void;
  fetchDashboardStats: () => void;
  checkUserShopStatus: () => void;
  goToMy: () => void;
}

Page<PageData, PageCustomMethods>({
  data: {
    userRole: 'staff', // 默认角色
    navHeight: 88,
    stats: {
      profit: 0,
      income: 0,
      expense: 0,
      stockCount: 0,
    },
    showMenu: false,
    inputMsg: '',
    lastMsgId: '',
    messages: [
      {
        role: 'assistant',
        content: '你好！我是你的手機店 AI 智能管家。你可以跟我說：“收了一台 iPhone 13 成本 1800” 或 “查一下庫存/今天賺了多少錢”。',
      },
    ],
  },

  onLoad() {
    const menuButton = wx.getMenuButtonBoundingClientRect();
    if (menuButton && menuButton.bottom) {
      this.setData({
        navHeight: menuButton.bottom + 8
      });
    }
  },

  onShow() {
    const token = wx.getStorageSync('token');

    if (!token) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }

    const role = wx.getStorageSync('role') || 'staff';
    this.setData({ userRole: role });

    this.checkUserShopStatus();

    // 如果是管理员/经理，加载财务概览
    if (role === 'admin' || role === 'manager') {
      this.fetchDashboardStats();
    }
  },

  checkUserShopStatus() {
    request<{ id?: number | string }>({ url: '/api/v1/shop/current', method: 'GET' })
      .then((resData) => {
        // Bare Payload 模式下，resData 直接为店铺实体
        if (!resData || !resData.id) {
          wx.redirectTo({
            url: '/pages/shop-edit/index?type=create'
          });
        } else {
          // 已有店铺，将 shop_id 写入缓存供全局 API 使用
          wx.setStorageSync('current_shop_id', resData.id);
        }
      })
      .catch((err: any) => {
        console.error('获取店铺状态失败:', err);
      });
  },

  fetchDashboardStats() {
    request<DashboardOverviewData>({
      url: '/api/v1/dashboard/overview',
      method: 'GET'
    })
      .then((data) => {
        if (data) {
          this.setData({
            stats: {
              profit: data.today_profit,
              income: data.today_income,
              expense: data.today_expense,
              stockCount: data.in_stock_devices,
            },
          });
        }
      })
      .catch((err: any) => {
        // 💡 匹配 RFC 7807 错误格式
        if (err?.status === 403) {
          wx.showToast({
            title: err.detail || '无权查看财务概览',
            icon: 'none'
          });
        } else if (err?.detail) {
          wx.showToast({ title: err.detail, icon: 'none' });
        }
      });
  },

  toggleMenu() {
    this.setData({ showMenu: !this.data.showMenu });
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ inputMsg: e.detail.value });
  },

  sendToAgent() {
    const rawInput = this.data.inputMsg || '';
    const text = rawInput.trim();
  
    if (!text) return;
  
    const userMsg: ChatMessage = { role: 'user', content: text };
    const currentMessages = this.data.messages || [];
    const messagesWithUser = [...currentMessages, userMsg];
  
    this.setData({
      messages: messagesWithUser,
      inputMsg: '',
      lastMsgId: `msg-${messagesWithUser.length - 1}`,
    });
  
    wx.showLoading({
      title: 'AI 思考/處理中...',
      mask: true
    });
  
    // 🌟 1. 从本地缓存获取 currentShopId、role 和 sessionId
    const currentShopId = wx.getStorageSync('shop_id') || wx.getStorageSync('current_shop_id') || 1;
    const role = wx.getStorageSync('role') || 'staff';
    const sessionId = wx.getStorageSync('session_id') || wx.getStorageSync('role') || `session_${Date.now()}`;
  
    request<AgentApiResponse>({
      url: '/api/v1/shop/chat',
      method: 'POST',
      // 🌟 2. 在 Header 中透传 X-Shop-Id 和 X-User-Role 供后端 FastAPI 拦截解析
      header: {
        'X-Shop-Id': String(currentShopId),
        'X-User-Role': role,
      },
      // 🌟 3. 在 Body 中额外携带 session_id
      data: { 
        message: text,
        session_id: sessionId
      }
    })
      .then((resData) => {
        let rawReply = resData?.reply || '已收到指令';
        let parsedData: ParsedDeviceData | null = resData?.parsedData || null;
  
        if (typeof rawReply === 'string') {
          try {
            const cleanJsonStr = rawReply.replace(/```json\s*|\s*```/g, '').trim();
            if (cleanJsonStr.startsWith('{') && cleanJsonStr.endsWith('}')) {
              const parsedJson = JSON.parse(cleanJsonStr);
              if (parsedJson.reply) rawReply = parsedJson.reply;
              if (parsedJson.parsedData) parsedData = parsedJson.parsedData;
            }
          } catch (e) {}
        }
  
        let reply = '';
        if (Array.isArray(rawReply) && rawReply.length > 0) {
          reply = rawReply[0].text || rawReply[0].content || '已收到指令';
        } else if (typeof rawReply === 'string') {
          reply = rawReply;
        } else if (typeof rawReply === 'object' && rawReply !== null) {
          reply = (rawReply as any).text || (rawReply as any).content || JSON.stringify(rawReply);
        } else {
          reply = '已收到指令';
        }
  
        const assistantMsg: ChatMessage = { role: 'assistant', content: reply, parsedData };
        const finalMessages = [...messagesWithUser, assistantMsg];
  
        this.setData({
          messages: finalMessages,
          lastMsgId: `msg-${finalMessages.length - 1}`,
        });
  
        // 如果是管理员/经理，加载财务概览
        if (role === 'admin' || role === 'manager') {
          this.fetchDashboardStats();
        }
      })
      .catch(() => {
        const mockMsg: ChatMessage = {
          role: 'assistant',
          content: '【調試提示】Python 後端未連接。若接通，系統將自動識別並生成卡片。',
          parsedData: { type: 'in', action: 'in', model: 'iPhone 13 (演示數據)', cost: 1800, notes: '自動提取測試' },
        };
  
        const finalMessages = [...messagesWithUser, mockMsg];
  
        this.setData({
          messages: finalMessages,
          lastMsgId: `msg-${finalMessages.length - 1}`,
        });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  goToMy(): void {
    wx.navigateTo({
      url: '/pages/my/index',
      fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
        console.error('跳转到“我的”页面失败：', err);
      }
    });
  },

  confirmAdd(e: WechatMiniprogram.CustomEvent) {
    const { info, index } = e.currentTarget.dataset as { info: ParsedDeviceData; index: number };
    if (typeof index === 'number' && this.data.messages[index]?.isConfirmed) {
      return;
    }

    if (info) {
      request({
        url: '/api/v1/shop/device/add',
        method: 'POST',
        data: {
          model: info.model || info.model_or_id,
          cost: info.cost || info.cost_price,
          notes: info.notes || ''
        }
      })
        .then(() => {
          wx.showToast({ title: `成功入庫: ${info.model || '設備'}`, icon: 'success' });
          if (typeof index === 'number') {
            this.setData({
              [`messages[${index}].isConfirmed`]: true
            });
          }
          const role = wx.getStorageSync('role') || 'staff';
          // 如果是管理员/经理，加载财务概览
          if (role === 'admin' || role === 'manager') {
            this.fetchDashboardStats();
          }
        })
        .catch((err: any) => {
          wx.showToast({ title: err?.detail || '入庫失敗，請重試', icon: 'none' });
        });
    }
  },

  confirmSell(e: WechatMiniprogram.CustomEvent) {
    const { info, index } = e.currentTarget.dataset as { info: ParsedDeviceData; index: number };
    if (typeof index === 'number' && this.data.messages[index]?.isConfirmed) {
      return;
    }

    if (info) {
      request({
        url: '/api/v1/shop/device/sell',
        method: 'POST',
        data: {
          model: info.model || info.model_or_id,
          price: info.price || info.sell_price || 0,
          notes: info.notes || ''
        }
      })
        .then(() => {
          wx.showToast({ title: `成功出售: ${info.model || '設備'}`, icon: 'success' });
          if (typeof index === 'number') {
            this.setData({
              [`messages[${index}].isConfirmed`]: true
            });
          }
          const role = wx.getStorageSync('role') || 'staff';
          // 如果是管理员/经理，加载财务概览
          if (role === 'admin' || role === 'manager') {
            this.fetchDashboardStats();
          }
        })
        .catch((err: any) => {
          wx.showToast({ title: err?.detail || '出售失敗', icon: 'none' });
        });
    }
  },
});