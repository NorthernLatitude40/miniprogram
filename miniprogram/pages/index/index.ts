// ===========================================================
// 1. 定义数据结构类型 (Interfaces)
// ===========================================================

// 库存列表项数据类型
interface StockItem {
  id: number | string;
  model: string;
  spec?: string;
  cost: number;
  stock_quantity?: number;
}

// 经营报表数据类型
interface ReportData {
  profit: number;
  income: number;
  expense: number;
  sales_count: number;
}

// 结构化提取的数据类型（AI Agent 解析出的通用数据结构，支持入库、出售、报表、库存查询）
interface ParsedDeviceData {
  // 动作类型区分
  type?: 'in' | 'out';
  action?: 'in' | 'sell' | 'query_stock' | 'query_report';

  // 入库 / 出售字段
  model?: string;
  model_or_id?: string;
  cost?: number;
  cost_price?: number;
  price?: number;
  sell_price?: number;
  notes?: string;

  // 📊 报表卡片专属字段
  time_range_text?: string;
  report?: ReportData;

  // 🔍 库存卡片专属字段
  keyword?: string;
  total_count?: number;
  items?: StockItem[];
}

// 聊天消息项类型
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  parsedData?: ParsedDeviceData | null;
}

// 统计数据类型
interface ShopStats {
  profit: number;
  income: number;
  expense: number;
  stockCount: number;
}

// 后端 API 返回的数据接口定义
interface AgentApiResponse {
  reply?: any;
  parsedData?: ParsedDeviceData;
}

// 接口响应类型 (针对 dashboard/overview)
interface OverviewApiResponse {
  code: number;
  data: {
    today_profit: number;
    today_income: number;
    today_expense: number;
    in_stock_devices: number;
  };
}

// ===========================================================
// 2. 页面 Data 结构类型
// ===========================================================
interface PageData {
  stats: ShopStats;
  showAiChat: boolean;
  inputMsg: string;
  lastMsgId: string;
  messages: ChatMessage[];
}

// ===========================================================
// 3. 页面 Custom Methods 类型接口定义
// ===========================================================
interface PageCustomMethods {
  toggleAiChat: () => void;
  onInput: (e: WechatMiniprogram.Input) => void;
  sendToAgent: () => void;
  confirmAdd: (e: WechatMiniprogram.CustomEvent) => void;
  confirmSell: (e: WechatMiniprogram.CustomEvent) => void;
  fetchDashboardStats: () => void; // 刷新看板统计数据
}

// ===========================================================
// 4. 初始化 Page 实例
// ===========================================================
Page<PageData, PageCustomMethods>({
  data: {
    stats: {
      profit: 0,
      income: 0,
      expense: 0,
      stockCount: 0,
    },
    showAiChat: true,
    inputMsg: '',
    lastMsgId: '',
    messages: [
      {
        role: 'assistant',
        content: '你好！我是你的手机店 AI 智能管家。你可以跟我说：“收了一台 iPhone 13 成本 1800” 或 “查一下库存/今天赚了多少钱”。',
      },
    ],
  },

  // 🌟 1. 微信小程序生命周期：页面显示时触发
  onShow() {
    this.fetchDashboardStats(); // 每次打开/回到页面时自动刷新数据看板
  },

  // 🌟 2. 封装获取看板数据的核心函数
  fetchDashboardStats() {
    wx.request<OverviewApiResponse>({
      url: 'http://127.0.0.1:8000/api/v1/dashboard/overview',
      method: 'GET',
      success: (res) => {
        if (res.data && res.data.data) {
          const d = res.data.data;
          this.setData({
            stats: {
              profit: d.today_profit,
              income: d.today_income,
              expense: d.today_expense,
              stockCount: d.in_stock_devices, // 更新看板上的在库设备台数
            },
          });
        }
      },
      fail: (err) => {
        console.error('获取看板数据失败:', err);
      },
    });
  },

  // 展开/收起 AI 聊天框
  toggleAiChat() {
    this.setData({ showAiChat: !this.data.showAiChat });
  },

  // 监听输入框变化
  onInput(e: WechatMiniprogram.Input) {
    this.setData({ inputMsg: e.detail.value });
  },

  // 🚀 核心：发送指令给本地 Python AI Agent 后端
  sendToAgent() {
    const text = this.data.inputMsg.trim();
    if (!text) return;

    // 1. 生成包含用户当前输入的新消息列表
    const userMsg: ChatMessage = { role: 'user', content: text };
    const messagesWithUser = [...this.data.messages, userMsg];

    // 立即更新 UI 显示用户刚发出的消息，并清空输入框
    this.setData({
      messages: messagesWithUser,
      inputMsg: '',
      lastMsgId: `msg-${messagesWithUser.length - 1}`,
    });

    // 开启全屏遮罩加载
    wx.showLoading({
      title: 'AI 思考/处理中...',
      mask: true // 遮罩防止用户重复点击
    });

    // 2. 请求本地 Python FastAPI 接口
    wx.request<AgentApiResponse>({
      url: 'http://127.0.0.1:8000/api/v1/shop/chat', // Python FastAPI 地址
      method: 'POST',
      timeout: 120000, // 支持 2 分钟超时，应对 LLM 切换重试
      data: { message: text },
      success: (res) => {
        let rawReply = res.data.reply || '已收到指令';
        let parsedData: ParsedDeviceData | null = res.data.parsedData || null;

        // 🌟 容错处理：如果 reply 本身是个 JSON 格式字符串，自动二次解析它
        if (typeof rawReply === 'string') {
          try {
            const cleanJsonStr = rawReply.replace(/```json\s*|\s*```/g, '').trim();
            if (cleanJsonStr.startsWith('{') && cleanJsonStr.endsWith('}')) {
              const parsedJson = JSON.parse(cleanJsonStr);
              if (parsedJson.reply) rawReply = parsedJson.reply;
              if (parsedJson.parsedData) parsedData = parsedJson.parsedData;
            }
          } catch (e) {
            // 解析失败保留原文本
          }
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

        // 刷新看板数据
        this.fetchDashboardStats();
      },
      fail: () => {
        // 后端未启动时的 Mock 调试效果
        const mockMsg: ChatMessage = {
          role: 'assistant',
          content: '【调试提示】Python 后端未连接。若接通，系统将自动识别并生成卡片。',
          parsedData: { type: 'in', action: 'in', model: 'iPhone 13 (演示数据)', cost: 1800, notes: '自动提取测试' },
        };

        const finalMessages = [...messagesWithUser, mockMsg];

        this.setData({
          messages: finalMessages,
          lastMsgId: `msg-${finalMessages.length - 1}`,
        });
      },
      complete: () => {
        // 🌟 无论成功或失败，都必须统一隐藏 Loading 提示框！
        wx.hideLoading();
      }
    });
  },

  // 📦 确认入库卡片点击事件
  confirmAdd(e: WechatMiniprogram.CustomEvent) {
    const info = e.currentTarget.dataset.info as ParsedDeviceData;
    if (info) {
      wx.request({
        url: 'http://127.0.0.1:8000/api/v1/shop/device/add',
        method: 'POST',
        data: {
          model: info.model || info.model_or_id,
          cost: info.cost || info.cost_price,
          notes: info.notes || ''
        },
        success: (res: any) => {
          if (res.statusCode === 200) {
            wx.showToast({
              title: `成功入库: ${info.model || '设备'}`,
              icon: 'success',
            });
            this.fetchDashboardStats();
          } else {
            wx.showToast({ title: '入库失败，请重试', icon: 'none' });
          }
        },
        fail: () => {
          wx.showToast({ title: '请求失败，请检查网络/后端', icon: 'none' });
        }
      });
    }
  },

  // 💰 确认出售点击事件
  confirmSell(e: WechatMiniprogram.CustomEvent) {
    const info = e.currentTarget.dataset.info as ParsedDeviceData;
    if (info) {
      wx.request({
        url: 'http://127.0.0.1:8000/api/v1/shop/device/sell',
        method: 'POST',
        data: {
          model: info.model || info.model_or_id,
          price: info.price || info.sell_price || 0,
          notes: info.notes || ''
        },
        success: (res: any) => {
          if (res.statusCode === 200) {
            wx.showToast({
              title: `成功出售: ${info.model || '设备'}`,
              icon: 'success',
            });
            this.fetchDashboardStats();
          } else {
            wx.showToast({ title: res.data?.detail || '出售失败', icon: 'none' });
          }
        },
        fail: () => {
          wx.showToast({ title: '出售提交失败', icon: 'none' });
        }
      });
    }
  },
});