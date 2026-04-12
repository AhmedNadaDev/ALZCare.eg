import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const familySchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  phone: {
    type: String,
    trim: true
  },
  relationship: {
    type: String,
    required: [true, 'Relationship to patient is required'],
    enum: ['spouse', 'child', 'parent', 'sibling', 'grandchild', 'caregiver', 'other'],
    default: 'caregiver'
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Associated patient is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Creator doctor is required']
  },
  profileImage: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    default: 'family',
    immutable: true
  },
  permissions: {
    canViewMedications: { type: Boolean, default: true },
    canConfirmMedication: { type: Boolean, default: true },
    canAddMoodEntry: { type: Boolean, default: true },
    canViewHistory: { type: Boolean, default: true },
    canContactDoctor: { type: Boolean, default: true }
  },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    medicationReminders: { type: Boolean, default: true },
    appointmentReminders: { type: Boolean, default: true }
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
familySchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
familySchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
familySchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Index for efficient queries
familySchema.index({ patient: 1 });
familySchema.index({ createdBy: 1 });

// Ensure virtuals are included
familySchema.set('toJSON', { virtuals: true });
familySchema.set('toObject', { virtuals: true });

const Family = mongoose.model('Family', familySchema);

export default Family;
