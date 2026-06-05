import { NextResponse } from 'next/server';

// Proxy hacia api-proxy para obtener token efímero de Gemini.
// NUNCA expone la API key real al frontend.
export async function GET() {
    const proxyUrl = process.env.PROXY_URL;
    const proxyToken = process.env.PROXY_TOKEN;

    if (!proxyUrl || !proxyToken) {
        return NextResponse.json({ error: 'Proxy not configured. Set PROXY_URL and PROXY_TOKEN.' }, { status: 500 });
    }

    try {
        const res = await fetch(`${proxyUrl}/proxy/gemini/token`, {
            headers: { 'X-Proxy-Token': proxyToken },
        });

        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json({ error: `Proxy error ${res.status}: ${errText}` }, { status: 502 });
        }

        const data = await res.json() as { token: string; expiresAt: string };
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: `Could not reach proxy: ${err.message}` }, { status: 502 });
    }
}
