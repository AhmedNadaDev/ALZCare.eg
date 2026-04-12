import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientModel',
    required: [true, 'Recipient is required']
  },
  recipientModel: {
    type: String,
    enum: ['Doctor', 'Family'],
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    default: null
  },
  type: {
    type: String,
    enum: [
      'medication_reminder',
      'medication_missed',
      'medication_taken',
      'mood_abnormal',
      'mood_entry',
      'appointment_reminder',
      'patient_update',
      'system_alert',
      'new_patient',
      'family_activity'
    ],
    required: [true, 'Notification type is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientModel: 1, type: 1 });
notificationSchema.index({ patient: 1 });

// Static method to create medication reminder
notificationSchema.statics.createMedicationReminder = async function(recipientId, recipientModel, patient, medication, scheduledTime) {
  return this.create({
    recipient: recipientId,
    recipientModel,
    patient: patient._id,
    type: 'medication_reminder',
    priority: 'high',
    title: 'Medication Reminder',
    message: `Time to give ${patient.firstName} their ${medication.name} (${scheduledTime})`,
    data: {
      medicationId: medication._id,
      medicationName: medication.name,
      scheduledTime,
      patientName: patient.fullName
    }
  });
};

// Static method to create missed medication alert
notificationSchema.statics.createMissedMedicationAlert = async function(recipientId, recipientModel, patient, medication, scheduledTime) {
  return this.create({
    recipient: recipientId,
    recipientModel,
    patient: patient._id,
    type: 'medication_missed',
    priority: 'urgent',
    title: 'Missed Medication Alert',
    message: `${patient.firstName} missed their ${medication.name} scheduled for ${scheduledTime}`,
    data: {
      medicationId: medication._id,
      medicationName: medication.name,
      scheduledTime,
      patientName: patient.fullName
    }
  });
};

// Static method to create abnormal mood alert
notificationSchema.statics.createAbnormalMoodAlert = async function(recipientId, recipientModel, patient, moodEntry) {
  return this.create({
    recipient: recipientId,
    recipientModel,
    patient: patient._id,
    type: 'mood_abnormal',
    priority: 'high',
    title: 'Abnormal Mood Detected',
    message: `${patient.firstName} has shown concerning mood patterns: ${moodEntry.mood} (Score: ${moodEntry.moodScore}/10)`,
    data: {
      moodId: moodEntry._id,
      mood: moodEntry.mood,
      moodScore: moodEntry.moodScore,
      patientName: patient.fullName,
      behaviors: moodEntry.behaviors
    }
  });
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(recipientId, recipientModel) {
  return this.countDocuments({
    recipient: recipientId,
    recipientModel,
    isRead: false,
    isArchived: false
  });
};

// Static method to get recent notifications
notificationSchema.statics.getRecent = async function(recipientId, recipientModel, limit = 20) {
  return this.find({
    recipient: recipientId,
    recipientModel,
    isArchived: false
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('patient', 'firstName lastName patientNumber');
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
