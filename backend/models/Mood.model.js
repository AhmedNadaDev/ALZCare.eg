import mongoose from 'mongoose';

const moodSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient is required']
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recordedByModel',
    required: [true, 'Recorder is required']
  },
  recordedByModel: {
    type: String,
    enum: ['Doctor', 'Family'],
    required: true
  },
  mood: {
    type: String,
    enum: ['very_happy', 'happy', 'neutral', 'sad', 'very_sad', 'anxious', 'confused', 'agitated', 'calm', 'sleepy'],
    required: [true, 'Mood is required']
  },
  moodScore: {
    type: Number,
    min: 1,
    max: 10,
    required: [true, 'Mood score is required']
  },
  energy: {
    type: String,
    enum: ['very_low', 'low', 'moderate', 'high', 'very_high'],
    default: 'moderate'
  },
  sleep: {
    quality: {
      type: String,
      enum: ['poor', 'fair', 'good', 'excellent'],
      default: 'fair'
    },
    hours: {
      type: Number,
      min: 0,
      max: 24,
      default: null
    },
    disturbances: {
      type: Boolean,
      default: false
    }
  },
  appetite: {
    type: String,
    enum: ['poor', 'reduced', 'normal', 'increased'],
    default: 'normal'
  },
  cognitiveState: {
    clarity: {
      type: String,
      enum: ['confused', 'somewhat_confused', 'mostly_clear', 'clear'],
      default: 'mostly_clear'
    },
    recognition: {
      type: String,
      enum: ['none', 'some', 'most', 'all'],
      default: 'most'
    },
    communication: {
      type: String,
      enum: ['nonverbal', 'limited', 'moderate', 'good'],
      default: 'moderate'
    }
  },
  physicalSymptoms: [{
    type: String,
    enum: ['headache', 'fatigue', 'pain', 'nausea', 'dizziness', 'tremors', 'none']
  }],
  behaviors: [{
    type: String,
    enum: ['wandering', 'repetitive_questions', 'sundowning', 'aggression', 'withdrawal', 'restlessness', 'none']
  }],
  activities: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  isAbnormal: {
    type: Boolean,
    default: false
  },
  alertTriggered: {
    type: Boolean,
    default: false
  },
  recordedAt: {
    type: Date,
    default: Date.now
  },
  location: {
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  }
}, {
  timestamps: true
});

// Pre-save hook to detect abnormal moods
moodSchema.pre('save', function(next) {
  // Flag abnormal moods based on score and certain conditions
  const abnormalMoods = ['very_sad', 'anxious', 'agitated', 'confused'];
  const abnormalBehaviors = ['wandering', 'aggression', 'sundowning'];
  
  if (
    this.moodScore <= 3 ||
    abnormalMoods.includes(this.mood) ||
    this.behaviors.some(b => abnormalBehaviors.includes(b)) ||
    this.cognitiveState.clarity === 'confused'
  ) {
    this.isAbnormal = true;
  }
  next();
});

// Index for efficient queries
moodSchema.index({ patient: 1, recordedAt: -1 });
moodSchema.index({ patient: 1, isAbnormal: 1 });
moodSchema.index({ recordedBy: 1 });

// Static method to get mood history for a patient
moodSchema.statics.getMoodHistory = async function(patientId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    patient: patientId,
    recordedAt: { $gte: startDate }
  })
  .sort({ recordedAt: -1 })
  .populate('recordedBy', 'firstName lastName');
};

// Static method to get mood statistics
moodSchema.statics.getMoodStats = async function(patientId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const moods = await this.find({
    patient: patientId,
    recordedAt: { $gte: startDate }
  });
  
  if (moods.length === 0) return null;
  
  const avgScore = moods.reduce((sum, m) => sum + m.moodScore, 0) / moods.length;
  const abnormalCount = moods.filter(m => m.isAbnormal).length;
  
  return {
    totalEntries: moods.length,
    averageScore: Math.round(avgScore * 10) / 10,
    abnormalCount,
    abnormalPercentage: Math.round((abnormalCount / moods.length) * 100)
  };
};

const Mood = mongoose.model('Mood', moodSchema);

export default Mood;
