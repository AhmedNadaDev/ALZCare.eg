import mongoose from 'mongoose';

// Lightweight history entry — no _id subdocument overhead
const historyEntrySchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const patientLocationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      unique: true, // one document per patient — always overwrite latest coords
      index: true,
    },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null }, // GPS accuracy in metres
    lastKnownStatus: {
      type: String,
      enum: ['inside', 'outside', 'unknown'],
      default: 'unknown',
    },
    // Rolling history capped at 50 entries (push/slice handled in service)
    history: { type: [historyEntrySchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('PatientLocation', patientLocationSchema);
