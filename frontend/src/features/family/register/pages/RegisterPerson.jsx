import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../../modules/shared/auth/AuthContext';
import {
  submitFamilyPersonRegistration,
  fetchRegisteredPersonsForFamily,
} from '../../../shared/Service-ai-models/face-recognition';
import { LoadingSpinner } from '../../../shared/icons';

const RegisterPerson = () => {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [useCamera, setUseCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [relation, setRelation] = useState('');
  const [files, setFiles] = useState([]);
  const [registeredPersons, setRegisteredPersons] = useState([]);

  useEffect(() => {
    fetchRegisteredPersons();
  }, []);

  useEffect(() => {
    if (!useCamera) return;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        setMessage(`Camera error: ${err.message}`);
      }
    };
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, [useCamera]);

  const fetchRegisteredPersons = async () => {
    try {
      const res = await fetchRegisteredPersonsForFamily();
      setRegisteredPersons(res.data || []);
    } catch (error) {
      console.error('Failed to fetch registered persons:', error);
    }
  };

  const handleFileChange = (e) => setFiles(Array.from(e.target.files || []));

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFiles((prev) => [...prev, file]);
      }
    }, 'image/jpeg', 0.85);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!name || !age || !relation) {
      setMessage('Please fill name, age, and relation.');
      return;
    }
    if (!files.length) {
      setMessage('Please upload or capture at least one image.');
      return;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('age', age);
    formData.append('relation', relation);
    files.forEach((file) => formData.append('images', file));

    setLoading(true);
    try {
      const res = await submitFamilyPersonRegistration(formData);
      const counts = res.counts || {};
      const countsText = Object.entries(counts).map(([model, count]) => `${model}: ${count}`).join(' - ');
      setMessage(`Success: ${res.message || 'Registered'} (${countsText})`);
      setName('');
      setAge('');
      setRelation('');
      setFiles([]);
      fetchRegisteredPersons();
    } catch (err) {
      setMessage(`Error: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Register Person</h1>
        <p className="text-gray-400 mt-1.5">
          Add a person to the face recognition system for {user?.patient?.firstName || 'your patient'}. Upload multiple images for better accuracy.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col text-sm font-semibold text-gray-300">
              Name
              <input
                className="mt-1.5 rounded-xl bg-white/[0.05] border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Full name"
              />
            </label>
            <label className="flex flex-col text-sm font-semibold text-gray-300">
              Age
              <input
                type="number"
                className="mt-1.5 rounded-xl bg-white/[0.05] border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                placeholder="Age"
                min="0"
              />
            </label>
            <label className="flex flex-col text-sm font-semibold text-gray-300">
              Relation
              <input
                className="mt-1.5 rounded-xl bg-white/[0.05] border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all"
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                required
                placeholder="e.g., Son, Daughter"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-gray-300 text-sm">Upload images</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setUseCamera((p) => !p)}
              className="px-4 py-2.5 bg-white/[0.05] text-white rounded-xl hover:bg-white/[0.08] transition-colors border border-white/10 text-sm"
            >
              {useCamera ? 'Stop Webcam' : 'Use Webcam'}
            </button>
            {useCamera && (
              <button
                type="button"
                onClick={captureFrame}
                className="px-4 py-2.5 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors text-sm"
              >
                Capture Snapshot
              </button>
            )}
            <span className="text-sm text-gray-400">{files.length} image(s) selected</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Registering...
              </>
            ) : (
              'Register Person'
            )}
          </button>

          {message && (
            <div
              className={`rounded-xl p-3 text-sm ${
                message.startsWith('Success')
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}
            >
              {message}
            </div>
          )}
        </form>

        {/* Camera / Preview */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-black/50 border border-white/[0.08] aspect-video">
            {useCamera ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500 text-sm">
                Webcam disabled
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {files.length > 0 && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
              <p className="mb-3 text-sm font-semibold text-gray-300">Selected images</p>
              <div className="grid grid-cols-3 gap-2">
                {files.map((file, idx) => (
                  <div key={file.name + idx} className="overflow-hidden rounded-xl border border-white/10">
                    <img src={URL.createObjectURL(file)} alt="preview" className="h-24 w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Registered Persons */}
      {registeredPersons.length > 0 && (
        <section className="mt-8 bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
          <h3 className="text-lg font-bold text-white mb-4">
            Registered Persons ({registeredPersons.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registeredPersons.map((person) => (
              <div key={person.id} className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {person.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-white">{person.name}</p>
                    <p className="text-sm text-gray-400">
                      {person.relation} &bull; Age {person.age}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {person.enrolledModels.map((model) => (
                    <span
                      key={model}
                      className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full"
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
};

export default RegisterPerson;
