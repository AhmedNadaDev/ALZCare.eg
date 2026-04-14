import React from 'react';
import { UserIcon, CheckCircleIcon } from '../../../shared/icons';

const PatientOverview = ({ patient, medications, moodStats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Patient Info */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
            <UserIcon />
          </div>
          <h2 className="text-lg font-bold text-white">Patient Information</h2>
        </div>
        <div className="space-y-4">
          {patient.dateOfBirth && (
            <div>
              <p className="text-xs text-gray-500">Date of Birth</p>
              <p className="text-white">{new Date(patient.dateOfBirth).toLocaleDateString()}</p>
            </div>
          )}
          {patient.diagnosisDate && (
            <div>
              <p className="text-xs text-gray-500">Diagnosis Date</p>
              <p className="text-white">{new Date(patient.diagnosisDate).toLocaleDateString()}</p>
            </div>
          )}
          {patient.description && (
            <div>
              <p className="text-xs text-gray-500">Description</p>
              <p className="text-white">{patient.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
            <CheckCircleIcon />
          </div>
          <h2 className="text-lg font-bold text-white">Quick Stats</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/[0.02] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{medications.length}</p>
            <p className="text-xs text-gray-500">Active Medications</p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{moodStats?.averageScore || 0}</p>
            <p className="text-xs text-gray-500">Avg Mood (30d)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientOverview;
