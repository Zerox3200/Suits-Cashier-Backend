export const ROLES = Object.freeze({
  ADMIN: "مسؤول",
  CASHIER: "كاشير",
});

export const INVOICE_STATUS = Object.freeze({
  COMPLETED: "مكتملة",
  RETURNED: "مرتجعة",
});

export const PAYMENT_METHODS = Object.freeze({
  CASH: "نقدي",
  VISA: "فيزا",
});

export const STOCK_MOVEMENT_TYPE = Object.freeze({
  IN: "دخول",
  OUT: "خروج",
});

export const STOCK_ADJUST_REASON = Object.freeze({
  PURCHASE: "شراء",
  DAMAGED: "تالف",
  LOST: "مفقود",
  MANUAL: "يدوي",
  CORRECTION: "تصحيح",
  RETURN: "إرجاع",
});

export const STOCK_MOVEMENT_REASON = Object.freeze({
  PURCHASE: "شراء",
  INVOICE: "فاتورة",
  RETURN: "إرجاع",
  MANUAL: "يدوي",
  DAMAGED: "تالف",
  LOST: "مفقود",
  CORRECTION: "تصحيح",
});

export const STOCK_REFERENCE_TYPE = Object.freeze({
  INVOICE: "فاتورة",
  MANUAL: "يدوي",
  PURCHASE: "شراء",
  ADJUSTMENT: "تعديل",
});

export const ACTIVITY_ACTIONS = Object.freeze({
  CREATED_PRODUCT: "إنشاء منتج",
  UPDATED_PRODUCT: "تحديث منتج",
  CREATED_SUPPLIER: "إنشاء مورد",
  UPDATED_SUPPLIER: "تحديث مورد",
  CREATED_CATEGORY: "إنشاء تصنيف",
  UPDATED_CATEGORY: "تحديث تصنيف",
  ADJUSTED_STOCK: "تعديل مخزون",
  CREATED_INVOICE: "إنشاء فاتورة",
  RETURNED_INVOICE: "إرجاع فاتورة",
  CREATED_USER: "إنشاء مستخدم",
  UPDATED_SETTINGS: "تحديث الإعدادات",
});

export const ACTIVITY_ENTITIES = Object.freeze({
  PRODUCT: "منتج",
  SUPPLIER: "مورد",
  CATEGORY: "تصنيف",
  STOCK: "مخزون",
  INVOICE: "فاتورة",
  USER: "مستخدم",
  SETTINGS: "إعدادات",
});
