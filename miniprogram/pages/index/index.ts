// pages/index/index.ts
import { request } from '../../utils/request';

// 1. 在库设备条目接口 (扩充 UI 展字段)
interface StockItem {
  id: number | string;
  model: string;
  title?: string;
  spec?: string;
  cost: number;
  purchase_price?: number;
  stock_quantity?: number;
  sn_code?: string;
  display_name?: string;
}

interface ReportData {
  profit: number;
  income: number;
  expense: number;
  sales_count: number;
}

// 2. 解析出的卡片数据接口 (增加代词拦截字段)
interface ParsedDeviceData {
  type?: 'in' | 'out';
  action?: 'in' | 'sell' | 'query_stock' | 'query_report' | 'universal_query';
  model?: string;
  model_or_id?: string;
  sn_code?: string;
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
  // 代词防呆扩展字段
  is_pronoun?: boolean;
  selected_device?: StockItem | null;
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

interface DashboardOverviewData {
  today_profit: number;
  today_income: number;
  today_expense: number;
  in_stock_devices: number;
}

// 3. 页面 Data 接口
interface PageData {
  userRole: string;
  navHeight: number;
  stats: ShopStats;
  showMenu: boolean;
  inputMsg: string;
  lastMsgId: string;
  messages: ChatMessage[];
  stockList: StockItem[];
}

// 4. 页面 CustomMethods 接口 (补齐所有自定义函数类型)
interface PageCustomMethods {
  toggleMenu: () => void;
  onInput: (e: WechatMiniprogram.Input) => void;
  sendToAgent: (overrideText?: string) => void; // 🌟 支持传入外部文本参数
  confirmAdd: (e: WechatMiniprogram.CustomEvent) => void;
  confirmSell: (e: WechatMiniprogram.CustomEvent) => void;
  fetchDashboardStats: () => void;
  checkUserShopStatus: () => void;
  goToMy: () => void;
  fetchStockList: () => void;
  parseRobotMessage: (robotMsg: ChatMessage) => ChatMessage;
  onSelectStockDevice: (e: WechatMiniprogram.CustomEvent) => void;
  // 🌟 补充新方法类型声明
  showDevicePicker: (candidates: Array<any>) => void;
  onSelectDeviceClarify: (selectedDevice: any) => void;
}

// 🌟 核心修复：定义为动态 Getter 函数，避免顶层静态变量无法更新缓存的问题
const getCurrentShopId = (): string | number => {
  return wx.getStorageSync('shop_id') || wx.getStorageSync('current_shop_id') || 1;
};

const getCurrentUserRole = (): string => {
  return wx.getStorageSync('role') || 'staff';
};

Page<PageData, PageCustomMethods>({
  data: {
    userRole: 'staff',
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
        content: '你好！我是你的手机店 AI 智能管家。你可以跟我说：“收了一台 iPhone 13 成本 1800” 或 “查一下库存/今天赚了多少钱”。',
      },
    ],
    stockList: [],
  },

  onLoad() {
    const menuButton = wx.getMenuButtonBoundingClientRect();
    if (menuButton && menuButton.bottom) {
      this.setData({
        navHeight: menuButton.bottom + 8
      });
    }
    const token = wx.getStorageSync('token');
    if (token) {
      this.fetchStockList();
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

    const role = getCurrentUserRole();
    this.setData({ userRole: role });

    this.checkUserShopStatus();

    if (role === 'admin' || role === 'manager' || role === 'owner') {
      this.fetchDashboardStats();
    }
  },

  fetchStockList() {
    request<{ items?: StockItem[] }>({
      url: '/api/v1/shop/inventory/list?status=1',
      method: 'GET',
      header: {
        'X-Shop-Id': String(getCurrentShopId()),
        'X-User-Role': getCurrentUserRole(),
      },
    })
      .then((resData) => {
        if (resData && resData.items) {
          const formattedList: StockItem[] = resData.items.map((item) => ({
            ...item,
            display_name: `${item.title || item.model} ${item.spec ? '(' + item.spec + ')' : ''} - 成本￥${item.purchase_price || item.cost || 0}`
          }));
          this.setData({ stockList: formattedList });
        }
      })
      .catch((err) => {
        console.error('获取库存列表失败:', err);
      });
  },

  parseRobotMessage(robotMsg: ChatMessage): ChatMessage {
    const pronounBlacklist = ["刚才这台", "刚才那台", "上一台", "这台", "这个", "那台", "那个", "把它", "它", "上一台手机", "刚才这台机器", "UNKNOWN"];
    
    if (robotMsg.parsedData) {
      const rawModel = robotMsg.parsedData.model || robotMsg.parsedData.model_or_id || "";
      
      if (pronounBlacklist.includes(rawModel.trim())) {
        robotMsg.parsedData.is_pronoun = true;
        robotMsg.parsedData.selected_device = null;
        
        if (this.data.stockList.length === 1) {
          robotMsg.parsedData.selected_device = this.data.stockList[0];
          robotMsg.parsedData.model = this.data.stockList[0].title || this.data.stockList[0].model;
        }
      }
    }
    return robotMsg;
  },

  onSelectStockDevice(e: WechatMiniprogram.CustomEvent) {
    const msgIndex = e.currentTarget.dataset.msgIndex as number;
    const selectedIndex = Number(e.detail.value);
    const selectedDevice = this.data.stockList[selectedIndex];

    if (!selectedDevice) return;

    const updatedMessages = [...this.data.messages];
    const targetMsg = updatedMessages[msgIndex];

    if (targetMsg && targetMsg.parsedData) {
      targetMsg.parsedData.selected_device = selectedDevice;
      targetMsg.parsedData.model = selectedDevice.title || selectedDevice.model;
      targetMsg.parsedData.sn_code = selectedDevice.sn_code || '';

      this.setData({
        messages: updatedMessages
      });

      wx.showToast({
        title: '已关联设备',
        icon: 'success'
      });
    }
  },

  checkUserShopStatus() {
    request<{ id?: number | string }>({ url: '/api/v1/shops/current', method: 'GET' })
      .then((resData) => {
        if (!resData || !resData.id) {
          wx.redirectTo({
            url: '/pages/shop-edit/index?type=create'
          });
        } else {
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

  // 🌟 1. 多设备选择器 ActionSheet
  showDevicePicker(candidates: Array<any>) {
    if (!candidates || candidates.length === 0) return;

    const itemList = candidates.map((item) => {
      const id = item.id;
      const name = item.title || item.model || '未命名设备';
      const spec = item.color || item.spec || '规格未知';
      const cost = item.cost ? ` | 成本:¥${item.cost}` : '';
      return `[ID:${id}] ${name} (${spec}${cost})`;
    });

    wx.showActionSheet({
      title: '⚠️ 匹配到多台符合条件的设备，请选择：',
      itemList: itemList,
      success: (res) => {
        const selectedIndex = res.tapIndex;
        const selectedDevice = candidates[selectedIndex];

        wx.showToast({
          title: `已选择 ID: ${selectedDevice.id}`,
          icon: 'success',
          duration: 1500
        });

        this.onSelectDeviceClarify(selectedDevice);
      },
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) {
          console.error('ActionSheet 调起失败:', err);
        }
      }
    });
  },

  // 🌟 2. 澄清后的自动发送逻辑
  onSelectDeviceClarify(selectedDevice: any) {
    const clarifyText = `选 ID ${selectedDevice.id} 这台`;
    this.sendToAgent(clarifyText);
  },

  // 🌟 3. 发送消息逻辑（支持传入 overrideText 覆盖 inputMsg）
  sendToAgent(overrideText?: any) {
    let rawInput = '';
    
    if (typeof overrideText === 'string') {
      rawInput = overrideText;
    } else {
      rawInput = this.data.inputMsg || '';
    }

    const text = String(rawInput).trim();

    if (!text) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const currentMessages = this.data.messages || [];
    const messagesWithUser = [...currentMessages, userMsg];

    const isOverride = typeof overrideText === 'string';

    this.setData({
      messages: messagesWithUser,
      inputMsg: isOverride ? this.data.inputMsg : '', 
      lastMsgId: `msg-${messagesWithUser.length - 1}`,
    });

    wx.showLoading({
      title: 'AI 思考/处理中...',
      mask: true
    });

    const currentRole = getCurrentUserRole();
    const sessionId = wx.getStorageSync('session_id') || currentRole || `session_${Date.now()}`;

    request<AgentApiResponse>({
      url: '/api/v1/shop/chat',
      method: 'POST',
      header: {
        'X-Shop-Id': String(getCurrentShopId()),
        'X-User-Role': currentRole,
      },
      data: {
        message: text,
        session_id: sessionId
      }
    })
      .then((resData: any) => {
        // RFC 7807 拦截逻辑
        const problem = resData?.type ? resData : (resData?.parsedData?.type?.startsWith('urn:error:') ? resData.parsedData : null);

        if (problem && (problem.status >= 400 || problem.type?.startsWith('urn:error:'))) {
          const errorType = problem.type;
          const detailMsg = problem.detail || '请求处理异常';
          const candidates = problem.extensions?.candidates || problem.candidates || [];

          if (errorType === 'urn:error:multiple-devices-found') {
            if (typeof this.showDevicePicker === 'function' && candidates.length > 0) {
              this.showDevicePicker(candidates);
            } else {
              wx.showToast({ title: detailMsg, icon: 'none', duration: 3000 });
            }
          } else if (errorType === 'urn:error:device-not-found') {
            wx.showToast({ title: detailMsg, icon: 'none', duration: 2500 });
          } else {
            wx.showToast({ title: detailMsg, icon: 'none' });
          }

          if (resData?.reply) {
            let errorReplyMsg: ChatMessage = {
              role: 'assistant',
              content: typeof resData.reply === 'string' ? resData.reply : detailMsg,
              parsedData: null
            };
            const updatedMessages = [...messagesWithUser, errorReplyMsg];
            this.setData({
              messages: updatedMessages,
              lastMsgId: `msg-${updatedMessages.length - 1}`,
            });
          }

          return;
        }

        // 正常业务路径
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

        let assistantMsg: ChatMessage = { role: 'assistant', content: reply, parsedData };
        assistantMsg = this.parseRobotMessage(assistantMsg);

        const finalMessages = [...messagesWithUser, assistantMsg];

        this.setData({
          messages: finalMessages,
          lastMsgId: `msg-${finalMessages.length - 1}`,
        });

        if (currentRole === 'admin' || currentRole === 'manager') {
          this.fetchDashboardStats();
        }
      })
      .catch((err) => {
        let mockMsg: ChatMessage = {
          role: 'assistant',
          content: '【调试提示】Python 后端未连接。若接通，系统将自动识别并生成卡片。',
          parsedData: { type: 'in', action: 'in', model: 'iPhone 13 (演示数据)', cost: 1800, notes: '自动提取测试' },
        };
        
        mockMsg = this.parseRobotMessage(mockMsg);

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
          wx.showToast({ title: `成功入库: ${info.model || '设备'}`, icon: 'success' });
          if (typeof index === 'number') {
            this.setData({
              [`messages[${index}].isConfirmed`]: true
            });
          }
          
          this.fetchStockList();

          const currentRole = getCurrentUserRole();
          if (currentRole === 'admin' || currentRole === 'manager') {
            this.fetchDashboardStats();
          }
        })
        .catch((err: any) => {
          wx.showToast({ title: err?.detail || '入库失败，请重试', icon: 'none' });
        });
    }
  },

  confirmSell(e: WechatMiniprogram.CustomEvent) {
    const { info, index } = e.currentTarget.dataset as { info: ParsedDeviceData; index: number };
    
    if (typeof index === 'number' && this.data.messages[index]?.isConfirmed) {
      return;
    }

    if (info?.is_pronoun && !info.selected_device) {
      wx.showToast({
        title: '请先选择关联的库存设备',
        icon: 'none'
      });
      return;
    }

    if (info) {
      const finalModel = info.selected_device ? (info.selected_device.title || info.selected_device.model) : (info.model || info.model_or_id);
      const finalSnCode = info.selected_device ? (info.selected_device.sn_code || '') : (info.sn_code || '');

      request({
        url: '/api/v1/shop/device/sell',
        method: 'POST',
        data: {
          model: finalModel,
          sn_code: finalSnCode,
          price: info.price || info.sell_price || 0,
          notes: info.notes || '二手销售'
        }
      })
        .then(() => {
          wx.showToast({ title: `成功出售: ${finalModel || '设备'}`, icon: 'success' });
          if (typeof index === 'number') {
            this.setData({
              [`messages[${index}].isConfirmed`]: true
            });
          }

          this.fetchStockList();

          const currentRole = getCurrentUserRole();
          if (currentRole === 'admin' || currentRole === 'manager') {
            this.fetchDashboardStats();
          }
        })
        .catch((err: any) => {
          wx.showToast({ title: err?.detail || '出售失败', icon: 'none' });
        });
    }
  },
});