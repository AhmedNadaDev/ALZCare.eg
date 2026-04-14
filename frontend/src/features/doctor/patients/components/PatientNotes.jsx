import React from 'react';

const PatientNotes = ({ patient }) => {
  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
      <h2 className="text-lg font-bold text-white mb-4">Patient Notes</h2>
      {patient.notes && patient.notes.length > 0 ? (
        <div className="space-y-3">
          {patient.notes.map((note, index) => (
            <div key={index} className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.05]">
              <p className="text-white">{note.content}</p>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-center py-8">No notes yet</p>
      )}
    </div>
  );
};

export default PatientNotes;
