import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ status: 'idle', active: false });
}

export async function GET() {
  return NextResponse.json({ status: 'idle', active: false });
}
