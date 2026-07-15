import { STOCK_ADJUST_REASON } from '../../src/constants/enums.js'

export function invoicePayload(items, overrides = {}) {
  return {
    customerName: overrides.customerName ?? 'عميل اختبار',
    customerPhone: overrides.customerPhone ?? '01011112222',
    items: items.map((i) => ({
      productId: String(i.productId || i._id || i),
      quantity: i.quantity ?? 1,
    })),
    discount: overrides.discount ?? 0,
    tax: overrides.tax ?? 0,
    paymentMethod: overrides.paymentMethod ?? 'نقدي',
    notes: overrides.notes ?? '',
  }
}

export function adjustPayload(quantity, reason = STOCK_ADJUST_REASON.MANUAL) {
  return { quantity, reason }
}

/** XSS / injection attack payloads for validation & sanitization checks */
export const ATTACK_STRINGS = {
  mongoInjection: '{ "$gt": "" }',
  mongoOperator: { email: { $ne: null } },
  sqlInjection: "'; DROP TABLE users; --",
  xss: '<script>alert("xss")</script>',
  html: '<img src=x onerror=alert(1)>',
  prototypePollution: JSON.stringify({ __proto__: { admin: true } }),
  unicode: 'منتج تجريبي 中文 русский',
  emoji: 'بدلة 🔥👔',
  longName: 'أ'.repeat(5000),
}
