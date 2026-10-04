import { NextRequest, NextResponse } from 'next/server';
import { qualifyLead } from '@/lib/lead-qualifier';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await qualifyLead(body);

    // Optional: persist scored lead here with Supabase
    // await supabase.from('leads').insert({ ...body, score: result.score, action: result.recommended_action });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Qualification failed', details: String(error?.message || error) },
      { status: 500 }
    );
  }
}
