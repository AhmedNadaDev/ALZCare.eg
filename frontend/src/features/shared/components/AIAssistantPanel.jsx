import React, { useRef, useEffect, useMemo, useState } from 'react';
import { BrainIcon } from '../icons';
import { askChatbot } from '../../../modules/chatbot/services/chatbotService';

const buildWelcomeMessage = (roleLabel, patientId) => ({
  id: 1,
  sender: 'assistant',
  text: patientId
    ? `Hello ${roleLabel}! Patient context is active. You can ask personalized questions about this patient's care, medications, and history.`
    : `Hello ${roleLabel}! I'm your general Alzheimer's & dementia medical assistant. Ask me anything — or select a patient above for personalized insights.`,
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
});

// Mode badge config
const MODE_CONFIG = {
  patient: { label: 'Patient Mode', classes: 'bg-green-500/15 text-green-300 border-green-500/30' },
  family:  { label: 'Family Mode',  classes: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  general: { label: 'General Mode', classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  idle:    { label: 'Ready',        classes: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
};

const AIAssistantPanel = ({ roleLabel = 'User', patientId = null, patientName = null }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState('idle'); // 'idle' | 'patient' | 'general'
  const [messages, setMessages] = useState(() => [buildWelcomeMessage(roleLabel, patientId)]);

  const messagesEndRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset chat when patient selection changes
  useEffect(() => {
    setActiveMode('idle');
    setMessages([buildWelcomeMessage(roleLabel, patientId)]);
  }, [patientId, roleLabel]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !isLoading,
    [input, isLoading],
  );

  const handleSend = async () => {
    if (!canSend) return;

    const text = input.trim();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [...prev, { id: Date.now(), sender: 'user', text, time: now }]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await askChatbot(text, patientId || null);

      setActiveMode(result.mode || (patientId ? 'patient' : 'general'));

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
          text: `⚠️ ${err.message || 'An unexpected error occurred.'}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const modeBadge = MODE_CONFIG[activeMode] ?? MODE_CONFIG.idle;
  const statusLabel = patientId
    ? (patientName ?? 'Patient selected')
    : 'No patient · General mode';

  return (
    <section className="space-y-5">
      {/* Header card */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-700/20 to-violet-700/20 p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-200 flex items-center justify-center">
            <BrainIcon />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
            <p className="text-sm text-gray-300 mt-1">
              {patientId
                ? 'Personalized clinical assistant — patient context active.'
                : 'General Alzheimer\'s & dementia knowledge assistant.'}
            </p>
          </div>
        </div>
      </div>

      {/* Chat card */}
      <div className="rounded-2xl border border-white/10 bg-[#140923] shadow-xl shadow-purple-900/20 overflow-hidden">
        {/* Chat header */}
        <div className="px-5 py-3 border-b border-white/10 bg-[#1b0e2f] flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-white text-sm">ALZCare Assistant</p>
            <p className="text-xs text-gray-400">{roleLabel} Workspace · {statusLabel}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs border whitespace-nowrap ${modeBadge.classes}`}>
            {modeBadge.label}
          </span>
        </div>

        <div className="h-[60vh] min-h-[420px] flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} transition-all`}
              >
                <article
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-br-md'
                      : msg.isError
                      ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-bl-md'
                      : 'bg-white/[0.05] border border-white/10 text-gray-100 rounded-bl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <div className="mt-2 flex items-center gap-2 opacity-70">
                    <span className="text-[10px]">{msg.time}</span>
                    {msg.mode && (
                      <span className="text-[9px] uppercase tracking-wide">
                        · {msg.mode} mode
                      </span>
                    )}
                  </div>
                </article>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.05] border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-gray-300 rounded-full animate-bounce" />
                    <span className="h-1.5 w-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:240ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-white/10 bg-[#10071d] p-4">
            {!patientId && (
              <p className="text-xs text-blue-400/70 mb-2 text-center">
                General mode — select a patient above for personalized answers.
              </p>
            )}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) handleSend();
                }}
                disabled={isLoading}
                placeholder={
                  patientId
                    ? 'Ask about this patient\'s care, medications, or history…'
                    : 'Ask any Alzheimer\'s or dementia question…'
                }
                className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/35 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIAssistantPanel;
