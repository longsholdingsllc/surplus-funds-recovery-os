/**
 * Scores surplus-fund leads 0–100 for prioritization.
 * Higher = more actionable / higher expected recovery value.
 */

export interface ScoredLead {
  amount: number | null;
  parcel: string | null;
  address: string | null;
  snippet: string;
  score: number;
  reasons: string[];
}

const HIGH_VALUE = 50_000;
const MID_VALUE = 10_000;
const LOW_VALUE = 2_500;

export function scoreLead(lead: {
  amount: number | null;
  parcel: string | null;
  address: string | null;
  snippet: string;
}): ScoredLead {
  let score = 0;
  const reasons: string[] = [];

  // Amount (max 60)
  if (lead.amount != null && lead.amount > 0) {
    if (lead.amount >= HIGH_VALUE) {
      score += 60;
      reasons.push(`high amount $${lead.amount.toLocaleString()}`);
    } else if (lead.amount >= MID_VALUE) {
      score += 40;
      reasons.push(`mid amount $${lead.amount.toLocaleString()}`);
    } else if (lead.amount >= LOW_VALUE) {
      score += 25;
      reasons.push(`usable amount $${lead.amount.toLocaleString()}`);
    } else {
      score += 10;
      reasons.push(`small amount $${lead.amount.toLocaleString()}`);
    }
  } else {
    reasons.push("no amount extracted");
  }

  // Identifiers (max 30)
  if (lead.parcel) {
    score += 20;
    reasons.push("has parcel");
  }
  if (lead.address) {
    score += 10;
    reasons.push("has address");
  }

  // Combo bonus: amount + identifier is much more actionable
  if (lead.amount != null && lead.amount >= LOW_VALUE && (lead.parcel || lead.address)) {
    score += 15;
    reasons.push("amount + identifier combo");
  }

  // Snippet quality (max 10)
  if (lead.snippet && lead.snippet.length > 40) {
    score += 10;
    reasons.push("rich snippet");
  }

  return {
    ...lead,
    score: Math.min(100, score),
    reasons,
  };
}

/** Keep only leads above threshold, sorted high → low. */
export function rankLeads(
  leads: Array<{ amount: number | null; parcel: string | null; address: string | null; snippet: string }>,
  minScore = 25
): ScoredLead[] {
  return leads
    .map(scoreLead)
    .filter((l) => l.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
