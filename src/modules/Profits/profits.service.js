import { invoiceRepository } from "../Invoices/invoices.repository.js";
import { INVOICE_STATUS } from "../../constants/enums.js";

const ARABIC_DAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const pad = (n) => String(n).padStart(2, "0");

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const toDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDayLabel = (date) => {
  const d = new Date(date);
  const dayName = ARABIC_DAYS[d.getDay()];
  const label = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()} ${dayName}`;
  return { dayName, label };
};

const emptyDay = (dateKey) => {
  const [y, m, day] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  const { dayName, label } = formatDayLabel(date);
  return {
    date: dateKey,
    label,
    dayName,
    sales: {
      invoiceCount: 0,
      subTotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
    },
    returns: {
      invoiceCount: 0,
      total: 0,
    },
    cost: 0,
    returnsCost: 0,
    netRevenue: 0,
    profit: 0,
  };
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Daily profits for admin.
 * - Sales: invoices by createdAt (total already has discount applied: subTotal - discount + tax).
 * - Discounts: shown per day separately; already subtracted inside sales.total.
 * - Returns: by returnedAt; reverse revenue/cost so net profit stays accurate across days.
 * - Profit = (sales.total - returns.total) - (salesCost - returnsCost)
 */
export const getDailyProfits = async (query = {}) => {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 29);

  const from = startOfDay(query.from ? new Date(query.from) : defaultFrom);
  const to = endOfDay(query.to ? new Date(query.to) : now);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    const error = new Error("تاريخ غير صالح");
    error.cause = 400;
    throw error;
  }
  if (from > to) {
    const error = new Error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
    error.cause = 400;
    throw error;
  }

  const [salesRows, returnRows] = await Promise.all([
    invoiceRepository.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $project: {
          createdAt: 1,
          subTotal: 1,
          discount: 1,
          tax: 1,
          total: 1,
          cost: {
            $sum: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  $multiply: ["$$item.unitCost", "$$item.quantity"],
                },
              },
            },
          },
        },
      },
    ]),
    invoiceRepository.aggregate([
      {
        $match: {
          status: INVOICE_STATUS.RETURNED,
          returnedAt: { $ne: null, $gte: from, $lte: to },
        },
      },
      {
        $project: {
          returnedAt: 1,
          total: 1,
          cost: {
            $sum: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  $multiply: ["$$item.unitCost", "$$item.quantity"],
                },
              },
            },
          },
        },
      },
    ]),
  ]);

  const byDay = new Map();

  const ensureDay = (dateValue) => {
    const key = toDateKey(dateValue);
    if (!byDay.has(key)) byDay.set(key, emptyDay(key));
    return byDay.get(key);
  };

  for (const row of salesRows) {
    const day = ensureDay(row.createdAt);
    day.sales.invoiceCount += 1;
    day.sales.subTotal = round2(day.sales.subTotal + (row.subTotal || 0));
    day.sales.discount = round2(day.sales.discount + (row.discount || 0));
    day.sales.tax = round2(day.sales.tax + (row.tax || 0));
    day.sales.total = round2(day.sales.total + (row.total || 0));
    day.cost = round2(day.cost + (row.cost || 0));
  }

  for (const row of returnRows) {
    const day = ensureDay(row.returnedAt);
    day.returns.invoiceCount += 1;
    day.returns.total = round2(day.returns.total + (row.total || 0));
    day.returnsCost = round2(day.returnsCost + (row.cost || 0));
  }

  const days = [...byDay.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((day) => {
      const netRevenue = round2(day.sales.total - day.returns.total);
      const netCost = round2(day.cost - day.returnsCost);
      const profit = round2(netRevenue - netCost);
      return {
        date: day.date,
        label: day.label,
        dayName: day.dayName,
        sales: day.sales,
        returns: day.returns,
        cost: day.cost,
        netRevenue,
        profit,
      };
    });

  const summary = days.reduce(
    (acc, day) => {
      acc.salesCount += day.sales.invoiceCount;
      acc.salesSubTotal = round2(acc.salesSubTotal + day.sales.subTotal);
      acc.discountTotal = round2(acc.discountTotal + day.sales.discount);
      acc.taxTotal = round2(acc.taxTotal + day.sales.tax);
      acc.salesTotal = round2(acc.salesTotal + day.sales.total);
      acc.returnsCount += day.returns.invoiceCount;
      acc.returnsTotal = round2(acc.returnsTotal + day.returns.total);
      acc.costTotal = round2(acc.costTotal + day.cost);
      acc.netRevenue = round2(acc.netRevenue + day.netRevenue);
      acc.profitTotal = round2(acc.profitTotal + day.profit);
      return acc;
    },
    {
      salesCount: 0,
      salesSubTotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      salesTotal: 0,
      returnsCount: 0,
      returnsTotal: 0,
      costTotal: 0,
      netRevenue: 0,
      profitTotal: 0,
      daysCount: days.length,
    }
  );

  return {
    from: toDateKey(from),
    to: toDateKey(to),
    days,
    summary,
  };
};

export const __testables = { formatDayLabel, toDateKey, emptyDay };
