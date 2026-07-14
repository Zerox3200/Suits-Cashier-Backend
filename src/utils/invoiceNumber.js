import { customAlphabet } from "nanoid";

const nano = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 4);

export const generateInvoiceNumber = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `INV-${yyyy}${mm}${dd}-${nano()}`;
};
