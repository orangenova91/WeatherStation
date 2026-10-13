import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
});

export type UserDocument = InferSchemaType<typeof userSchema>;

export const User: Model<UserDocument> =
  models.User || model<UserDocument>("User", userSchema);
