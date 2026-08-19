// pages/business/index.ts
// @ts-ignore
const echarts = require('../../components/ec-canvas/echarts');
import { fetchDashboardStats } from '../../utils/user';
import { request } from '../../utils/request'; // 請確保引入您的 request 工具函數
import { i18nBehavior } from '../../utils/i18n/i18n';
const zh_CN = require('../../utils/i18n/locales/zh_CN');
const zh_HK = require('../../utils/i18n/locales/zh_HK');
const en = require('../../utils/i18n/locales/en');
const ja = require('../../utils/i18n/locales/ja');

Page({
  behaviors: [i18nBehavior],

  data: {
    statusBarHeight: 20,
    menuHeight: 32,
    navBarHeight: 88,
    shopName: 'ONTO 品牌旗艦店', // 預設名稱

    timeRangeOptions: [] as string[],
    selectedTimeIndex: 0,
    stats: {
      profitLabel: '',
      incomeLabel: '',
      expenseLabel: '',
      orderCountLabel: '',
      profit: 0,
      income: 0,
      expense: 0,
      orderCount: 0
    },

    ec: {
      lazyLoad: true
    }
  },

  chartInstance: null as any,
  lastTrendData: [] as any[],

  // i18nBehavior 觸發語言切換時的回呼
  onLanguageChange() {
    this.updateLanguage();
  },

  onLoad() {
    this.initNavBar();
    // 1. 優先獲取並更新店鋪資訊
    this.fetchCurrentShopInfo();

    // 2. 確保 behavior 資料寫入完成後刷新語言與數據
    wx.nextTick(() => {
      this.updateLanguage();
      this.loadReportData(this.data.selectedTimeIndex);
    });
  },

  onShow() {
    this.updateLanguage();
  },

  // 獲取當前店鋪資訊並更新 shopName
  fetchCurrentShopInfo() {
    // 優先從本地快取讀取，提升頁面加載速度
    const cachedShopName = wx.getStorageSync('current_shop_name');
    if (cachedShopName) {
      this.setData({ shopName: cachedShopName });
    }

    // 發送請求獲取最新店鋪名稱
    request<{ id?: number | string; name?: string }>({ url: '/api/v1/shops/current', method: 'GET' })
      .then((resData) => {
        if (resData && resData.name) {
          this.setData({
            shopName: resData.name
          });
          wx.setStorageSync('current_shop_name', resData.name);
          if (resData.id) {
            wx.setStorageSync('current_shop_id', resData.id);
          }
        }
      })
      .catch((err: any) => {
        console.error('Business 頁面獲取店鋪狀態失敗:', err);
      });
  },

  onUnload() {
    if (this.chartInstance) {
      try {
        this.chartInstance.off();
        this.chartInstance.clear();
        this.chartInstance.dispose();
      } catch (e) {
        console.warn('ECharts dispose 避讓正常警告:', e);
      }
      this.chartInstance = null;
    }
  },

  onPullDownRefresh() {
    this.fetchCurrentShopInfo();
    this.loadReportData(this.data.selectedTimeIndex, () => {
      wx.stopPullDownRefresh();
    });
  },

  // 安全獲取當前字典包
  getLangDict() {
    const currentLang = wx.getStorageSync('user_language') || 'zh_CN';
    const dict_cn = zh_CN.default || zh_CN;
    const dict_hk = zh_HK.default || zh_HK;
    const dict_en = en.default || en;
    const dict_ja = ja.default || ja;

    const dictMap: Record<string, any> = {
      'zh_CN': dict_cn,
      'zh-CN': dict_cn,
      'zh_HK': dict_hk,
      'zh-HK': dict_hk,
      'zh_TW': dict_hk,
      'zh-TW': dict_hk,
      'en': dict_en,
      'en_US': dict_en,
      'en-US': dict_en,
      'ja': dict_ja
    };

    const targetDict = dictMap[currentLang] || dict_hk || dict_cn || {};
    this.setData({ t: targetDict });
    return targetDict;
  },

  updateLanguage() {
    const langDict = this.getLangDict();
    const timeRangeOptions = [
      langDict.today_overview || '今日概覽',
      langDict.last_7_days_report || '近7天報表',
      langDict.this_month_report || '本月報表'
    ];

    this.setData({ timeRangeOptions });
    this.updateStatLabels(this.data.selectedTimeIndex);

    if (this.lastTrendData && this.lastTrendData.length > 0) {
      this.renderChart(this.lastTrendData);
    }
  },

  updateStatLabels(index: number) {
    const langDict = this.getLangDict();
    const labelMap = [
      {
        profit: langDict.today_gross_profit || '今日毛利',
        income: langDict.today_income || '今日收入',
        expense: langDict.today_expense || '今日支出',
        order: langDict.today_order_count || '今日成交'
      },
      {
        profit: langDict.days_7_profit || '7天毛利',
        income: langDict.days_7_income || '7天總收入',
        expense: langDict.days_7_expense || '7天總支出',
        order: langDict.days_7_order || '7天成交'
      },
      {
        profit: langDict.month_profit || '本月毛利',
        income: langDict.month_income || '本月總收入',
        expense: langDict.month_expense || '本月總支出',
        order: langDict.month_order || '本月成交'
      }
    ];

    const currentLabels = labelMap[index] || labelMap[0];

    this.setData({
      'stats.profitLabel': currentLabels.profit,
      'stats.incomeLabel': currentLabels.income,
      'stats.expenseLabel': currentLabels.expense,
      'stats.orderCountLabel': currentLabels.order
    });
  },

  initNavBar() {
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const menuButton = wx.getMenuButtonBoundingClientRect();

      const statusBarHeight = windowInfo.statusBarHeight || 20;
      const menuTop = menuButton.top || statusBarHeight + 6;
      const menuHeight = menuButton.height || 32;

      const navBarHeight = menuButton.bottom
        ? menuButton.bottom + (menuTop - statusBarHeight)
        : statusBarHeight + 44;

      this.setData({
        statusBarHeight,
        menuHeight,
        navBarHeight
      });
    } catch (e) {
      console.error('獲取系統導覽列尺寸失敗:', e);
    }
  },

  onTimeRangeChange(e: any) {
    const index = parseInt(e.detail.value, 10);
    this.setData({ selectedTimeIndex: index });
    this.loadReportData(index);
  },

  loadReportData(index: number, callback?: () => void) {
    const rangeMap = ['today', '7days', 'month'];
    const currentRange = rangeMap[index] || 'today';

    this.updateStatLabels(index);

    wx.showLoading({ title: (this.getLangDict().loading || '載入中...'), mask: true });

    fetchDashboardStats(currentRange)
      .then((res: any) => {
        this.setData({
          'stats.profit': res?.profit || 0,
          'stats.income': res?.income || 0,
          'stats.expense': res?.expense || 0,
          'stats.orderCount': res?.orderCount || 0
        });

        if (res && Array.isArray(res.trend)) {
          this.lastTrendData = res.trend;
          this.renderChart(res.trend);
        }
      })
      .catch((err: any) => {
        console.error('[DEBUG] ❌ 接口請求報錯:', err);
      })
      .finally(() => {
        wx.hideLoading();
        if (typeof callback === 'function') {
          callback();
        }
      });
  },

  renderChart(trendData: Array<{ date: string; income: number; expense: number; profit: number }>) {
    wx.nextTick(() => {
      setTimeout(() => {
        const component = this.selectComponent('#dashboard-chart-canvas') as any;
        if (!component) return;

        const langDict = this.getLangDict();
        const dates = trendData.map((item) => item.date || '');
        const incomes = trendData.map((item) => item.income || 0);
        const expenses = trendData.map((item) => item.expense || 0);
        const profits = trendData.map((item) => item.profit || 0);

        const incomeLegend = langDict.legend_income || '收入';
        const expenseLegend = langDict.legend_expense || '支出';
        const profitLegend = langDict.legend_profit || '毛利';

        const option = {
          tooltip: { trigger: 'axis', confine: true },
          legend: {
            data: [incomeLegend, expenseLegend, profitLegend],
            bottom: 0,
            textStyle: { fontSize: 10, color: '#6B7280' }
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '18%',
            top: '12%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: dates,
            axisLine: { lineStyle: { color: '#E5E7EB' } },
            axisLabel: { color: '#9CA3AF', fontSize: 10, interval: 'auto' }
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } },
            axisLabel: { color: '#9CA3AF', fontSize: 10 }
          },
          series: [
            { name: incomeLegend, type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, data: incomes, itemStyle: { color: '#10B981' } },
            { name: expenseLegend, type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, data: expenses, itemStyle: { color: '#EF4444' } },
            { name: profitLegend, type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, data: profits, itemStyle: { color: '#3B82F6' } }
          ]
        };

        if (this.chartInstance) {
          this.chartInstance.setOption(option, true);
        } else {
          component.init((canvas: any, width: number, height: number, dpr: number) => {
            if (!canvas) {
              console.warn('[ECharts] 獲取 Canvas 實例失敗，節點尚未掛載');
              return;
            }
            const chart = echarts.init(canvas, null, {
              width: width,
              height: height,
              devicePixelRatio: dpr
            });
            canvas.setChart(chart);
            chart.setOption(option);
            this.chartInstance = chart;
            return chart;
          });
        }
      }, 200);
    });
  },

  backToAI() {
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({ url: '/pages/ai/index' });
      }
    });
  },
  goToPurchase() {
    wx.navigateTo({ url: '/pages/purchase/list/index' });
  },
  goToSales() {
    wx.navigateTo({ url: '/pages/sale/list/index' });
  },
  goToNewStock() {
    wx.navigateTo({ url: '/pages/inventory/list/index?type=new' });
  },
  goToUsedStock() {
    wx.navigateTo({ url: '/pages/inventory/list/index?type=used' });
  },
  goToMy() {
    wx.navigateTo({ url: '/pages/my/index' });
  },
  goToSearch() {
    wx.navigateTo({ url: '/pages/search/index' });
  },
  scanIMEI() {
    wx.scanCode({
      scanType: ['barCode', 'qrCode'],
      success: (res) => {
        const codeValue = res.result;
        if (codeValue) {
          wx.navigateTo({
            url: `/pages/search/index?keyword=${encodeURIComponent(codeValue)}`
          });
        }
      },
      fail: (err: any) => {
        if (err.errMsg !== 'scanCode:fail cancel') {
          wx.showToast({ title: (this.getLangDict().scan_failed || '掃碼失敗'), icon: 'none' });
        }
      }
    });
  }
});