import { CalendarEvent, EventMap, CalendarDayNode } from './types';

Page({
  data: {
    selectedDate: new Date().getTime(),
    formatDate: null as unknown as (day: CalendarDayNode) => CalendarDayNode,
    
    // 当前选中的日期字符串
    selectedDateStr: '',
    // 当前选中日期的事件列表（用于底部展示）
    activeDayEvents: [] as CalendarEvent[],

    // 基于事件的数据源 (以 YYYY-MM-DD 为 Key)
    eventsData: {
      '2026-09-18': [
        { id: '1', title: '陈静-精致美妆', time: '13:00', type: 'primary' },
        { id: '2', title: '李伟-古法推拿', time: '14:00', type: 'warning' }
      ],
      '2026-09-20': [
        { id: '3', title: '王凯-中药洗头', time: '16:00', type: 'success' },
        { id: '4', title: '张丽-头皮排毒', time: '18:00', type: 'danger' }
      ]
    } as EventMap
  },

  onLoad() {
    this.setData({
      formatDate: this.formatDate.bind(this)
    });
    // 默认触发今天的事件加载
    this.updateActiveDayEvents(new Date());
  },

  /**
   * 格式化日历单元格：根据事件数量设置角标与样式
   */
  formatDate(day: CalendarDayNode): CalendarDayNode {
    const { date } = day;
    const dateStr = this.formatDateToString(date);
    const events = this.data.eventsData[dateStr] || [];

    if (events.length > 0) {
      // 1. 设置后缀显示事件数量
      day.suffix = `${events.length}个日程`;
      
      // 2. 如果当天有紧急/特殊类型的事件，可动态加上 Class
      const hasDanger = events.some(e => e.type === 'danger');
      day.className = hasDanger ? 'day-has-danger' : 'day-has-event';
    }

    return day;
  },

  /**
   * 切换月份面板时触发
   */
  onPanelChange(e: WechatMiniprogram.CustomEvent<{ year: number; month: number }>) {
    const { year, month } = e.detail;
    console.log(`载入 ${year} 年 ${month} 月的事件数据...`);
    // TODO: 从服务端拉取该月份的 EventMap 数据并 setData({ eventsData })
  },

  /**
   * 点击选择某一天的事件处理
   */
  onSelectDate(e: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const { value } = e.detail;
    const selectedDate = new Date(value);
    
    this.updateActiveDayEvents(selectedDate);
  },

  /**
   * 更新当前选中日期的事件列表
   */
  updateActiveDayEvents(date: Date) {
    const dateStr = this.formatDateToString(date);
    const events = this.data.eventsData[dateStr] || [];

    this.setData({
      selectedDateStr: dateStr,
      activeDayEvents: events
    });
  },

  /**
   * 工具函数：Date 转 YYYY-MM-DD
   */
  formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 点击具体事件跳转到天视图时间轴或详情页
   */
  onEventTap(e: WechatMiniprogram.TouchEvent) {
    const { eventId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/day-board/day-board?date=${this.data.selectedDateStr}&eventId=${eventId}`
    });
  }
});