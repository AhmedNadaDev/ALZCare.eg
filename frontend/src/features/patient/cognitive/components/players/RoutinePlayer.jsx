import React, { useState } from 'react';

/**
 * RoutinePlayer — order the steps of a daily routine correctly.
 * Patient taps steps in sequence; chosen steps move to a numbered list.
 */
const RoutinePlayer = ({ content, onFinish }) => {
  const allSteps = content.steps || [];
  const [order, setOrder] = useState([]); // step ids in chosen order

  const remaining = allSteps.filter((s) => !order.includes(s.id));
  const labelOf = (id) => allSteps.find((s) => s.id === id)?.label;

  const pick = (id) => setOrder((o) => [...o, id]);
  const undo = () => setOrder((o) => o.slice(0, -1));

  const done = () => onFinish([{ kind: 'answer', meta: { order } }]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">📋 Put these in order</h2>
      <p className="text-gray-300 mb-6 text-center">Tap each step in the order you would do it.</p>

      {/* Chosen order */}
      {order.length > 0 && (
        <div className="w-full mb-5 space-y-2">
          {order.map((id, i) => (
            <div key={id} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-500/15 border-2 border-purple-500/30">
              <span className="w-8 h-8 shrink-0 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">{i + 1}</span>
              <span className="text-lg sm:text-xl text-white">{labelOf(id)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Remaining choices */}
      <div className="w-full grid grid-cols-1 gap-2.5">
        {remaining.map((s) => (
          <button
            key={s.id}
            onClick={() => pick(s.id)}
            className="min-h-[60px] px-5 py-3.5 rounded-2xl border-2 border-white/15 bg-white/8 text-white text-lg sm:text-xl font-semibold hover:bg-white/15 transition"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        {order.length > 0 && (
          <button onClick={undo} className="px-5 py-2.5 rounded-xl border border-white/15 text-gray-300 hover:text-white">↩ Undo</button>
        )}
        {remaining.length === 0 && (
          <button onClick={done} className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 text-white text-lg font-bold">Done ✓</button>
        )}
      </div>
    </div>
  );
};

export default RoutinePlayer;
