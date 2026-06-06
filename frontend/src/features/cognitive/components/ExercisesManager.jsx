import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cognitiveAPI } from '../../../modules/shared/api/api';
import { EXERCISE_META, DIFFICULTIES, EmptyState, btnGhost, CATEGORY_META } from '../constants.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faSpinner, faCircleCheck } from '@fortawesome/free-solid-svg-icons';

// ── Sub-components ───────────────────────────────────────────────────────────

const Toggle = ({ on, onChange, label, disabled }) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={label}
    type="button"
    onClick={() => !disabled && onChange(!on)}
    disabled={disabled}
    className={`relative w-11 h-6 rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    } ${on ? 'bg-purple-600' : 'bg-white/15'}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
        on ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const DifficultyPicker = ({ value, onChange, disabled }) => (
  <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
    {DIFFICULTIES.map((d) => (
      <button
        key={d}
        type="button"
        onClick={() => !disabled && value !== d && onChange(d)}
        disabled={disabled}
        aria-pressed={value === d}
        className={`px-3 py-1 text-xs capitalize transition-colors ${
          value === d
            ? 'bg-purple-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        {d}
      </button>
    ))}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

/**
 * ExercisesManager — assign / configure cognitive exercises and album
 * activities for the patient.
 *
 * Performance design:
 *   - localAssignments mirrors the parent prop and is the UI source of truth.
 *   - Every mutation applies an optimistic update to localAssignments BEFORE
 *     the network request, giving <16ms visual response.
 *   - refetchAssignments() is called fire-and-forget AFTER the mutation
 *     succeeds so the parent stays in sync without blocking the UI.
 *   - On failure the optimistic change is reverted and an error is shown.
 *   - exerciseAssignments, albumAssignments and find* helpers are memoized
 *     so setBusy() re-renders don't trigger unnecessary recomputation.
 */
const ExercisesManager = ({ patientId, templates, assignments, albums, refetchAssignments }) => {
  // Local state — optimistic mutations write here, not to the parent
  const [localAssignments, setLocalAssignments] = useState(assignments);
  // Busy key: string while one action is in flight, null otherwise
  const [busy, setBusy] = useState(null);
  const [runErr, setRunErr] = useState(null);

  // Keep local state in sync when the parent prop changes
  // (happens after a background refetch completes)
  useEffect(() => {
    setLocalAssignments(assignments);
  }, [assignments]);

  // Memoized derivations — only recompute when localAssignments changes,
  // not on busy/error state changes
  const exerciseAssignments = useMemo(
    () => localAssignments.filter((a) => a.kind === 'exercise'),
    [localAssignments],
  );
  const albumAssignments = useMemo(
    () => localAssignments.filter((a) => a.kind === 'album'),
    [localAssignments],
  );

  const findExAssignment = useCallback(
    (tplId) =>
      exerciseAssignments.find(
        (a) => (a.exerciseTemplate?._id || a.exerciseTemplate) === tplId,
      ),
    [exerciseAssignments],
  );
  const findAlbumAssignment = useCallback(
    (albumId) =>
      albumAssignments.find((a) => (a.album?._id || a.album) === albumId),
    [albumAssignments],
  );

  // ── OPTIMISTIC TOGGLE (enable / disable) ─────────────────────────────────
  // Flip the UI immediately, fire the request in background.
  // Revert on failure.
  const toggleEnabled = useCallback(
    async (assignment, newEnabled) => {
      const key = `en-${assignment._id}`;
      if (busy === key) return;
      setBusy(key);
      setRunErr(null);

      // --- INSTANT visual update ---
      setLocalAssignments((prev) =>
        prev.map((a) =>
          a._id === assignment._id ? { ...a, enabled: newEnabled } : a,
        ),
      );

      try {
        await cognitiveAPI.setAssignmentEnabled(assignment._id, newEnabled);
        refetchAssignments().catch(() => {}); // background sync, non-blocking
      } catch (e) {
        // Revert optimistic change
        setLocalAssignments((prev) =>
          prev.map((a) =>
            a._id === assignment._id ? { ...a, enabled: !newEnabled } : a,
          ),
        );
        setRunErr(e.message || 'Failed to update. Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [busy, refetchAssignments],
  );

  // ── OPTIMISTIC DIFFICULTY CHANGE ──────────────────────────────────────────
  const changeDifficulty = useCallback(
    async (assignment, newDifficulty) => {
      const key = `df-${assignment._id}`;
      if (busy === key) return;
      const prev = assignment.difficulty;
      setBusy(key);
      setRunErr(null);

      // --- INSTANT visual update ---
      setLocalAssignments((list) =>
        list.map((a) =>
          a._id === assignment._id ? { ...a, difficulty: newDifficulty } : a,
        ),
      );

      try {
        await cognitiveAPI.updateAssignment(assignment._id, { difficulty: newDifficulty });
        refetchAssignments().catch(() => {});
      } catch (e) {
        // Revert
        setLocalAssignments((list) =>
          list.map((a) =>
            a._id === assignment._id ? { ...a, difficulty: prev } : a,
          ),
        );
        setRunErr(e.message || 'Failed to update difficulty. Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [busy, refetchAssignments],
  );

  // ── ACTIVATE EXERCISE ─────────────────────────────────────────────────────
  // Cannot be fully optimistic (need the server-generated _id).
  // Shows spinner immediately; inserts the returned assignment from the
  // server response so only ONE network trip updates the UI.
  const activateExercise = useCallback(
    async (tplId) => {
      const key = `add-${tplId}`;
      if (busy === key) return;
      setBusy(key);
      setRunErr(null);

      try {
        const res = await cognitiveAPI.assignExercise(patientId, {
          exerciseTemplateId: tplId,
          difficulty: 'easy',
        });
        // Insert from server response — no second GET needed
        if (res?.data) {
          setLocalAssignments((prev) => [...prev, res.data]);
        }
        refetchAssignments().catch(() => {});
      } catch (e) {
        setRunErr(e.message || 'Failed to activate exercise. Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [busy, patientId, refetchAssignments],
  );

  // ── ACTIVATE ALBUM SESSION ────────────────────────────────────────────────
  const activateAlbum = useCallback(
    async (albumId) => {
      const key = `alAdd-${albumId}`;
      if (busy === key) return;
      setBusy(key);
      setRunErr(null);

      try {
        const res = await cognitiveAPI.assignAlbum(patientId, { albumId });
        if (res?.data) {
          setLocalAssignments((prev) => [...prev, res.data]);
        }
        refetchAssignments().catch(() => {});
      } catch (e) {
        setRunErr(e.message || 'Failed to assign album. Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [busy, patientId, refetchAssignments],
  );

  // ── OPTIMISTIC REMOVE ─────────────────────────────────────────────────────
  // Remove from UI immediately; restore on failure.
  const removeAssignment = useCallback(
    async (assignment) => {
      const key = `rm-${assignment._id}`;
      if (busy === key) return;
      setBusy(key);
      setRunErr(null);

      // --- INSTANT visual removal ---
      setLocalAssignments((prev) => prev.filter((a) => a._id !== assignment._id));

      try {
        await cognitiveAPI.deleteAssignment(assignment._id);
        refetchAssignments().catch(() => {});
      } catch (e) {
        // Restore the removed assignment
        setLocalAssignments((prev) => [...prev, assignment]);
        setRunErr(e.message || 'Failed to remove. Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [busy, refetchAssignments],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10">
      {runErr && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {runErr}
        </div>
      )}

      {/* ── Cognitive Exercises ── */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-1">Cognitive Exercises</h3>
        <p className="text-sm text-gray-400 mb-5">
          Turn exercises on or off and set their difficulty for this patient.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => {
            const meta       = EXERCISE_META[tpl.type] || {};
            const assignment = findExAssignment(tpl._id);
            const enabled    = !!assignment?.enabled;

            // Per-button busy flags
            const isAddBusy = busy === `add-${tpl._id}`;
            const isEnBusy  = assignment && busy === `en-${assignment._id}`;
            const isDfBusy  = assignment && busy === `df-${assignment._id}`;
            const isRmBusy  = assignment && busy === `rm-${assignment._id}`;
            const isCardBusy = isEnBusy || isDfBusy || isRmBusy;

            return (
              <div
                key={tpl._id}
                className={`rounded-2xl border p-4 transition-colors ${
                  assignment
                    ? 'border-purple-500/30 bg-purple-500/[0.06]'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${
                      meta.gradient || 'from-purple-600 to-violet-600'
                    } flex items-center justify-center text-2xl`}
                  >
                    {meta.emoji || '🧠'}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-white">{tpl.name}</h4>
                      {assignment && (
                        <Toggle
                          on={enabled}
                          label={`${enabled ? 'Disable' : 'Enable'} ${tpl.name}`}
                          disabled={isEnBusy || isRmBusy}
                          onChange={(v) => toggleEnabled(assignment, v)}
                        />
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {tpl.description}
                    </p>

                    {/* Action row */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {assignment ? (
                        <>
                          <DifficultyPicker
                            value={assignment.difficulty}
                            disabled={isDfBusy || isRmBusy}
                            onChange={(d) => changeDifficulty(assignment, d)}
                          />

                          <button
                            type="button"
                            disabled={isRmBusy || isCardBusy}
                            onClick={() => removeAssignment(assignment)}
                            className="text-xs text-red-300 hover:text-red-200 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                          >
                            {isRmBusy ? (
                              <FontAwesomeIcon
                                icon={faSpinner}
                                className="w-3 h-3 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <FontAwesomeIcon
                                icon={faTrash}
                                className="w-3 h-3"
                                aria-hidden="true"
                              />
                            )}
                            {isRmBusy ? 'Removing…' : 'Remove'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isAddBusy}
                          onClick={() => activateExercise(tpl._id)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"
                        >
                          {isAddBusy ? (
                            <FontAwesomeIcon
                              icon={faSpinner}
                              className="w-3 h-3 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <FontAwesomeIcon
                              icon={faCircleCheck}
                              className="w-3 h-3"
                              aria-hidden="true"
                            />
                          )}
                          {isAddBusy ? 'Activating…' : 'Activate for patient'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Memory Sessions (Albums as activities) ── */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-1">Memory Sessions</h3>
        <p className="text-sm text-gray-400 mb-5">
          Make an album available as a guided memory session for the patient.
        </p>
        {albums.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No albums to assign"
            hint="Create albums in the Albums tab first."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {albums.map((al) => {
              const assignment = findAlbumAssignment(al._id);
              const enabled    = !!assignment?.enabled;
              const isAddBusy  = busy === `alAdd-${al._id}`;
              const isEnBusy   = assignment && busy === `en-${assignment._id}`;

              return (
                <div
                  key={al._id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">
                      {CATEGORY_META[al.category]?.emoji} {al.title}
                    </p>
                    <p className="text-xs text-gray-400">{al.itemCount || 0} memories</p>
                  </div>

                  {assignment ? (
                    <Toggle
                      on={enabled}
                      label={`${enabled ? 'Disable' : 'Enable'} ${al.title}`}
                      disabled={isEnBusy}
                      onChange={(v) => toggleEnabled(assignment, v)}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={isAddBusy}
                      onClick={() => activateAlbum(al._id)}
                      className={`${btnGhost} disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5`}
                    >
                      {isAddBusy && (
                        <FontAwesomeIcon
                          icon={faSpinner}
                          className="w-3 h-3 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      {isAddBusy ? 'Assigning…' : 'Assign'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default ExercisesManager;
