import { invoiceRepository } from "../Invoices/invoices.repository.js";
import { productRepository } from "../Products/products.repository.js";
import { stockRepository } from "../Stock/stock.repository.js";
import { INVOICE_STATUS } from "../../constants/enums.js";

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const salesAggregate = async (fromDate) => {
  const result = await invoiceRepository.aggregate([
    {
      $match: {
        status: INVOICE_STATUS.COMPLETED,
        createdAt: { $gte: fromDate },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
  ]);
  return result[0] || { totalSales: 0, count: 0 };
};

export const getDashboardStats = async () => {
  const todayStart = startOfDay();
  const monthStart = startOfMonth();

  const [today, monthly, revenueProfit, totalProducts, totalInvoices, recentInvoices, lowStock, outOfStock] =
    await Promise.all([
      salesAggregate(todayStart),
      salesAggregate(monthStart),
      invoiceRepository.aggregate([
        { $match: { status: INVOICE_STATUS.COMPLETED } },
        { $unwind: "$items" },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] },
            },
            totalCost: {
              $sum: { $multiply: ["$items.unitCost", "$items.quantity"] },
            },
          },
        },
      ]),
      productRepository.count({ isActive: true }),
      invoiceRepository.count(),
      invoiceRepository.findRecent(10),
      stockRepository.findLowStock(),
      stockRepository.findOutOfStock(),
    ]);

  const rp = revenueProfit[0] || { totalRevenue: 0, totalCost: 0 };
  const totalProfit = (rp.totalRevenue || 0) - (rp.totalCost || 0);

  // Full revenue from completed invoice totals (includes tax/discount)
  const allRevenue = await invoiceRepository.aggregate([
    { $match: { status: INVOICE_STATUS.COMPLETED } },
    { $group: { _id: null, total: { $sum: "$total" } } },
  ]);

  return {
    todaySales: {
      amount: today.totalSales,
      invoiceCount: today.count,
    },
    monthlySales: {
      amount: monthly.totalSales,
      invoiceCount: monthly.count,
    },
    totalRevenue: allRevenue[0]?.total || 0,
    totalProfit,
    totalProducts,
    totalInvoices,
    recentInvoices,
    outOfStock: {
      count: outOfStock.length,
      products: outOfStock,
    },
    lowStock: {
      count: lowStock.length,
      products: lowStock,
    },
  };
};
