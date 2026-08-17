const fs = require('fs');
const path = require('path');

const TARGET_LANGS = ['zh_CN', 'zh_HK', 'en', 'ja'];

let s2t, t2s;
try {
  const chineseS2T = require('chinese-s2t');
  s2t = chineseS2T.s2t;
  t2s = chineseS2T.t2s;
} catch (e) {
  s2t = (str) => str;
  t2s = (str) => str;
}

function isEnglish(str) {
  return /^[a-zA-Z0-9\s\-_.,!?'"()]+$/.test(str.trim());
}

module.exports = {
  input: [
    'miniprogram/**/*.{ts,js,wxml}',
    '!miniprogram/utils/i18n/**',
    '!node_modules/**'
  ],
  output: './',
  options: {
    debug: false,
    lngs: TARGET_LANGS,
    defaultLng: 'zh_CN',
    // 👇 讓 scanner 讀取與儲存標準的 .json 檔，避開內部 JSON.parse 報錯
    resource: {
      loadPath: 'miniprogram/utils/i18n/locales/{{lng}}.json',
      savePath: 'miniprogram/utils/i18n/locales/{{lng}}.json',
      jsonIndent: 2
    },
    nsSeparator: false,
    keySeparator: false,

    defaultValue: function(lng, ns, key, options) {
      const rawValue = options.defaultValue || '';

      if (isEnglish(rawValue)) {
        if (lng === 'en') return rawValue;
        return '';
      }

      if (lng === 'zh_CN') return t2s(rawValue);
      if (lng === 'zh_HK') return s2t(rawValue);

      return '';
    }
  },

  transform: function customTransform(file, enc, done) {
    const parser = this.parser;
    const content = fs.readFileSync(file.path, enc);
    const ext = file.extname;

    if (ext === '.wxml') {
      const regex = /t\.([a-zA-Z0-9_]+)\s*\|\|\s*['"]([^'"]+)['"]/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        parser.set(match[1], { defaultValue: match[2] });
      }
    } else if (ext === '.ts' || ext === '.js') {
      parser.parseFuncFromString(content, { list: ['t', 'i18n.t'] });
    }

    done();
  },

  // 👇 掃描完畢後，除了生成 .json，額外自動轉印出 .ts 檔給小程序 import
  flush: function (done) {
    const parser = this.parser;
    const resStore = parser.get();

    TARGET_LANGS.forEach((lng) => {
      const jsonPath = path.join(__dirname, `miniprogram/utils/i18n/locales/${lng}.json`);
      const tsPath = path.join(__dirname, `miniprogram/utils/i18n/locales/${lng}.ts`);

      let mergedTranslations = {};

      // 讀取既有的 json 資料
      if (fs.existsSync(jsonPath)) {
        try {
          const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
          mergedTranslations = JSON.parse(jsonContent);
        } catch (e) {
          console.warn(`[i18n-scanner] 讀取 ${lng}.json 失敗，將重新生成。`);
        }
      }

      // 合併新掃描出的詞條
      const scannedTranslations = resStore[lng] && resStore[lng].translation ? resStore[lng].translation : {};
      mergedTranslations = { ...scannedTranslations, ...mergedTranslations };

      // 1. 寫入 JSON 檔 (給 i18next-scanner 上次掃描記憶用)
      const jsonString = JSON.stringify(mergedTranslations, null, 2);
      fs.writeFileSync(jsonPath, jsonString, 'utf-8');

      // 2. 同步寫入 TS 檔 (給微信小程序 import 用)
      const tsContent = `export default ${jsonString};\n`;
      fs.writeFileSync(tsPath, tsContent, 'utf-8');
    });

    done();
  }
};