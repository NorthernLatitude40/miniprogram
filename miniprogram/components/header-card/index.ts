Component({
  properties: {
    userRole: {
      type: String,
      value: ''
    },
    stats: {
      type: Object,
      value: () => ({ profit: 0, income: 0, expense: 0, stockCount: 0 })
    },
    t: {
      type: Object,
      value: () => ({})
    }
  }
});