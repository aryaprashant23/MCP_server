import { NextResponse } from 'next/server';
import { getImprovementAreas } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';

    const data = await getImprovementAreas(range);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch improvement areas:', error);
    return NextResponse.json({ error: 'Failed to fetch areas' }, { status: 500 });
  }
}
