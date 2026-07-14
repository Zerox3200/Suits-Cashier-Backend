import mongoose from "mongoose";

const isTransactionUnsupportedError = (err) => {
  const message = err?.message || "";
  return (
    message.includes("Transaction numbers are only allowed") ||
    message.includes("replica set member") ||
    message.includes("not supported") ||
    err?.code === 20 ||
    err?.codeName === "IllegalOperation"
  );
};

/**
 * Runs work inside a MongoDB transaction when available.
 * Falls back to no session on standalone MongoDB (local/dev without replica set).
 *
 * @param {(session: import('mongoose').ClientSession | null) => Promise<any>} work
 */
export const runInTransaction = async (work) => {
  let session = null;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (session?.inTransaction?.()) {
      try {
        await session.abortTransaction();
      } catch {
        // ignore abort errors
      }
    }

    if (session) {
      session.endSession();
      session = null;
    }

    if (isTransactionUnsupportedError(err)) {
      return work(null);
    }

    throw err;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};
