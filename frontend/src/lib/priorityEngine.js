/**
 * Priority Engine — picks the single most important next thing.
 *
 *   Priority = (MasteryGap * 0.5) + (TimeDecay * 0.3) - (ConfidenceScore * 0.2)
 *
 *   - MasteryGap     ∈ [0, 1]  =  (100 - mastery) / 100
 *   - TimeDecay      ∈ [0, 1]  =  saturating function of days since last touched
 *   - ConfidenceScore ∈ [0, 1] =  mastery / 100   (proxy)
 *
 * If a topic has never been touched, treat its time-decay as 1.0 (maximally stale).
 */

const HALF_LIFE_DAYS = 7;

function timeDecay(lastTouchedAt) {
  if (!lastTouchedAt) return 1;
  const last = new Date(lastTouchedAt).getTime();
  if (Number.isNaN(last)) return 1;
  const days = (Date.now() - last) / (1000 * 60 * 60 * 24);
  // saturating: 0d→0, ~7d→0.5, ~21d→~0.95, capped at 1
  return Math.min(1, 1 - Math.exp(-days / HALF_LIFE_DAYS));
}

export function scoreTopic(topic) {
  const mastery = Math.max(0, Math.min(100, topic.mastery ?? 0));
  const gap = (100 - mastery) / 100;
  const decay = timeDecay(topic.last_touched_at);
  const confidence = mastery / 100;
  const priority = gap * 0.5 + decay * 0.3 - confidence * 0.2;
  return { priority, gap, decay, confidence };
}

export function rankTopics(topics) {
  return [...topics]
    .map((t) => ({ ...t, ...scoreTopic(t) }))
    .sort((a, b) => b.priority - a.priority);
}

export function pickNextAction(topics) {
  const ranked = rankTopics(topics);
  return ranked[0] || null;
}

export function priorityReason(t) {
  if (!t) return "";
  if (!t.last_touched_at) return "untouched · widest mastery gap";
  if (t.decay > 0.6) return "long since revisited · time is decaying memory";
  if (t.gap > 0.6) return "mastery gap is widest here";
  return "balanced gap, decay & confidence put this on top";
}
