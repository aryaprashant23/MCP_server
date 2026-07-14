import { NextResponse } from 'next/server';
import { getKPIMetrics } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';

    const data = await getKPIMetrics(range);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch KPI metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
