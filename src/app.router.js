import authRoutes from "./modules/auth/auth.routes.js";
import categoriesRoutes from "./modules/Categories/categories.routes.js";
import suppliersRoutes from "./modules/Suppliers/suppliers.routes.js";
import productsRoutes from "./modules/Products/products.routes.js";
import stockRoutes from "./modules/Stock/stock.routes.js";
import stockMovementsRoutes from "./modules/StockMovements/stockMovements.routes.js";
import invoicesRoutes from "./modules/Invoices/invoices.routes.js";
import settingsRoutes from "./modules/Settings/settings.routes.js";
import dashboardRoutes from "./modules/Dashboard/dashboard.routes.js";
import activityLogRoutes from "./modules/ActivityLog/activityLog.routes.js";

export const appRouter = (app, express) => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/uploads", express.static("uploads"));

  app.use("/auth", authRoutes);
  app.use("/categories", categoriesRoutes);
  app.use("/suppliers", suppliersRoutes);
  app.use("/products", productsRoutes);
  app.use("/stock", stockRoutes);
  app.use("/stock-movements", stockMovementsRoutes);
  app.use("/invoices", invoicesRoutes);
  app.use("/settings", settingsRoutes);
  app.use("/dashboard", dashboardRoutes);
  app.use("/activity-logs", activityLogRoutes);

  app.all("*", (req, res, next) => {
    return next(new Error("الصفحة غير موجودة", { cause: 404 }));
  });

  app.use((error, req, res, next) => {
    return res.status(error.cause || 500).json({
      success: false,
      message: error.message,
      data: null,
    });
  });
};
