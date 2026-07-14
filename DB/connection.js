import mongoose from "mongoose";

export const conn = async () =>
  await mongoose
    .connect("mongodb://127.0.0.1:27017/Suits-app")
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.log("Connected faild", err));
