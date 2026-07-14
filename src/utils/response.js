export const sendSuccess = (res, statusCode = 200, message = "تمت العملية بنجاح", data = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res, statusCode = 400, message = "حدث خطأ", data = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data,
  });
};
