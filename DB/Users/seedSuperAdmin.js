import { User } from "./Users.js";
import argon2 from "argon2";
import { ROLES } from "../../src/constants/enums.js";

export const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@suits.com";

    const existingAdmin = await User.findOne({ role: ROLES.ADMIN });
    if (existingAdmin) {
      console.log("Admin already exists, skipping seed");
      return;
    }

    const password = process.env.ADMIN_PASSWORD || "Admin@12345";
    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    await User.create({
      name: "Admin",
      email: adminEmail,
      password: hashedPassword,
      phone: process.env.ADMIN_PHONE || "01000000000",
      role: ROLES.ADMIN,
    });

    console.log("Admin seeded successfully");
  } catch (error) {
    console.error("Error seeding admin:", error);
  }
};
