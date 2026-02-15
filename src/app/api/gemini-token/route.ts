import { NextResponse } from 'next/server';

// Simple endpoint to provide the API key for client-side Gemini Live API connection.
// In production, this should use proper auth/session validation.
export async function GET() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }
    return NextResponse.json({ apiKey });
}
