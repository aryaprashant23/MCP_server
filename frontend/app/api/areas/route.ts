import { NextResponse } from 'next/server';
import { getImprovementAreas } from '@/lib/db';

export async function GET() {
  try {
    const data = await getImprovementAreas();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch improvement areas:', error);
    return NextResponse.json({ error: 'Failed to fetch areas' }, { status: 500 });
  }
}
