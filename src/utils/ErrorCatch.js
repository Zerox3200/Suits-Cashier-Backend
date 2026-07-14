export const ErrorCatch = (controller) => {
  return (req, res, next) => {
    controller(req, res, next).catch((error) => {
      const status = error.cause || 500;
      return res.status(typeof status === "number" ? status : 500).json({
        success: false,
        message: error.message,
        data: null,
      });
    });
  };
};
