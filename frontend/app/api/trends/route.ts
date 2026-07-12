import { NextResponse } from 'next/server';
import { getTrendsData } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    
    const data = await getTrendsData(range);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch trends data:', error);
    return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 });
  }
}
