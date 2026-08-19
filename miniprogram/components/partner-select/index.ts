import { searchPartner } from '../../utils/user'; // 根據你的實際 API 路徑調整

let phoneTimer: any = null;

Component({
  properties: {
    phone: { type: String, value: '' },
    name: { type: String, value: '' },
    partnerId: { type: Number, value: null }
  },

  methods: {
    // 電話輸入事件 + 防抖查詢
    onPhoneChange(e: any) {
      const phone = e.detail.value.trim();
      
      // 向父組件同步 phone 值
      this.triggerEvent('change', {
        phone,
        name: this.properties.name,
        partnerId: this.properties.partnerId
      });

      if (phoneTimer) clearTimeout(phoneTimer);

      phoneTimer = setTimeout(async () => {
        try {
          const res = await searchPartner(phone);
          if (res) {
            const name = res.name || res.partner_name || '';
            const partnerId = res.id || null;

            // 自動帶出姓名與 ID，並通知父頁面
            this.triggerEvent('change', {
              phone,
              name,
              partnerId
            });
          }
        } catch (err) {
          console.error('組件內部查詢客戶失敗：', err);
        }
      }, 300);
    },

    // 姓名手動輸入事件
    onNameChange(e: any) {
      const name = e.detail.value;
      this.triggerEvent('change', {
        phone: this.properties.phone,
        name,
        partnerId: this.properties.partnerId
      });
    }
  }
});