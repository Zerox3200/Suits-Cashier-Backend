import { activityLogRepository } from "./activityLog.repository.js";
import { getPagination } from "../../utils/pagination.js";

export const createActivityLog = async (payload, session = null) => {
  return activityLogRepository.create(payload, session);
};

const mapUserToArabic = (user) => {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : user;
  return {
    المعرف: u._id,
    الاسم: u.name,
    البريد: u.email,
    الدور: u.role,
  };
};

const mapActivityLogToArabic = (log) => {
  const item = log.toObject ? log.toObject() : log;
  return {
    المعرف: item._id,
    المستخدم: mapUserToArabic(item.user),
    الإجراء: item.action,
    الكيان: item.entity,
    معرف_الكيان: item.entityId,
    الوصف: item.description,
    تاريخ_الإنشاء: item.createdAt,
    تاريخ_التحديث: item.updatedAt,
  };
};

export const listActivityLogs = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const { items, total } = await activityLogRepository.findPaginated({ skip, limit });

  return {
    العناصر: items.map(mapActivityLogToArabic),
    التصفح: {
      الصفحة: page,
      الحد: limit,
      الإجمالي: total,
      إجمالي_الصفحات: Math.ceil(total / limit) || 0,
    },
  };
};
