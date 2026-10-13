import mongoose from "mongoose";
import { connection } from "next/server";

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseConnect?: Promise<typeof mongoose>;
};

export async function connectDb() {
  await connection();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!globalForMongoose.mongooseConnect) {
    globalForMongoose.mongooseConnect = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 8000 })
      .catch((error: unknown) => {
        globalForMongoose.mongooseConnect = undefined;
        throw error;
      });
  }

  await globalForMongoose.mongooseConnect;
  return mongoose;
}

export function isDatabaseError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("MONGODB_URI") ||
    error.name.includes("Mongo") ||
    error.name.includes("Mongoose")
  );
}
