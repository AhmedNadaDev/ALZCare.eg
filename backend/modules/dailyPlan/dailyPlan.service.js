import DailyPlan from './dailyPlan.model.js';
import Patient from '../../models/Patient.model.js';
import Notification from '../../models/Notification.model.js';
import Medication from '../../models/Medication.model.js';
import { emitToPatientRoom } from '../socket/socketManager.js';
import { cancelPlanTimers, scheduleForPlan } from './dailyPlan.scheduler.js';
import axios from 'axios';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getDayBounds = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end   = new Date(d); end.setHours(23, 59, 59, 999);
  return { start, end };
};

/** Emit plan state to all room members and re-schedule timers. */
const syncPlan = (plan, eventName = 'dailyPlan:updated') => {
  if (!plan) return;
  const patientId = plan.patientId?._id?.toString() ?? plan.patientId?.toString();
  emitToPatientRoom(patientId, eventName, { plan: plan.toObject ? plan.toObject() : plan });
  cancelPlanTimers(plan);
  scheduleForPlan(plan);
};

// ── Rule-based signal definitions (context-aware) ─────────────────────────────

// Each pattern carries a weight: 3 = strong signal, 2 = moderate, 1 = weak.
const RULE_SIGNALS = {
  confirm: [
    { re: /\b(yes|yeah|yep|yup|yah|affirmative)\b/,               w: 3 },
    { re: /\b(took|taken|have taken|already taken|just took)\b/,  w: 3 },
    { re: /\b(done|completed|finished|did it|did that|did)\b/,    w: 3 },
    { re: /\b(just did|just had|just eaten|just swallowed)\b/,    w: 3 },
    { re: /\b(already|earlier|before|just now|a while ago)\b/,    w: 2 },
    { re: /\b(sure|certainly|of course|indeed|absolutely)\b/,     w: 2 },
    { re: /\b(ok|okay|alright)\b/,                                 w: 1 }, // weak — could be filler
    { re: /\b(good|great|fine)\b/,                                 w: 1 }, // weak — override by context
  ],
  confirm_wakeup: [
    // Extra signals only for wake_up events
    { re: /\b(awake|up|woke|woken|risen|out of bed|standing)\b/, w: 3 },
    { re: /\b(morning|good morning|i'm here|here)\b/,             w: 2 },
    { re: /\b(ready|dressed|showered)\b/,                         w: 2 },
  ],
  deny: [
    { re: /\b(no|nope|nah|negative|nay)\b/,                       w: 3 },
    { re: /\b(didn'?t|did not|have not|haven'?t|hasn'?t)\b/,     w: 3 },
    { re: /\b(not yet|not done|not taken|not finished)\b/,        w: 3 },
    { re: /\b(skip|skipped|missed|failed to|refused|refuse)\b/,   w: 3 },
    { re: /\b(can'?t|cannot|won'?t|unable to)\b/,                 w: 2 },
    { re: /\b(later|not now|not right now|in a bit)\b/,           w: 2 },
    { re: /\b(don'?t want|don'?t feel like)\b/,                   w: 2 },
  ],
  forgot: [
    { re: /\b(forgot|forget|forgotten)\b/,                                    w: 3 },
    { re: /\b(don'?t remember|can'?t remember|don'?t recall|can'?t recall)\b/, w: 3 },
    { re: /\b(slipped my mind|lost track|wasn'?t thinking)\b/,               w: 3 },
    { re: /\b(not sure if i|unsure if i|don'?t know if i)\b/,               w: 2 },
  ],
  feeling_bad: [
    // Health signals — highest priority; always escalate
    { re: /\b(sick|ill|unwell|not well|not feeling well|feel terrible)\b/, w: 3 },
    { re: /\b(pain|painful|hurts|hurting|ache|aching|sore)\b/,            w: 3 },
    { re: /\b(dizzy|dizziness|vertigo|spinning|off balance)\b/,           w: 3 },
    { re: /\b(tired|exhausted|fatigue|fatigued|weak|no energy)\b/,        w: 3 },
    { re: /\b(nausea|nauseous|vomit|vomiting|throwing up|sick to)\b/,     w: 3 },
    { re: /\b(headache|migraine|head hurts)\b/,                           w: 3 },
    { re: /\b(fell|fallen|fall down|lost balance|stumbled)\b/,            w: 3 },
    { re: /\b(bleed|bleeding|bruise|bruised|injury|injured)\b/,           w: 3 },
    { re: /\b(trouble breathing|can'?t breathe|short of breath|chest)\b/, w: 3 },
    { re: /\b(help|emergency|urgent|call someone|call doctor)\b/,         w: 3 },
    { re: /\b(bad|terrible|awful|horrible|miserable|awful)\b/,            w: 2 },
    { re: /\b(swollen|swelling|rash)\b/,                                  w: 3 },
  ],
  confused: [
    { re: /\b(what|huh|pardon|sorry|confused|confusing)\b/,        w: 2 },
    { re: /\b(don'?t understand|can'?t understand|unclear)\b/,     w: 3 },
    { re: /\b(which one|what do you mean|what medication)\b/,       w: 2 },
    { re: /\b(again|say that again|repeat|one more time)\b/,        w: 2 },
    { re: /\b(who|where|when)\b/,                                   w: 1 },
  ],
};

// Negation words that can flip a confirm signal into deny
const NEGATION_RE = /\b(not|never|haven'?t|hasn'?t|didn'?t|don'?t|won'?t|can'?t|couldn'?t|isn'?t|aren'?t|wasn'?t|weren'?t|no)\b/;

// Filler words that carry no signal
const FILLER_RE = /\b(um|uh|hmm|err|well|like|i mean|you know|so|just|actually|basically|honestly|literally)\b/g;

// ── Service ───────────────────────────────────────────────────────────────────

class DailyPlanService {

  // ── CRUD methods (unchanged) ───────────────────────────────────────────────

  async upsertDailyPlan({ patientId, date, events, createdById, createdByModel }) {
    const patient = await Patient.findById(patientId);
    if (!patient) throw { status: 404, message: 'Patient not found' };

    const { start } = getDayBounds(date);

    const plan = await DailyPlan.findOneAndUpdate(
      { patientId, date: start },
      { $set: { patientId, date: start, createdBy: createdById, createdByModel } },
      { upsert: true, new: true }
    );

    if (events && Array.isArray(events)) {
      plan.events = events;
      await plan.save();
    }

    syncPlan(plan, 'dailyPlan:updated');
    return plan;
  }

  async addEventsToPlan({ patientId, date, events, createdById, createdByModel }) {
    const patient = await Patient.findById(patientId);
    if (!patient) throw { status: 404, message: 'Patient not found' };

    const { start } = getDayBounds(date);
    let plan = await DailyPlan.findOne({ patientId, date: start });

    if (!plan) {
      plan = await DailyPlan.create({
        patientId,
        date: start,
        events: events || [],
        createdBy: createdById,
        createdByModel
      });
    } else if (events?.length) {
      plan.events.push(...events);
      await plan.save();
    }

    syncPlan(plan, 'dailyPlan:updated');
    return plan;
  }

  async injectMedicationEvent({ patientId, medicationId, medicationName, scheduledTime, date, createdById, createdByModel }) {
    const { start } = getDayBounds(date);

    const existing = await DailyPlan.findOne({
      patientId,
      date: start,
      'events.medicationId': medicationId,
      'events.scheduledTime': scheduledTime
    });
    if (existing) return existing;

    const event = {
      title: `Take ${medicationName}`,
      type: 'medication',
      scheduledTime,
      status: 'pending',
      voicePrompt: {
        text: `It's time to take your medication: ${medicationName}. Did you take it?`,
        requireResponse: true
      },
      medicationId
    };

    return this.addEventsToPlan({ patientId, date, events: [event], createdById, createdByModel });
  }

  async getTodayPlan(patientId) {
    const patient = await Patient.findById(patientId);
    if (!patient) throw { status: 404, message: 'Patient not found' };

    const { start, end } = getDayBounds();
    return DailyPlan.findOne({ patientId, date: { $gte: start, $lte: end } })
      .populate('patientId', 'firstName lastName patientNumber');
  }

  async getPlanByDate(patientId, dateStr) {
    const { start, end } = getDayBounds(dateStr);
    return DailyPlan.findOne({ patientId, date: { $gte: start, $lte: end } });
  }

  async manualConfirmEvent({ planId, eventId, status }) {
    const plan = await DailyPlan.findById(planId);
    if (!plan) throw { status: 404, message: 'Daily plan not found' };

    const event = plan.events.id(eventId);
    if (!event) throw { status: 404, message: 'Event not found' };

    event.status = status;
    if (status === 'completed') {
      event.completedAt = new Date();
      if (!event.response) event.response = {};
      event.response.confirmed    = true;
      event.response.respondedAt  = new Date();
      event.response.decisionSource = 'manual';
      event.response.riskLevel    = 'low';
      event.response.reasoning    = 'Manually confirmed by family/caregiver';
    } else {
      if (!event.response) event.response = {};
      event.response.decisionSource = 'manual';
      event.response.riskLevel    = 'medium';
      event.response.reasoning    = 'Manually marked as missed by family/caregiver';
    }

    await plan.save();

    // Back-sync medication log if this event is linked to a medication
    if (event.medicationId) {
      await this._syncMedicationLog(event.medicationId, event.scheduledTime, status === 'completed' ? 'taken' : 'missed');
      if (status === 'missed') {
        await this._notifyFamilyMissed({ plan, event });
      }
    }

    syncPlan(plan, status === 'completed' ? 'event:completed' : 'event:missed');
    return { plan, event };
  }

  async deleteEvent({ planId, eventId }) {
    const plan = await DailyPlan.findById(planId);
    if (!plan) throw { status: 404, message: 'Daily plan not found' };

    plan.events = plan.events.filter(e => e._id.toString() !== eventId);
    await plan.save();
    syncPlan(plan, 'dailyPlan:updated');
    return plan;
  }

  async updateEvent({ planId, eventId, updateData }) {
    const plan = await DailyPlan.findById(planId);
    if (!plan) throw { status: 404, message: 'Daily plan not found' };

    const event = plan.events.id(eventId);
    if (!event) throw { status: 404, message: 'Event not found' };

    const allowed = ['title', 'scheduledTime', 'voicePrompt', 'type'];
    allowed.forEach(field => {
      if (updateData[field] !== undefined) event[field] = updateData[field];
    });

    await plan.save();
    syncPlan(plan, 'dailyPlan:updated');
    return { plan, event };
  }

  // ── Core decision pipeline ─────────────────────────────────────────────────

  /**
   * Main entry point for voice response analysis.
   * Always produces a definitive, structured decision.
   */
  async respondToEvent({ planId, eventId, responseText }) {
    // ── 1. Load & validate state ─────────────────────────────────────────────
    const plan = await DailyPlan.findById(planId)
      .populate('patientId', 'firstName lastName family');
    if (!plan) throw { status: 404, message: 'Daily plan not found' };

    const event = plan.events.id(eventId);
    if (!event) throw { status: 404, message: 'Event not found' };

    // State machine guard — prevent invalid transitions
    if (event.status !== 'pending') {
      throw { status: 400, message: `Event already resolved (status: ${event.status})` };
    }

    // ── 2. Input validation ──────────────────────────────────────────────────
    const rawText = (responseText || '').trim();

    if (!rawText) {
      // No text at all → deterministic miss, no AI needed
      const decision = this._buildDecision({
        intent:         'deny_taken',
        confidence:     0,
        action:         'mark_missed',
        decisionSource: 'fallback',
        reasoning:      'No response text provided — automatic missed',
        eventType:      event.type,
      });
      return this._finalise({ plan, event, decision, rawText });
    }

    // ── 3. Rule-based detection (always runs first) ──────────────────────────
    const ruleResult = this._detectByRules(rawText, event.type);

    // ── 4. Hybrid AI fallback for ambiguous cases ────────────────────────────
    // Trigger AI when: confidence is below threshold OR action is ask_again
    const needsAI = ruleResult.confidence < 0.65 || ruleResult.action === 'ask_again';
    let decision  = ruleResult;

    if (needsAI) {
      try {
        const aiResult = await this._callAIAnalyze(rawText, event.type, event.title);
        decision = this._combineDecisions(ruleResult, aiResult);
      } catch (err) {
        console.warn(`[DailyPlan] AI service unavailable (${err.message}) — using rule result with reduced confidence`);
        decision = {
          ...ruleResult,
          confidence: Math.max(ruleResult.confidence * 0.85, 0.3),
          reasoning:  ruleResult.reasoning + ' [AI unavailable — confidence reduced]',
        };
      }
    }

    // ── 5. Decision guarantee layer ──────────────────────────────────────────
    // Hard guarantee: never allow unknown/invalid/no-action to exit pipeline.
    decision = this._guaranteeDecision(decision, event.type, rawText);

    // ── 6. Risk assessment ───────────────────────────────────────────────────
    decision = this._buildDecision({ ...decision, eventType: event.type });

    return this._finalise({ plan, event, decision, rawText });
  }

  /** Persist, emit, log, and return structured result. */
  async _finalise({ plan, event, decision, rawText }) {
    // ── 7. Persist response with full audit trail ─────────────────────────────
    event.response = {
      text:          rawText || null,
      confirmed:     decision.intent === 'confirm_taken',
      respondedAt:   new Date(),
      aiIntent:      decision.intent,
      aiConfidence:  decision.confidence,
      aiAction:      decision.action,
      finalAction:   decision.action,
      decisionSource: decision.decisionSource,
      riskLevel:     decision.riskLevel,
      reasoning:     decision.reasoning,
    };

    // ── 8. State machine transition ───────────────────────────────────────────
    await this._applyAction({ action: decision.action, event, plan, decision });
    await plan.save();

    // ── 9. Real-time sync ─────────────────────────────────────────────────────
    const socketEvent =
      decision.action === 'mark_completed' ? 'event:completed' :
      decision.action === 'mark_missed'    ? 'event:missed'    :
                                             'dailyPlan:updated';
    syncPlan(plan, socketEvent);

    // ── 10. Decision trace log ────────────────────────────────────────────────
    console.log(
      `[DailyPlan] DECISION | ` +
      `event="${event.title}" type=${event.type} | ` +
      `text="${rawText.substring(0, 60)}${rawText.length > 60 ? '…' : ''}" | ` +
      `intent=${decision.intent} | ` +
      `confidence=${(decision.confidence * 100).toFixed(0)}% | ` +
      `action=${decision.action} | ` +
      `risk=${decision.riskLevel} | ` +
      `source=${decision.decisionSource} | ` +
      `reason="${decision.reasoning}"`
    );

    return {
      plan,
      event,
      // Structured response matching the required output format
      status:          decision.action,     // mark_completed | mark_missed | alert_family
      intent:          decision.intent,
      confidence:      Math.round(decision.confidence * 100), // 0-100 scale
      risk_level:      decision.riskLevel,
      decision_source: decision.decisionSource,
      reasoning:       decision.reasoning,
      // Legacy field (frontend reads this)
      action:          decision.action,
    };
  }

  // ── _detectByRules — multi-signal, context-aware, negation-safe ───────────

  /**
   * Pure rule-based detection with multi-signal scoring.
   *
   * Design principles:
   *  - Health signals (feeling_bad) take absolute priority
   *  - All signals are scored independently; highest score wins
   *  - Explicit negation in text flips confirm → deny when no other deny signal present
   *  - Confidence is computed from signal clarity ratio, not hardcoded
   *  - Returns a reasoning string for auditability
   */
  _detectByRules(text, eventType = 'medication') {
    const normalized = (text || '').toLowerCase().trim();

    // Empty input guard
    if (!normalized) {
      return {
        intent: 'deny_taken', confidence: 0, action: 'mark_missed',
        decisionSource: 'rule_engine',
        reasoning: 'Empty input — no signal to evaluate',
      };
    }

    // Remove filler words to reduce noise (preserve original for negation check)
    const clean = normalized.replace(FILLER_RE, ' ').replace(/\s+/g, ' ').trim();

    // Detect explicit negation in the ORIGINAL text
    const hasNegation = NEGATION_RE.test(normalized);

    // Score each signal bucket
    const score = (patterns) => {
      let total = 0;
      const hits = [];
      for (const { re, w } of patterns) {
        if (re.test(clean)) { total += w; hits.push(re.source.substring(3, 25)); }
      }
      return { total, hits };
    };

    // Base signal buckets
    const sc = {
      confirm:     score(RULE_SIGNALS.confirm),
      deny:        score(RULE_SIGNALS.deny),
      forgot:      score(RULE_SIGNALS.forgot),
      feeling_bad: score(RULE_SIGNALS.feeling_bad),
      confused:    score(RULE_SIGNALS.confused),
    };

    // Add context-specific confirm signals for wake_up events
    if (eventType === 'wake_up') {
      const wakeExtra = score(RULE_SIGNALS.confirm_wakeup);
      sc.confirm.total += wakeExtra.total;
      sc.confirm.hits  = sc.confirm.hits.concat(wakeExtra.hits);
    }

    // ── HEALTH PRIORITY GATE ─────────────────────────────────────────────────
    // Any meaningful health signal overrides all other signals immediately.
    if (sc.feeling_bad.total >= 2) {
      const conf = Math.min(0.55 + (sc.feeling_bad.total / 12) * 0.43, 0.98);
      return {
        intent: 'feeling_bad', confidence: conf, action: 'alert_family',
        decisionSource: 'rule_engine',
        reasoning: `Health signal detected (score=${sc.feeling_bad.total}): ${sc.feeling_bad.hits.slice(0, 3).join(', ')}`,
      };
    }
    // Weak health signal + no dominant competing signal → still alert
    if (sc.feeling_bad.total === 1) {
      const maxOther = Math.max(sc.confirm.total, sc.deny.total, sc.forgot.total);
      if (sc.feeling_bad.total >= maxOther * 0.5) {
        return {
          intent: 'feeling_bad', confidence: 0.65, action: 'alert_family',
          decisionSource: 'rule_engine',
          reasoning: `Weak health signal (score=1) with no dominant counter-signal`,
        };
      }
    }

    // ── NEGATION INVERSION ───────────────────────────────────────────────────
    // "I have not taken it" matches confirm ("have") but negation should flip it.
    if (hasNegation && sc.confirm.total > sc.deny.total && sc.deny.total === 0) {
      sc.deny.total   = sc.confirm.total;
      sc.confirm.total = 0;
    }

    // ── WINNER SELECTION ─────────────────────────────────────────────────────
    const candidates = [
      { key: 'confirm',     intent: 'confirm_taken', action: 'mark_completed', s: sc.confirm },
      { key: 'deny',        intent: 'deny_taken',    action: 'mark_missed',    s: sc.deny },
      { key: 'forgot',      intent: 'forgot',        action: 'mark_missed',    s: sc.forgot },
      { key: 'feeling_bad', intent: 'feeling_bad',   action: 'alert_family',   s: sc.feeling_bad },
      { key: 'confused',    intent: 'confused',      action: 'ask_again',      s: sc.confused },
    ];

    const winner = candidates.reduce((best, cur) => cur.s.total > best.s.total ? cur : best);

    if (winner.s.total === 0) {
      // No clear signal. Keep temporary clarify action; guarantee layer will
      // resolve to a deterministic final action if needed.
      return {
        intent: 'confused', confidence: 0.25, action: 'ask_again',
        decisionSource: 'rule_engine',
        reasoning: `No recognizable pattern in: "${clean.substring(0, 40)}"`,
      };
    }

    // ── CONFIDENCE CALCULATION ───────────────────────────────────────────────
    // Clarity ratio: winner score / total score across all buckets
    const totalScore = Object.values(sc).reduce((sum, s) => sum + s.total, 0);
    const clarity    = totalScore > 0 ? winner.s.total / totalScore : 0;
    // Base: 0.5 + clarity up to 0.48 → max 0.98
    let confidence   = Math.min(0.50 + clarity * 0.48, 0.98);
    // Penalty for very short texts (single word less reliable than full sentence)
    if (clean.length < 3)  confidence = Math.max(confidence - 0.15, 0.30);
    else if (clean.length < 8) confidence = Math.max(confidence - 0.05, 0.35);

    return {
      intent: winner.intent,
      confidence,
      action: winner.action,
      decisionSource: 'rule_engine',
      reasoning:
        `Rule "${winner.key}" won (score ${winner.s.total}/${totalScore}, clarity ${(clarity * 100).toFixed(0)}%)` +
        (hasNegation ? ' [negation detected]' : '') +
        (winner.s.hits.length ? ` — matched: ${winner.s.hits.slice(0, 3).join(', ')}` : ''),
    };
  }

  // ── _callAIAnalyze — sends full context to Python service ─────────────────

  async _callAIAnalyze(text, eventType, eventTitle = '') {
    const payload = {
      text,
      context:     eventType || 'medication',
      event_title: eventTitle || '',
    };
    const res = await axios.post(
      `${PYTHON_SERVICE_URL}/analyze`,
      payload,
      { timeout: 8000 }
    );
    // Normalize AI response — ensure all required fields exist
    const data = res.data || {};
    return {
      intent:         data.intent     || 'confused',
      confidence:     parseFloat(data.confidence) || 0.4,
      action:         data.action     || 'ask_again',
      reasoning:      data.reasoning  || 'AI model classification',
      decisionSource: 'ai_model',
    };
  }

  // ── _guaranteeDecision — deterministic final-action enforcement ───────────

  _guaranteeDecision(decision, eventType, rawText = '') {
    const text = (rawText || '').toLowerCase();
    const allowedActions = new Set(['mark_completed', 'mark_missed', 'alert_family', 'ask_again']);
    const allowedIntents = new Set(['confirm_taken', 'deny_taken', 'forgot', 'feeling_bad', 'confused']);

    const resolved = { ...decision };
    if (!allowedActions.has(resolved.action) || !resolved.action) resolved.action = 'ask_again';
    if (!allowedIntents.has(resolved.intent) || !resolved.intent) resolved.intent = 'confused';

    // Semantic fallback for ambiguous wake-up phrases like:
    // "I think I always go to sleep" -> treat as missed (not unknown).
    if (eventType === 'wake_up' && /\b(sleep|sleepy|go to sleep|back to sleep|still sleeping)\b/.test(text)) {
      resolved.intent = 'deny_taken';
      resolved.action = 'mark_missed';
      resolved.confidence = Math.max(resolved.confidence ?? 0, 0.62);
      resolved.reasoning = `${resolved.reasoning || 'Semantic fallback'} [wake_up + sleep semantics -> mark_missed]`;
      if (resolved.decisionSource !== 'rule_engine') resolved.decisionSource = 'hybrid';
    }

    // Temporary clarify is allowed in pipeline, but final event must resolve.
    // For this one-shot system, ask_again always resolves to deterministic final.
    if (resolved.action === 'ask_again') {
      const fallbackByType =
        eventType === 'appointment' ? 'alert_family' :
        eventType === 'wake_up'     ? (/\b(pain|sick|dizzy|fell|help|emergency)\b/.test(text) ? 'alert_family' : 'mark_missed') :
                                      'mark_missed'; // medication/custom/default

      resolved.action = fallbackByType;
      if (fallbackByType === 'alert_family') resolved.intent = 'feeling_bad';
      else if (resolved.intent === 'confused') resolved.intent = 'deny_taken';
      resolved.confidence = Math.max(resolved.confidence ?? 0, 0.45);
      resolved.reasoning = `${resolved.reasoning || 'No clear signal'} [decision guarantee fallback: ${eventType} -> ${fallbackByType}]`;
      resolved.decisionSource = resolved.decisionSource === 'rule_engine' ? 'rule_engine' : 'fallback';
    }

    return resolved;
  }

  // ── _combineDecisions — hybrid merge of rule + AI results ─────────────────

  /**
   * Merge rule-based and AI results into a single confident decision.
   *
   * Agreement: average confidence + bonus → high combined confidence.
   * Disagreement: higher-confidence result wins, with a small penalty applied
   *   to reflect the uncertainty.
   */
  _combineDecisions(ruleResult, aiResult) {
    const ruleConf = ruleResult.confidence ?? 0;
    const aiConf   = aiResult.confidence   ?? 0;

    if (ruleResult.action === aiResult.action) {
      // Both sources agree — boost confidence, label as hybrid
      const combined = Math.min((ruleConf + aiConf) / 2 + 0.08, 0.98);
      return {
        intent:         ruleResult.intent,
        confidence:     combined,
        action:         ruleResult.action,
        decisionSource: 'hybrid',
        reasoning:
          `Rule + AI agree on "${ruleResult.action}" ` +
          `(rule ${(ruleConf * 100).toFixed(0)}%, AI ${(aiConf * 100).toFixed(0)}%)`,
      };
    }

    // Disagreement — use the higher-confidence result with a penalty
    const useRule = ruleConf >= aiConf;
    const winner  = useRule ? ruleResult : aiResult;
    const loser   = useRule ? aiResult   : ruleResult;

    return {
      intent:         winner.intent,
      confidence:     Math.max(winner.confidence * 0.88, 0.35), // disagreement penalty
      action:         winner.action,
      decisionSource: 'hybrid',
      reasoning:
        `Rule/AI disagree — ${useRule ? 'rule' : 'AI'} wins ` +
        `(${useRule ? 'rule' : 'AI'} ${(winner.confidence * 100).toFixed(0)}% vs ` +
        `${useRule ? 'AI' : 'rule'} ${(loser.confidence * 100).toFixed(0)}%): ` +
        winner.reasoning,
    };
  }

  // ── _buildDecision — attach risk level and normalise ─────────────────────

  _buildDecision({ intent, confidence, action, decisionSource, reasoning, eventType }) {
    const riskLevel = this._assessRisk(action, confidence, eventType);
    return { intent, confidence, action, decisionSource, riskLevel, reasoning };
  }

  // ── _assessRisk — medical risk classification ────────────────────────────

  _assessRisk(action, confidence, eventType) {
    if (action === 'alert_family')   return 'high';    // health concern — always high
    if (action === 'mark_missed') {
      // Missed medication is more serious than missed wake-up
      if (eventType === 'medication' || eventType === 'appointment') return 'medium';
      return 'low';
    }
    if (action === 'mark_completed') {
      // Low-confidence completion might be a false positive
      if (confidence < 0.60) return 'medium';
      return 'low';
    }
    return 'medium';
  }

  // ── _applyAction — state machine transitions ──────────────────────────────

  async _applyAction({ action, event, plan }) {
    const patient = plan.patientId;

    switch (action) {
      case 'mark_completed':
        event.status      = 'completed';
        event.completedAt = new Date();
        // Keep medication log in sync — voice confirmation == taken
        if (event.medicationId) {
          await this._syncMedicationLog(event.medicationId, event.scheduledTime, 'taken');
        }
        break;

      case 'mark_missed':
        event.status = 'missed';
        // Keep medication log in sync + notify family
        if (event.medicationId) {
          await this._syncMedicationLog(event.medicationId, event.scheduledTime, 'missed');
          await this._notifyFamilyMissed({ plan, event });
        }
        break;

      case 'alert_family': {
        event.status = 'completed'; // event handled — patient communicated
        const notif = patient?.family
          ? await Notification.create({
              recipient:      patient.family,
              recipientModel: 'Family',
              patient:        patient._id,
              type:           'patient_update',
              priority:       'urgent',
              title:          'Patient Needs Attention',
              message:        `${patient.firstName} said they are not feeling well during the "${event.title}" check-in.`,
              data: {
                eventId:      event._id,
                eventTitle:   event.title,
                eventType:    event.type,
                responseText: event.response?.text,
              }
            })
          : null;
        // Push notification in real-time to family (who shares the patient room)
        if (notif && patient?._id) {
          emitToPatientRoom(patient._id.toString(), 'notification:new', {
            notification: notif.toObject()
          });
        }
        break;
      }

      case 'ask_again':
        // Should have been normalised to mark_missed before reaching here.
        // Defence-in-depth: treat it as missed.
        event.status = 'missed';
        if (event.medicationId) {
          await this._syncMedicationLog(event.medicationId, event.scheduledTime, 'missed');
          await this._notifyFamilyMissed({ plan, event });
        }
        break;

      default:
        // Unknown action — safe fallback
        console.error(`[DailyPlan] Unknown action "${action}" — defaulting to mark_missed`);
        event.status = 'missed';
        break;
    }
  }

  // ── _syncMedicationLog — keep Medication.medicationLogs in sync with DailyPlan ──

  /**
   * When a medication event resolves in DailyPlan, write the matching
   * medicationLog entry so adherence stats and the today-schedule view
   * always reflect the voice-confirmed outcome.
   */
  async _syncMedicationLog(medicationId, scheduledTime, status) {
    try {
      const medication = await Medication.findById(medicationId);
      if (!medication) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = medication.medicationLogs.find(log => {
        const d = new Date(log.scheduledDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime() && log.scheduledTime === scheduledTime;
      });

      if (existing) {
        existing.status  = status;
        existing.takenAt = status === 'taken' ? new Date() : null;
      } else {
        medication.medicationLogs.push({
          scheduledDate: today,
          scheduledTime,
          status,
          takenAt: status === 'taken' ? new Date() : null,
        });
      }

      await medication.save();
      console.log(`[DailyPlan] Synced medicationLog: ${medicationId} → ${status} at ${scheduledTime}`);
    } catch (err) {
      // Non-fatal — DailyPlan outcome is already persisted; log and continue.
      console.warn('[DailyPlan] _syncMedicationLog failed:', err.message);
    }
  }

  // ── _notifyFamilyMissed — real-time missed-medication alert to family ─────

  /**
   * Creates a Notification document and pushes it via Socket.IO to the
   * patient room (where the family dashboard is connected).
   */
  async _notifyFamilyMissed({ plan, event }) {
    try {
      const patient = plan.patientId;
      if (!patient?.family) return; // no family linked — nothing to notify

      let medName = event.title; // fallback: use event title
      if (event.medicationId) {
        const med = await Medication.findById(event.medicationId).select('name').lean();
        if (med) medName = med.name;
      }

      const notification = await Notification.create({
        recipient:      patient.family,
        recipientModel: 'Family',
        patient:        patient._id,
        type:           'medication_missed',
        priority:       'urgent',
        title:          'Missed Medication Alert',
        message:        `${patient.firstName} missed ${medName} scheduled for ${event.scheduledTime}.`,
        data: {
          medicationId:    event.medicationId,
          medicationName:  medName,
          scheduledTime:   event.scheduledTime,
          dailyPlanEventId: event._id,
          reasoning:       event.response?.reasoning,
        }
      });

      // Push to patient room in real-time — family is connected to this room
      emitToPatientRoom(patient._id.toString(), 'notification:new', {
        notification: notification.toObject()
      });

      console.log(`[DailyPlan] Missed medication notification sent → family of patient ${patient._id}`);
    } catch (err) {
      console.warn('[DailyPlan] _notifyFamilyMissed failed:', err.message);
    }
  }
}

export default new DailyPlanService();
