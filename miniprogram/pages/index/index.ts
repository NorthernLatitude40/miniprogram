// pages/index/index.ts
import { request } from '../../utils/request';

// 🌟 徹底擺脫舊版 TS 對於全域 API 及 String 方法的限制
declare const JSON: any;
declare const Array: any;
declare const String: any;

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

interface OverviewApiResponse {
  code: number;
  data: {
    today_profit: number;
    today_income: number;
    today_expense: number;
    in_stock_devices: number;
  };
}

interface PageData {
  navHeight: number;
  stats: ShopStats;
  showMenu: boolean;
  inputMsg: string;
  lastMsgId: string;
  messages: ChatMessage[];
}

interface PageCustomMethods {
  toggleMenu: () => void;
  onInput: (e: WechatMiniprogram.Input) => void;
  sendToAgent: () => void;
  confirmAdd: (e: WechatMiniprogram.CustomEvent) => void;
  confirmSell: (e: WechatMiniprogram.CustomEvent) => void;
  fetchDashboardStats: () => void;
  checkUserShopStatus: () => void;
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

    // 如果是店员，可以跳过财务看板接口调用，或展示简版数据
    if (role === 'admin' || role === 'manager') {

      this.fetchDashboardStats();
    }
    
  },

  checkUserShopStatus() {
    request({ url: '/api/v1/shop/current', method: 'GET' }).then((res: any) => {
      // 如果返回数据提示没有绑定店铺，强行引导去开店页
      if (!res.data || !res.data.id) {
        wx.redirectTo({
          url: '/pages/shop-edit/index?type=create'
        });
      } else {
        // 已有店铺，将 shop_id 写入缓存供全局 API 使用
        wx.setStorageSync('current_shop_id', res.data.id);
      }
    });
  },

  fetchDashboardStats() {
    request({
      url: '/api/v1/dashboard/overview',
      method: 'GET'
    }).then((res: any) => {
      const resData = res as OverviewApiResponse;
      if (resData && resData.data) {
        const d = resData.data;
        this.setData({
          stats: {
            profit: d.today_profit,
            income: d.today_income,
            expense: d.today_expense,
            stockCount: d.in_stock_devices,
          },
        });
      }
    }).catch((err: any) => {
      if (err?.status === 403) {
        wx.showToast({ title: '无权查看财务概览', icon: 'none' });
      }
    });
  },

  toggleMenu() {
    const selfData = this.data as any;
    this.setData({ showMenu: !selfData.showMenu });
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ inputMsg: e.detail.value });
  },

  /**
   * 🌟 向 AI 发送对话指令（补全了参数类型注解 : any）
   */
  sendToAgent() {
    const selfData = this.data as any;
    const rawInput = selfData.inputMsg || '';
    const text = (rawInput as any).trim ? (rawInput as any).trim() : String(rawInput);

    if (!text) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const currentMessages = selfData.messages || [];
    const messagesWithUser = [...currentMessages, userMsg];
    const userMsgLen = (messagesWithUser as any).length;

    this.setData({
      messages: messagesWithUser,
      inputMsg: '',
      lastMsgId: `msg-${userMsgLen - 1}`,
    });

    wx.showLoading({
      title: 'AI 思考/處理中...',
      mask: true
    });

    request<AgentApiResponse>({
      url: '/api/v1/shop/chat',
      method: 'POST',
      data: { message: text }
    }).then((resData: any) => {
      let rawReply = resData.reply || '已收到指令';
      let parsedData: ParsedDeviceData | null = resData.parsedData || null;

      if (typeof rawReply === 'string') {
        try {
          const str = rawReply as any;
          const cleanJsonStr = str.replace(/```json\s*|\s*```/g, '').trim();
          if (cleanJsonStr.startsWith('{') && cleanJsonStr.endsWith('}')) {
            const parsedJson = JSON.parse(cleanJsonStr);
            if (parsedJson.reply) rawReply = parsedJson.reply;
            if (parsedJson.parsedData) parsedData = parsedJson.parsedData;
          }
        } catch (e) {}
      }

      let reply = '';
      if (Array.isArray(rawReply) && (rawReply as any).length > 0) {
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
      const finalLen = (finalMessages as any).length;

      this.setData({
        messages: finalMessages,
        lastMsgId: `msg-${finalLen - 1}`,
      });

      this.fetchDashboardStats();
    }).catch(() => {
      const mockMsg: ChatMessage = {
        role: 'assistant',
        content: '【調試提示】Python 後端未連接。若接通，系統將自動識別並生成卡片。',
        parsedData: { type: 'in', action: 'in', model: 'iPhone 13 (演示數據)', cost: 1800, notes: '自動提取測試' },
      };

      const finalMessages = [...messagesWithUser, mockMsg];
      const finalLen = (finalMessages as any).length;

      this.setData({
        messages: finalMessages,
        lastMsgId: `msg-${finalLen - 1}`,
      });
    }).finally(() => {
      wx.hideLoading();
    });
  },

  /**
   * 跳转至“我的”页面
   */
  goToMy(): void {
    wx.navigateTo({
      url: '/pages/my/index', // 👈 你的“我的”页面路径
      fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
        console.error('跳转到“我的”页面失败：', err);
      }
    });
  },

  /**
   * 🌟 确认入库卡片（补全了参数类型注解 : any）
   */
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
      }).then(() => {
        wx.showToast({ title: `成功入庫: ${info.model || '設備'}`, icon: 'success' });
        if (typeof index === 'number') {
          this.setData({
            [`messages[${index}].isConfirmed`]: true
          });
        }
        this.fetchDashboardStats();
      }).catch((err: any) => {
        wx.showToast({ title: err?.detail || '入庫失敗，請重試', icon: 'none' });
      });
    }
  },

  /**
   * 🌟 确认出售卡片（补全了参数类型注解 : any）
   */
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
      }).then(() => {
        wx.showToast({ title: `成功出售: ${info.model || '設備'}`, icon: 'success' });
        if (typeof index === 'number') {
          this.setData({
            [`messages[${index}].isConfirmed`]: true
          });
        }
        this.fetchDashboardStats();
      }).catch((err: any) => {
        wx.showToast({ title: err?.detail || '出售失敗', icon: 'none' });
      });
    }
  },
});