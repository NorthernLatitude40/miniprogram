// 1. 定义单条事件的数据结构
export interface CalendarEvent {
  id: string;
  title: string;        // 事件/预约名称（如：李伟-推拿）
  time?: string;         // 时间段（如：14:00）
  type?: 'primary' | 'warning' | 'danger' | 'success'; // 事件紧急/类型状态
}

// 2. 按日期（YYYY-MM-DD）归类的事件字典
export type EventMap = Record<string, CalendarEvent[]>;

// 3. TDesign 日历单元格节点类型
export interface CalendarDayNode {
  date: Date;
  day: number;
  type: string;
  prefix?: string;
  suffix?: string;
  className?: string;
}