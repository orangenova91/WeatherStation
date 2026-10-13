import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const pendingSignupSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, required: true, default: 0 },
});

pendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PendingSignupDocument = InferSchemaType<typeof pendingSignupSchema>;

export const PendingSignup: Model<PendingSignupDocument> =
  models.PendingSignup || model<PendingSignupDocument>("PendingSignup", pendingSignupSchema);
