import mongoose from 'mongoose';

const safetyZoneSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      unique: true, // exactly one zone per patient
      index: true,
    },
    center: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    radius: {
      type: Number,
      required: true,
      min: [50, 'Radius must be at least 50 metres'],
      max: [5000, 'Radius cannot exceed 5000 metres'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('SafetyZone', safetyZoneSchema);
