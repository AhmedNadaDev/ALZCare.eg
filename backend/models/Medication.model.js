import mongoose from 'mongoose';

const medicationScheduleSchema = new mongoose.Schema({
  time: {
    type: String,
    required: [true, 'Medication time is required'],
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
  },
  days: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  }],
  dosage: {
    type: String,
    required: [true, 'Dosage is required']
  }
});

const medicationLogSchema = new mongoose.Schema({
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'taken', 'missed', 'skipped'],
    default: 'pending'
  },
  takenAt: {
    type: Date,
    default: null
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'medicationLogs.confirmedByModel'
  },
  confirmedByModel: {
    type: String,
    enum: ['Doctor', 'Family'],
    default: 'Family'
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  location: {
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  }
}, { _id: true });

const medicationSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient is required']
  },
  prescribedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Prescribing doctor is required']
  },
  name: {
    type: String,
    required: [true, 'Medication name is required'],
    trim: true,
    maxlength: [200, 'Medication name cannot exceed 200 characters']
  },
  genericName: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['tablet', 'capsule', 'liquid', 'injection', 'topical', 'inhaler', 'drops', 'other'],
    default: 'tablet'
  },
  strength: {
    type: String,
    trim: true
  },
  instructions: {
    type: String,
    maxlength: [1000, 'Instructions cannot exceed 1000 characters']
  },
  purpose: {
    type: String,
    maxlength: [500, 'Purpose cannot exceed 500 characters']
  },
  sideEffects: [{
    type: String,
    trim: true
  }],
  schedule: [medicationScheduleSchema],
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  refillReminder: {
    enabled: { type: Boolean, default: true },
    daysBeforeRefill: { type: Number, default: 7 },
    lastRefillDate: { type: Date, default: null },
    nextRefillDate: { type: Date, default: null }
  },
  medicationLogs: [medicationLogSchema],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true
});

// Index for efficient queries
medicationSchema.index({ patient: 1, isActive: 1 });
medicationSchema.index({ prescribedBy: 1 });
medicationSchema.index({ 'medicationLogs.scheduledDate': 1, 'medicationLogs.status': 1 });

// Virtual to get today's schedule
medicationSchema.virtual('todaySchedule').get(function() {
  const today = new Date();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
  return this.schedule.filter(s => s.days.includes(dayOfWeek));
});

// Static method to get medications due for a patient
medicationSchema.statics.getDueMedications = async function(patientId, date = new Date()) {
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
  return this.find({
    patient: patientId,
    isActive: true,
    'schedule.days': dayOfWeek
  }).populate('prescribedBy', 'firstName lastName');
};

// Ensure virtuals are included
medicationSchema.set('toJSON', { virtuals: true });
medicationSchema.set('toObject', { virtuals: true });

const Medication = mongoose.model('Medication', medicationSchema);

export default Medication;
