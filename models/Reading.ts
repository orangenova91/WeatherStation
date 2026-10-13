import mongoose, { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const readingSchema = new Schema({
  sheetId: { type: Schema.Types.ObjectId, ref: "Sheet", required: true },
  senderName: { type: String, required: true },
  deviceName: { type: String, required: true },
  sensorName: { type: String, required: true },
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },
  locationName: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  receivedAt: { type: Date, required: true, default: Date.now },
});

readingSchema.index({ sheetId: 1, receivedAt: -1 });
readingSchema.index({ receivedAt: -1 });
readingSchema.index({ location: "2dsphere" });

export type ReadingDocument = InferSchemaType<typeof readingSchema>;

if (models.Reading && !models.Reading.schema.path("senderName")) {
  mongoose.deleteModel("Reading");
}

export const Reading: Model<ReadingDocument> =
  models.Reading || model<ReadingDocument>("Reading", readingSchema);
