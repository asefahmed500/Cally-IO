// This route is no longer used.
import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({ error: 'This endpoint is no longer in use.' }, { status: 404 });
}
