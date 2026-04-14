import React, { useRef, useEffect, useMemo, useState } from 'react';
import { BrainIcon } from '../../../shared/icons';
import { askChatbot } from '../../../../modules/chatbot/services/chatbotService';
import { patientsAPI } from '../../../../modules/shared/api/api';

const SEED_MESSAGES = [
  {
    id: 1,
    sender: 'assistant',
    text: 'Hello Doctor! Ask me any Alzheimer\'s question, or select a patient for personalized insights.',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
];

const MODE_BADGE = {
  patient: 'bg-green-500/15 text-green-300 border-green-500/30',
  general: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
};

const DoctorChatbotWidget = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [activeMode, setActiveMode] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(SEED_MESSAGES);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    patientsAPI
      .getAll({ status: 'active' })
      .then((res) => setPatients(res.data || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !isTyping,
    [input, isTyping],
  );

  const handlePatientChange = (e) => {
    const id = e.target.value;
    setSelectedPatientId(id);
    if (id) {
      const p = patients.find((pt) => pt._id === id);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'assistant',
          text: `Patient context set: ${p ? `${p.firstName} ${p.lastName}` : id}. What would you like to know?`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'assistant',
          text: 'Switched to General Mode. Ask any Alzheimer\'s or dementia question.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
    setActiveMode(null);
  };

  const handleSend = async () => {
    if (!canSend) return;
    const text = input.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: Date.now(), sender: 'user', text, time }]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await askChatbot(text, selectedPatientId || null);
      setActiveMode(result.mode);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: result.answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          mode: result.mode,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `⚠️ ${err.message || 'Could not reach the AI service.'}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="w-full max-w-3xl bg-[#150928] border border-white/15 rounded-2xl shadow-2xl shadow-purple-900/20 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-purple-600/20 to-violet-600/20 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
          <BrainIcon />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white">ALZCare AI Assistant</p>
          <p className="text-xs text-gray-400">Doctor Copilot</p>
        </div>
        {activeMode && (
          <span className={`px-2 py-0.5 rounded-full text-xs border ${MODE_BADGE[activeMode] ?? ''}`}>
            {activeMode === 'patient' ? 'Patient Mode' : 'General Mode'}
          </span>
        )}
      </div>

      {/* Patient selector */}
      <div className="px-4 pt-3 pb-2 border-b border-white/10 bg-[#1b0e2f]">
        <select
          value={selectedPatientId}
          onChange={handlePatientChange}
          className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
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
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[260px] max-h-[380px]">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.sender === 'user'
                  ? 'bg-purple-600 text-white rounded-br-md'
                  : m.isError
                  ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-bl-md'
                  : 'bg-white/[0.06] text-gray-100 rounded-bl-md border border-white/10'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              <p className="mt-1 text-[10px] opacity-70">{m.time}{m.mode ? ` · ${m.mode}` : ''}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl rounded-bl-md px-3 py-2">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" />
                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10 bg-[#10071f]">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) handleSend();
            }}
            disabled={isTyping}
            placeholder={
              selectedPatientId
                ? 'Ask about this patient…'
                : 'Ask any Alzheimer\'s question…'
            }
            className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctorChatbotWidget;
