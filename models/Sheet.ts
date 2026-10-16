import mongoose, { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const sheetSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true },
  ingestToken: { type: String, required: true, unique: true },
  // 공유 지도 표시. 필드 없는 기존 문서는 공개로 취급한다.
  sharedOnMap: { type: Boolean, required: true, default: true },
  createdAt: { type: Date, required: true, default: Date.now },
});

sheetSchema.index({ ownerId: 1, createdAt: -1 });
sheetSchema.index({ sharedOnMap: 1 });

export type SheetDocument = InferSchemaType<typeof sheetSchema>;

if (models.Sheet && !models.Sheet.schema.path("sharedOnMap")) {
  mongoose.deleteModel("Sheet");
}

export const Sheet: Model<SheetDocument> =
  models.Sheet || model<SheetDocument>("Sheet", sheetSchema);
