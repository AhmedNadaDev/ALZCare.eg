import React, { useEffect, useState } from 'react';
import AIAssistantPanel from '../../../shared/components/AIAssistantPanel';
import { patientsAPI } from '../../../../modules/shared/api/api';

const DoctorAssistantPage = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(true);

  useEffect(() => {
    patientsAPI
      .getAll({ status: 'active' })
      .then((res) => setPatients(res.data || []))
      .catch(console.error)
      .finally(() => setLoadingPatients(false));
  }, []);

  const handlePatientChange = (e) => {
    const id = e.target.value;
    setSelectedPatientId(id);
    if (!id) {
      setSelectedPatientName('');
      return;
    }
    const patient = patients.find((p) => p._id === id);
    setSelectedPatientName(patient ? `${patient.firstName} ${patient.lastName}` : '');
  };

  return (
    <div className="space-y-4">
      {/* Patient selector — OPTIONAL */}
      <div className="rounded-xl border border-white/10 bg-[#1b0e2f] px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-gray-300 font-medium">
            Patient context
            <span className="ml-2 text-xs text-gray-500 font-normal">(optional)</span>
          </label>
          {selectedPatientId && (
            <button
              onClick={() => { setSelectedPatientId(''); setSelectedPatientName(''); }}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Clear ✕
            </button>
          )}
        </div>

        {loadingPatients ? (
          <p className="text-sm text-gray-500">Loading patients…</p>
        ) : (
          <>
            <select
              value={selectedPatientId}
              onChange={handlePatientChange}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            >
              <option value="" className="bg-[#1b0e2f]">
                — General mode (no patient) —
              </option>
              {patients.map((p) => (
                <option key={p._id} value={p._id} className="bg-[#1b0e2f]">
                  {p.firstName} {p.lastName}
                  {p.patientNumber ? ` · ${p.patientNumber}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-500">
              {selectedPatientId
                ? 'Patient Mode active — responses will be personalized to this patient.'
                : 'General Mode active — ask any Alzheimer\'s or dementia question.'}
            </p>
          </>
        )}
      </div>

      <AIAssistantPanel
        roleLabel="Doctor"
        patientId={selectedPatientId || null}
        patientName={selectedPatientName || null}
      />
    </div>
  );
};

export default DoctorAssistantPage;
