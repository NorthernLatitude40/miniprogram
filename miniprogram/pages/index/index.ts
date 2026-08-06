// 1. 定义数据结构类型 (Interfaces)

// 结构化提取的数据类型（AI Agent 解析出的设备/单据信息）
interface ParsedDeviceData {
  model: string;      // 手机型号，如 iPhone 13 Pro
  cost: number;       // 成本价/进价
  notes?: string;     // 备注/成色描述，如 换过屏幕
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
  reply?: string;
  parsedData?: ParsedDeviceData;
}

// 2. 页面 Data 结构类型
interface PageData {
  stats: ShopStats;
  showAiChat: boolean;
  inputMsg: string;
  lastMsgId: string;
  messages: ChatMessage[];
}

// 3. 页面 Custom Methods 类型接口定义
interface PageCustomMethods {
  toggleAiChat: () => void;
  onInput: (e: WechatMiniprogram.Input) => void;
  sendToAgent: () => void;
  confirmAdd: (e: WechatMiniprogram.CustomEvent) => void;
}

// 4. 初始化 Page 实例
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
        content: '你好！我是你的手机店 AI 智能管家。你可以直接跟我说：“收了一台 iPhone 13 128G 成本 1800”',
      },
    ],
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

    // 追加用户输入的消息
    const newMsgs: ChatMessage[] = [
      ...this.data.messages,
      { role: 'user', content: text },
    ];

    this.setData({
      messages: newMsgs,
      inputMsg: '',
      lastMsgId: `msg-${newMsgs.length - 1}`,
    });

    // 请求本地 Python FastAPI 接口
    wx.request<AgentApiResponse>({
      url: 'http://127.0.0.1:8000/api/v1/shop/chat', // 后续启动的 Python FastAPI 地址
      method: 'POST',
      data: { message: text },
      success: (res) => {
        const rawReply = res.data.reply || '已收到指令';
        const parsedData = res.data.parsedData || null;
    
        // 打印后端返回的核心字段日志
        console.log('=== [DEBUG] 后端返回数据 ===');
        console.log('rawReply 类型:', typeof rawReply, '内容:', rawReply);
        console.log('parsedData 类型:', typeof parsedData, '内容:', parsedData);
        console.log('res.data 完整对象:', res.data);
    
        let reply = '';
    
        // 1. 如果 rawReply 是数组（处理类似 [{"type":"text", "text":"..."}] 的情况）
        if (Array.isArray(rawReply) && rawReply.length > 0) {
          // 提取数组中第一个元素的 text 字段
          reply = rawReply[0].text || rawReply[0].content || '已收到指令';
        } 
        // 2. 如果 rawReply 是普通字符串
        else if (typeof rawReply === 'string') {
          reply = rawReply;
        } 
        // 3. 如果 rawReply 是对象（非数组）
        else if (typeof rawReply === 'object' && rawReply !== null) {
          reply = (rawReply as any).text || (rawReply as any).content || JSON.stringify(rawReply);
        } 
        // 4. 兜底逻辑
        else if (parsedData && parsedData.model) {
          reply = `已为您识别并解析设备【${parsedData.model}】`;
        } else {
          reply = '已收到指令';
        }
    
        // 更新消息列表渲染到界面
        const updatedMsgs: ChatMessage[] = [
          ...this.data.messages,
          { role: 'assistant', content: reply, parsedData }
        ];
    
        this.setData({
          messages: updatedMsgs,
          inputMsg: '',
          // 让聊天界面自动滚动到最新一条消息
          lastMsgId: `msg-${updatedMsgs.length - 1}`
        });
      },
      fail: () => {
        // 后端未启动时的 Mock 调试效果，方便先看 UI 交互
        const mockReply: ChatMessage[] = [
          ...this.data.messages,
          {
            role: 'assistant',
            content: '【调试提示】Python 后端未连接。若接通，系统将自动识别并生成入库单。',
            parsedData: { model: 'iPhone 13 (演示数据)', cost: 1800, notes: '自动提取测试' },
          },
        ];
        this.setData({ messages: mockReply });
      },
    });
  },

  // 确认入库卡片点击事件
  confirmAdd(e: WechatMiniprogram.CustomEvent) {
    const info = e.currentTarget.dataset.info as ParsedDeviceData;
    if (info) {
      wx.showToast({
        title: `成功入库: ${info.model}`,
        icon: 'success',
      });
    }
  },
});