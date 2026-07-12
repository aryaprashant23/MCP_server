import { NextResponse } from 'next/server';
import { getKPIMetrics } from '@/lib/db';

export async function GET() {
  try {
    const data = await getKPIMetrics();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch KPI metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
