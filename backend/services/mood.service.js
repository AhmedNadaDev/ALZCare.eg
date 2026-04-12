import Mood from '../models/Mood.model.js';
import Patient from '../models/Patient.model.js';
import Family from '../models/Family.model.js';
import Notification from '../models/Notification.model.js';

class MoodService {
  /**
   * Create mood entry
   */
  async createMoodEntry(moodData, userId, userRole) {
    // Verify access to patient
    const patient = await Patient.findById(moodData.patientId);
    if (!patient) {
      throw { status: 404, message: 'Patient not found' };
    }

    if (userRole === 'doctor' && patient.doctor.toString() !== userId.toString()) {
      throw { status: 403, message: 'Not authorized to add mood entry for this patient' };
    }

    if (userRole === 'family') {
      const family = await Family.findById(userId);
      if (!family || family.patient.toString() !== moodData.patientId.toString()) {
        throw { status: 403, message: 'Not authorized to add mood entry for this patient' };
      }
    }

    const moodEntry = await Mood.create({
      patient: moodData.patientId,
      recordedBy: userId,
      recordedByModel: userRole === 'doctor' ? 'Doctor' : 'Family',
      mood: moodData.mood,
      moodScore: moodData.moodScore,
      energy: moodData.energy,
      sleep: moodData.sleep,
      appetite: moodData.appetite,
      cognitiveState: moodData.cognitiveState,
      physicalSymptoms: moodData.physicalSymptoms || [],
      behaviors: moodData.behaviors || [],
      activities: moodData.activities || [],
      notes: moodData.notes,
      recordedAt: moodData.recordedAt || new Date(),
      location: moodData.location || null
    });

    // If mood is abnormal, create alert for doctor
    if (moodEntry.isAbnormal) {
      await Notification.createAbnormalMoodAlert(
        patient.doctor,
        'Doctor',
        patient,
        moodEntry
      );
      
      moodEntry.alertTriggered = true;
      await moodEntry.save();
    }

    // If family added the entry, notify doctor
    if (userRole === 'family') {
      await Notification.create({
        recipient: patient.doctor,
        recipientModel: 'Doctor',
        patient: patient._id,
        type: 'mood_entry',
        priority: moodEntry.isAbnormal ? 'high' : 'low',
        title: 'New Mood Entry',
        message: `A mood entry has been added for ${patient.firstName}. Mood: ${moodEntry.mood} (${moodEntry.moodScore}/10)`,
        data: {
          moodId: moodEntry._id,
          mood: moodEntry.mood,
          moodScore: moodEntry.moodScore
        }
      });
    }

    return moodEntry;
  }

  /**
   * Get mood history for a patient
   */
  async getMoodHistory(patientId, userId, userRole, options = {}) {
    // Verify access
    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw { status: 404, message: 'Patient not found' };
    }

    if (userRole === 'doctor' && patient.doctor.toString() !== userId.toString()) {
      throw { status: 403, message: 'Not authorized to view this patient\'s mood history' };
    }

    if (userRole === 'family') {
      const family = await Family.findById(userId);
      if (!family || family.patient.toString() !== patientId.toString()) {
        throw { status: 403, message: 'Not authorized to view this patient\'s mood history' };
      }
    }

    const { days = 30, limit = 50, page = 1 } = options;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = {
      patient: patientId,
      recordedAt: { $gte: startDate }
    };

    const total = await Mood.countDocuments(query);
    const moods = await Mood.find(query)
      .sort({ recordedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('recordedBy', 'firstName lastName');

    return {
      moods,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    };
  }

  /**
   * Get mood entry by ID
   */
  async getMoodById(moodId) {
    const mood = await Mood.findById(moodId)
      .populate('patient', 'firstName lastName patientNumber')
      .populate('recordedBy', 'firstName lastName');

    if (!mood) {
      throw { status: 404, message: 'Mood entry not found' };
    }

    return mood;
  }

  /**
   * Update mood entry
   */
  async updateMoodEntry(moodId, updateData, userId, userRole) {
    const mood = await Mood.findById(moodId);

    if (!mood) {
      throw { status: 404, message: 'Mood entry not found' };
    }

    // Only the recorder can update
    if (mood.recordedBy.toString() !== userId.toString()) {
      throw { status: 403, message: 'Not authorized to update this mood entry' };
    }

    // Restricted fields
    const restrictedFields = ['patient', 'recordedBy', 'recordedByModel', 'alertTriggered'];
    restrictedFields.forEach(field => delete updateData[field]);

    Object.assign(mood, updateData);
    await mood.save();

    return mood;
  }

  /**
   * Delete mood entry
   */
  async deleteMoodEntry(moodId, userId, userRole) {
    const mood = await Mood.findById(moodId);

    if (!mood) {
      throw { status: 404, message: 'Mood entry not found' };
    }

    const patient = await Patient.findById(mood.patient);
    if (!patient) {
      throw { status: 404, message: 'Patient not found' };
    }

    // Doctors can delete any mood entry for their patients
    if (userRole === 'doctor') {
      if (patient.doctor.toString() !== userId.toString()) {
        throw { status: 403, message: 'Not authorized to delete this mood entry' };
      }
    } 
    // Family can only delete mood entries they created
    else if (userRole === 'family') {
      const family = await Family.findById(userId);
      if (!family || family.patient.toString() !== patient._id.toString()) {
        throw { status: 403, message: 'Not authorized to delete this mood entry' };
      }
      // Check if mood was recorded by this family member
      if (mood.recordedBy.toString() !== userId.toString() || mood.recordedByModel !== 'Family') {
        throw { status: 403, message: 'You can only delete mood entries you created' };
      }
    } else {
      throw { status: 403, message: 'Not authorized to delete mood entries' };
    }

    await Mood.findByIdAndDelete(moodId);

    return { message: 'Mood entry deleted successfully' };
  }

  /**
   * Get mood statistics
   */
  async getMoodStats(patientId, userId, userRole, days = 30) {
    // Verify access
    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw { status: 404, message: 'Patient not found' };
    }

    if (userRole === 'doctor' && patient.doctor.toString() !== userId.toString()) {
      throw { status: 403, message: 'Not authorized to view this patient\'s statistics' };
    }

    if (userRole === 'family') {
      const family = await Family.findById(userId);
      if (!family || family.patient.toString() !== patientId.toString()) {
        throw { status: 403, message: 'Not authorized to view this patient\'s statistics' };
      }
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const moods = await Mood.find({
      patient: patientId,
      recordedAt: { $gte: startDate }
    }).sort({ recordedAt: 1 });

    if (moods.length === 0) {
      return {
        totalEntries: 0,
        averageScore: 0,
        moodDistribution: {},
        abnormalCount: 0,
        abnormalPercentage: 0,
        trend: [],
        recentBehaviors: []
      };
    }

    // Calculate statistics
    const avgScore = moods.reduce((sum, m) => sum + m.moodScore, 0) / moods.length;
    const abnormalCount = moods.filter(m => m.isAbnormal).length;

    // Mood distribution
    const moodDistribution = {};
    moods.forEach(m => {
      moodDistribution[m.mood] = (moodDistribution[m.mood] || 0) + 1;
    });

    // Daily trend (average score per day)
    const dailyScores = {};
    moods.forEach(m => {
      const dateKey = m.recordedAt.toISOString().split('T')[0];
      if (!dailyScores[dateKey]) {
        dailyScores[dateKey] = { total: 0, count: 0 };
      }
      dailyScores[dateKey].total += m.moodScore;
      dailyScores[dateKey].count++;
    });

    const trend = Object.entries(dailyScores).map(([date, data]) => ({
      date,
      averageScore: Math.round((data.total / data.count) * 10) / 10
    }));

    // Most common behaviors in last entries
    const recentBehaviors = {};
    moods.slice(-10).forEach(m => {
      m.behaviors.forEach(b => {
        if (b !== 'none') {
          recentBehaviors[b] = (recentBehaviors[b] || 0) + 1;
        }
      });
    });

    return {
      totalEntries: moods.length,
      averageScore: Math.round(avgScore * 10) / 10,
      moodDistribution,
      abnormalCount,
      abnormalPercentage: Math.round((abnormalCount / moods.length) * 100),
      trend,
      recentBehaviors: Object.entries(recentBehaviors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([behavior, count]) => ({ behavior, count }))
    };
  }

  /**
   * Get abnormal moods for a patient
   */
  async getAbnormalMoods(patientId, userId, userRole, days = 30) {
    // Verify access
    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw { status: 404, message: 'Patient not found' };
    }

    if (userRole === 'doctor' && patient.doctor.toString() !== userId.toString()) {
      throw { status: 403, message: 'Not authorized to view this patient\'s data' };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const abnormalMoods = await Mood.find({
      patient: patientId,
      isAbnormal: true,
      recordedAt: { $gte: startDate }
    })
    .sort({ recordedAt: -1 })
    .populate('recordedBy', 'firstName lastName');

    return abnormalMoods;
  }
}

export default new MoodService();
