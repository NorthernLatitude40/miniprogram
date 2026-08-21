// pages/index/index.ts
import { request } from '../../utils/request';
import { fetchDashboardStats } from '../../utils/user';
import { i18nBehavior, t } from '../../utils/i18n/i18n';

// 1. 在庫設備條目接口 (擴充 UI 展示欄位)
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

// 2. 解析出的卡片數據接口 (增加代詞攔截欄位)
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
  // 代詞防呆擴展欄位
  is_pronoun?: boolean;
  selected_device?: StockItem | null;
  supplier_name?: string;
  supplier_phone?: string;
  product_type?: number
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

// 3. 頁面 Data 接口
interface PageData {
  shopName: string;
  userRole: string;
  navHeight: number;
  stats: ShopStats;
  showMenu: boolean;
  inputMsg: string;
  lastMsgId: string;
  messages: ChatMessage[];
  stockList: StockItem[];
  statusBarHeight?: number;
  menuTop?: number;
  menuHeight?: number;
  navBarHeight?: number;
}

// 4. 頁面 CustomMethods 接口
interface PageCustomMethods {
  toggleMenu: () => void;
  onInput: (e: WechatMiniprogram.Input) => void;
  sendToAgent: (overrideText?: string) => void;
  confirmAdd: (e: WechatMiniprogram.CustomEvent) => void;
  confirmSell: (e: WechatMiniprogram.CustomEvent) => void;
  checkUserShopStatus: () => void;
  goToMy: () => void;
  fetchStockList: () => void;
  loadDashboardStats: () => void; // 🌟 補全看板統計加載方法
  parseRobotMessage: (robotMsg: ChatMessage) => ChatMessage;
  onSelectStockDevice: (e: WechatMiniprogram.CustomEvent) => void;
  showDevicePicker: (candidates: Array<any>) => void;
  onSelectDeviceClarify: (selectedDevice: any) => void;
  goToBusinessPage: () => void;
  // 多語言 Behavior 方法
  getLanguage: () => string;
  setLanguage: (lang: string) => void;
  updateLanguage: () => void;
  tFormat: (key: any, params?: Record<string, string>) => string;
  initWelcomeMessage: () => void;
}

// 核心修復：定義為動態 Getter 函數，避免頂層靜態變量無法更新快取的問題
const getCurrentShopId = (): string | number => {
  return wx.getStorageSync('shop_id') || wx.getStorageSync('current_shop_id') || 1;
};

const getCurrentUserRole = (): string => {
  return wx.getStorageSync('role') || 'staff';
};

Page<PageData, PageCustomMethods>({
  behaviors: [i18nBehavior],

  data: {
    shopName: 'ONTO 品牌旗艦店',
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
    messages: [] as ChatMessage[],
    stockList: [],
  },

  onLoad() {
    // 獲取系統狀態欄高度
    const sysInfo = wx.getSystemInfoSync();
    const statusBarHeight = sysInfo.statusBarHeight || 20;

    // 獲取膠囊按鈕位置
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const menuTop = menuButton.top || statusBarHeight + 6;
    const menuHeight = menuButton.height || 32;

    // 計算導航欄總高度（避讓佔位用）
    const navBarHeight = menuButton.bottom ? (menuButton.bottom + (menuTop - statusBarHeight)) : (statusBarHeight + 44);

    this.initWelcomeMessage();

    this.setData({
      statusBarHeight: statusBarHeight,
      menuTop: menuTop,
      menuHeight: menuHeight,
      navBarHeight: navBarHeight,
      navHeight: menuButton.bottom ? menuButton.bottom + 8 : 88
    });

    const token = wx.getStorageSync('token');
    if (token) {
      this.fetchStockList();
    }
  },

  onShow() {
    // 1. 自動刷新多語言數據
    this.updateLanguage();

    // 2. 若消息列表為空，初始化歡迎語（支持多語言）
    if (!this.data.messages || this.data.messages.length === 0) {
      this.setData({
        messages: [
          {
            role: 'assistant',
            content: (this.data as any).t?.welcome_chat_tip || '你好！我是你的手機店 AI 智能管家。你可以跟我說：“收了一台 iPhone 13 成本 1800” 或 “查一下庫存/今天賺了多少錢”。',
          },
        ]
      });
    }

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

    // 🌟 加載看板統計數據並給 stats 賦值
    this.loadDashboardStats();
  },

  // 初始化 AI 歡迎語
  initWelcomeMessage() {
    const welcomeMsg: ChatMessage = {
      role: 'assistant',
      // 🌟 直接從多語言字典取出文字，或提供預設值
      content: t('welcome_chat_tip') || '你好！我是 AI 店務助手，請輸入開單或查帳指令。'
    };

    this.setData({
      messages: [welcomeMsg]
    });
  },

  // 🌟 切換語言時的響應（如果你的項目支援運行時切換語言）
  onLanguageChange() {
    // 重新載入多語言文字，更新 UI
    this.initWelcomeMessage();
  },

  // 🌟 核心賦值方法：獲取看板數據並更新 setData({ stats })
  async loadDashboardStats() {
    const role = getCurrentUserRole();
    if (role === 'admin' || role === 'manager' || role === 'owner') {
      try {
        const res: any = await fetchDashboardStats();
        if (res) {
          // 支援兩種數據結構的容錯映射 (Direct object or res.data)
          const data = res.data || res;
          this.setData({
            stats: {
              profit: data.profit || data.net_profit || 0,
              income: data.income || data.total_revenue || 0,
              expense: data.expense || data.total_expense || 0,
              stockCount: data.stockCount || data.stock_count || data.total_stock || 0
            }
          });
        }
      } catch (err) {
        console.error('更新 stats 統計數據失敗:', err);
      }
    }
  },

  fetchStockList() {
    request<{ items?: StockItem[] }>({
      url: '/api/v1/inventories/list?status=1',
      method: 'GET',
      header: {
        'X-Shop-Id': String(getCurrentShopId()),
        'X-User-Role': getCurrentUserRole(),
      },
    })
      .then((resData) => {
        if (resData && resData.items) {
          const costText = (this.data as any).t?.cost || '成本';
          const formattedList: StockItem[] = resData.items.map((item) => ({
            ...item,
            display_name: `${item.title || item.model} ${item.spec ? '(' + item.spec + ')' : ''} - ${costText}￥${item.purchase_price || item.cost || 0}`
          }));
          this.setData({ stockList: formattedList });
        }
      })
      .catch((err) => {
        console.error('獲取庫存列表失敗:', err);
      });
  },

  parseRobotMessage(robotMsg: ChatMessage): ChatMessage {
    const pronounBlacklist = ["剛才這台", "剛才那台", "上一台", "這台", "這個", "那台", "那個", "把它", "它", "上一台手機", "剛才這台機器", "UNKNOWN"];

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
        title: (this.data as any).t?.device_linked || '已關聯設備',
        icon: 'success'
      });
    }
  },

  checkUserShopStatus() {
    request<{ id?: number | string; name?: string }>({ url: '/api/v1/shops/current', method: 'GET' })
      .then((resData) => {
        if (!resData || !resData.id) {
          wx.redirectTo({
            url: '/pages/shop-edit/index?type=create'
          });
        } else {
          wx.setStorageSync('current_shop_id', resData.id);
          
          if (resData.name) {
            this.setData({
              shopName: resData.name
            });
            wx.setStorageSync('current_shop_name', resData.name);
          }
        }
      })
      .catch((err: any) => {
        console.error('獲取店鋪狀態失敗:', err);
      });
  },

  toggleMenu() {
    this.setData({ showMenu: !this.data.showMenu });
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ inputMsg: e.detail.value });
  },

  // 多設備選擇器 ActionSheet
  showDevicePicker(candidates: Array<any>) {
    if (!candidates || candidates.length === 0) return;

    const costLabel = (this.data as any).t?.cost || '成本';
    const unknownSpec = (this.data as any).t?.unknown_spec || '規格未知';
    const unnamedDevice = (this.data as any).t?.unnamed_device || '未命名設備';

    const itemList = candidates.map((item) => {
      const id = item.id;
      const name = item.title || item.model || unnamedDevice;
      const spec = item.color || item.spec || unknownSpec;
      const cost = item.cost ? ` | ${costLabel}:¥${item.cost}` : '';
      return `[ID:${id}] ${name} (${spec}${cost})`;
    });

    wx.showActionSheet({
      title: (this.data as any).t?.multiple_devices_found || '⚠️ 匹配到多台符合條件的設備，請選擇：',
      itemList: itemList,
      success: (res) => {
        const selectedIndex = res.tapIndex;
        const selectedDevice = candidates[selectedIndex];

        wx.showToast({
          title: `ID: ${selectedDevice.id}`,
          icon: 'success',
          duration: 1500
        });

        this.onSelectDeviceClarify(selectedDevice);
      },
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) {
          console.error('ActionSheet 調起失敗:', err);
        }
      }
    });
  },

  // 澄清後的自動發送邏輯
  onSelectDeviceClarify(selectedDevice: any) {
    const clarifyText = this.tFormat('select_device_clarify', { id: selectedDevice.id }) || `選 ID ${selectedDevice.id} 這台`;
    this.sendToAgent(clarifyText);
  },

  // 1. 接收組件傳上來的文字
  onSendMessage(e: WechatMiniprogram.CustomEvent<{ text: string }>) {
    const text = e.detail.text;
    if (text) {
      // 2. 調用原本完整的 API sendToAgent
      this.sendToAgent(text);
    }
  },

  // 發送消息邏輯（支持傳入 overrideText 覆蓋 inputMsg）
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
      title: (this.data as any).t?.ai_thinking || 'AI 思考/處理中...',
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
        // RFC 7807 攔截邏輯
        const problem = resData?.type ? resData : (resData?.parsedData?.type?.startsWith('urn:error:') ? resData.parsedData : null);

        if (problem && (problem.status >= 400 || problem.type?.startsWith('urn:error:'))) {
          const errorType = problem.type;
          const detailMsg = problem.detail || (this.data as any).t?.request_failed || '請求處理異常';
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

        // 正常業務路徑
        const defaultReceivedText = (this.data as any).t?.received_command || '已收到指令';
        let rawReply = resData?.reply || defaultReceivedText;
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
          reply = rawReply[0].text || rawReply[0].content || defaultReceivedText;
        } else if (typeof rawReply === 'string') {
          reply = rawReply;
        } else if (typeof rawReply === 'object' && rawReply !== null) {
          reply = (rawReply as any).text || (rawReply as any).content || JSON.stringify(rawReply);
        } else {
          reply = defaultReceivedText;
        }

        let assistantMsg: ChatMessage = { role: 'assistant', content: reply, parsedData };
        assistantMsg = this.parseRobotMessage(assistantMsg);

        const finalMessages = [...messagesWithUser, assistantMsg];

        this.setData({
          messages: finalMessages,
          lastMsgId: `msg-${finalMessages.length - 1}`,
        });

        // 🌟 對話結束後刷新看板數據
        this.loadDashboardStats();
      })
      .catch((err) => {
        let mockMsg: ChatMessage = {
          role: 'assistant',
          content: (this.data as any).t?.debug_tip || '【調試提示】Python 後端未連接。若接通，系統將自動識別並生成卡片。',
          parsedData: { type: 'in', action: 'in', model: 'iPhone 13 (演示數據)', cost: 1800, notes: '自動提取測試' },
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
        console.error('跳轉到“我的”頁面失敗：', err);
      }
    });
  },

  confirmAdd(e: WechatMiniprogram.CustomEvent) {
    const { info, index } = e.detail as { info: ParsedDeviceData; index: number };
    if (typeof index === 'number' && this.data.messages[index]?.isConfirmed) {
      return;
    }

    if (info) {
      request({
        url: '/api/v1/inventories/device/add',
        method: 'POST',
        data: {
          supplier_name: info.supplier_name,
          supplier_phone: info.supplier_phone,
          items:[{
            type: info.product_type,
            model_name: info.model || info.model_or_id,
            cost_price: info.cost || info.cost_price,
            notes: info.notes || '',
          }]
        }
      })
      .then(() => {
        // 2. 判斷 tFormat 是否存在，不存在則降級使用默認文案，避免 TypeError
        const modelName = info.model || (this.data as any).t?.device || '設備';
        const successMsg = typeof this.tFormat === 'function' 
          ? this.tFormat('stock_in_success', { model: modelName })
          : `成功入庫 ${modelName}`;

        wx.showToast({ title: successMsg, icon: 'success' });

        // 3. 安全更新單條 Message 狀態
        if (typeof index === 'number' && index >= 0) {
          this.setData({
            [`messages[${index}].isConfirmed`]: true
          });
        }

        // 4. 安全調用刷新方法
        if (typeof this.fetchStockList === 'function') {
          this.fetchStockList();
        }

        if (typeof this.loadDashboardStats === 'function') {
          this.loadDashboardStats();
        }
      })
      .catch((err: any) => {
        console.error('入庫失敗詳情:', err);
        const failMsg = err?.detail || (this.data as any).t?.stock_in_failed || '入庫失敗，請重試';
        wx.showToast({ title: failMsg, icon: 'none' });
      });
    }
  },

  confirmSell(e: WechatMiniprogram.CustomEvent) {
    console.log('3[AI-CARD] 點擊了出售按鈕，當前 info:', e.detail);
    const { info, index } = e.detail as { info: ParsedDeviceData; index: number };

    if (typeof index === 'number' && this.data.messages[index]?.isConfirmed) {
      return;
    }

    if (info?.is_pronoun && !info.selected_device) {
      wx.showToast({
        title: (this.data as any).t?.select_stock_device_first || '請先選擇關聯的庫存設備',
        icon: 'none'
      });
      return;
    }

    if (info) {
      const finalModel = info.selected_device ? (info.selected_device.title || info.selected_device.model) : (info.model || info.model_or_id);
      const finalSnCode = info.selected_device ? (info.selected_device.sn_code || '') : (info.sn_code || '');

      request({
        url: '/api/v1/inventories/device/sell',
        method: 'POST',
        data: {
          model: finalModel,
          sn_code: finalSnCode,
          price: info.price || info.sell_price || 0,
          notes: info.notes || '二手銷售'
        }
      })
      .then(() => {
        // 3. 安全獲取成功文案（防止 tFormat 函數未找到導致 TypeError）
        const modelName = finalModel || (this.data as any).t?.device || '設備';
        const successMsg = typeof this.tFormat === 'function'
          ? this.tFormat('sell_success', { model: modelName })
          : `已成功出售 ${modelName}`;

        wx.showToast({ title: successMsg, icon: 'success' });

        // 4. 安全更新 UI 卡片確認狀態
        if (typeof index === 'number' && index >= 0) {
          this.setData({
            [`messages[${index}].isConfirmed`]: true
          });
        }

        // 5. 安全調用列表與看板刷新函數
        if (typeof this.fetchStockList === 'function') {
          this.fetchStockList();
        }

        if (typeof this.loadDashboardStats === 'function') {
          this.loadDashboardStats();
        }
      })
      .catch((err: any) => {
        console.error('出售失敗詳情:', err);
        const failMsg = err?.detail || (this.data as any).t?.sell_failed || '出售失敗';
        wx.showToast({ title: failMsg, icon: 'none' });
      });
    }
  },

  goToBusinessPage() {
    wx.navigateTo({
      url: '/pages/business/index'
    });
  },
});