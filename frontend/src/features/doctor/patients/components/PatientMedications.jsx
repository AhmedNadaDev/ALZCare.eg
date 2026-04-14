import React, { useState } from 'react';
import { PillIcon, PlusIcon, ClockIcon, TrashIcon, LoadingSpinner } from '../../../shared/icons';
import { medicationsAPI } from '../services/patientService';

const DEFAULT_MED_FORM = {
  name: '',
  type: 'tablet',
  strength: '',
  instructions: '',
  schedule: [{ time: '08:00', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], dosage: '1 tablet' }],
};

const PatientMedications = ({ medications, patientId, onRefresh }) => {
  const [showMedModal, setShowMedModal] = useState(false);
  const [medForm, setMedForm] = useState(DEFAULT_MED_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleAddMedication = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await medicationsAPI.create({ patientId, ...medForm });
      setShowMedModal(false);
      setMedForm(DEFAULT_MED_FORM);
      onRefresh();
    } catch (error) {
      console.error('Failed to add medication:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMedication = async (medId) => {
    if (window.confirm('Are you sure you want to delete this medication?')) {
      try {
        await medicationsAPI.delete(medId);
        onRefresh();
      } catch (error) {
        console.error('Failed to delete medication:', error);
        alert('Failed to delete medication');
      }
    }
  };

  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
            <PillIcon />
          </div>
          <h2 className="text-lg font-bold text-white">Medications</h2>
        </div>
        <button
          onClick={() => setShowMedModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors"
        >
          <PlusIcon />
          <span>Add Medication</span>
        </button>
      </div>

      {medications.length === 0 ? (
        <div className="text-center py-12">
          <PillIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No medications prescribed yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {medications.map((med) => (
            <div key={med._id} className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.05]">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-white">{med.name}</p>
                  <p className="text-sm text-gray-400">{med.type} • {med.strength}</p>
                  {med.instructions && (
                    <p className="text-sm text-gray-500 mt-2">{med.instructions}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                    med.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {med.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => handleDeleteMedication(med._id)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete medication"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
              {med.schedule && med.schedule.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {med.schedule.map((s, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-1 bg-white/[0.05] rounded-lg text-xs text-gray-400">
                      <ClockIcon />
                      {s.time} - {s.dosage}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Medication Modal */}
      {showMedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#1a0a2e] rounded-2xl border border-white/10 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Add Medication</h3>

            <form onSubmit={handleAddMedication} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Medication Name *</label>
                <input
                  type="text"
                  value={medForm.name}
                  onChange={(e) => setMedForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                  placeholder="e.g., Donepezil"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                  <select
                    value={medForm.type}
                    onChange={(e) => setMedForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#1a0a2e] border-2 border-white/10 rounded-xl text-white focus:border-purple-500 outline-none"
                    style={{ color: '#ffffff' }}
                  >
                    <option value="tablet" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Tablet</option>
                    <option value="capsule" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Capsule</option>
                    <option value="liquid" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Liquid</option>
                    <option value="injection" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Injection</option>
                    <option value="topical" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Topical</option>
                    <option value="inhaler" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Inhaler</option>
                    <option value="drops" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Drops</option>
                    <option value="other" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Strength</label>
                  <input
                    type="text"
                    value={medForm.strength}
                    onChange={(e) => setMedForm(prev => ({ ...prev, strength: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                    placeholder="e.g., 10mg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Instructions</label>
                <textarea
                  value={medForm.instructions}
                  onChange={(e) => setMedForm(prev => ({ ...prev, instructions: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none resize-none"
                  placeholder="Take with food..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Schedule</label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={medForm.schedule[0].time}
                    onChange={(e) => setMedForm(prev => ({
                      ...prev,
                      schedule: [{ ...prev.schedule[0], time: e.target.value }],
                    }))}
                    className="flex-1 px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white focus:border-purple-500 outline-none"
                  />
                  <input
                    type="text"
                    value={medForm.schedule[0].dosage}
                    onChange={(e) => setMedForm(prev => ({
                      ...prev,
                      schedule: [{ ...prev.schedule[0], dosage: e.target.value }],
                    }))}
                    className="flex-1 px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                    placeholder="1 tablet"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="flex-1 px-4 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!medForm.name || submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <LoadingSpinner /> : 'Add Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientMedications;
