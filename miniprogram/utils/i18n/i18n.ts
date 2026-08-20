// miniprogram/utils/i18n/i18n.ts

// 1. 直接引入 .ts 語言模組（避免微信小程序 JSON 打包異常）
import zh_CN from './locales/zh_CN';
import zh_HK from './locales/zh_HK';
import en from './locales/en';
import ja from './locales/ja';

// 2. 字典映射表
export const translations: Record<string, Record<string, string>> = {
  zh_CN,
  zh_HK,
  en,
  ja
};

// 3. 獲取當前語言
export function getAppLanguage(): string {
  const savedLang = wx.getStorageSync('user_language');
  if (savedLang) return savedLang;

  const sysInfo = wx.getSystemInfoSync();
  const sysLang = (sysInfo.language || '').toLowerCase();

  if (sysLang.includes('hk') || sysLang.includes('tw')) return 'zh_HK';
  if (sysLang.includes('ja')) return 'ja';
  if (sysLang.includes('en')) return 'en';
  return 'zh_CN';
}

// 4. 全局 t() 翻譯函數（三級兜底機制：當前語言 -> 簡體中文 -> 原始Key）
export function t(key: string): string {
  const activeLang = getAppLanguage();
  
  if (translations[activeLang]?.[key]) {
    return translations[activeLang][key];
  }
  if (translations['zh_CN']?.[key]) {
    return translations['zh_CN'][key];
  }
  return key;
}

// 5. 小程序 Behavior 封裝
export const i18nBehavior = Behavior({
  data: {
    t: {} as Record<string, string>,
    currentLangSetting: 'system'
  },
  methods: {
    updateLanguage() {
      const activeLang = getAppLanguage();
      const savedSetting = wx.getStorageSync('user_language') || 'system';
      
      this.setData({
        t: translations[activeLang] || translations['zh_CN'],
        currentLangSetting: savedSetting
      });
    },
    setAppLanguage(lang: string) {
      if (lang === 'system') {
        wx.removeStorageSync('user_language');
      } else {
        wx.setStorageSync('user_language', lang);
      }
      this.updateLanguage();
    }
  }
});

// 6. 獲取當前語言對應的完整字典物件
export function getLangDict(): Record<string, string> {
  const activeLang = getAppLanguage();
  return translations[activeLang] || translations['zh_CN'];
}