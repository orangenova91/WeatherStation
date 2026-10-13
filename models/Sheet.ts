import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const sheetSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true },
  ingestToken: { type: String, required: true, unique: true },
  createdAt: { type: Date, required: true, default: Date.now },
});

sheetSchema.index({ ownerId: 1, createdAt: -1 });

export type SheetDocument = InferSchemaType<typeof sheetSchema>;

export const Sheet: Model<SheetDocument> =
  models.Sheet || model<SheetDocument>("Sheet", sheetSchema);
