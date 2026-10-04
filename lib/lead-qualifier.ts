/**
 * Live Lead Qualification Agent – TypeScript Client
 * Endpoint: https://live-lead-qualifier-agent.vercel.app/api/qualify
 */

const ENDPOINT = 'https://live-lead-qualifier-agent.vercel.app/api/qualify';

export interface LeadInput {
  name?: string;
  email?: string;
  company?: string;
  title?: string;
  message?: string;
  budget?: string;
  timeline?: string;
  [key: string]: any;
}

export interface QualificationResult {
  success: boolean;
  score: number;
  max_score?: number;
  recommended_action: 'qualify' | 'nurture' | 'disqualify' | string;
  reason: string;
  summary: string;
  lead_received?: Record<string, any>;
  timestamp: string;
  agent: string;
  error?: string;
}

export async function qualifyLead(lead: LeadInput = {}): Promise<QualificationResult> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qualification API error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (err: any) {
    console.error('[LeadQualifier] Failed to qualify lead:', err);
    return {
      success: false,
      score: 0,
      recommended_action: 'nurture',
      reason: 'API unavailable – defaulting to nurture',
      summary: 'Lead scoring service temporarily unavailable',
      error: String(err?.message || err),
      timestamp: new Date().toISOString(),
      agent: 'Live Lead Qualification Agent v1.0 (fallback)',
    };
  }
}

export default qualifyLead;
