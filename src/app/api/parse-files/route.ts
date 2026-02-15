import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { fileUrls, websiteUrl, websiteUrls } = await req.json();

        // Arrays to hold markdown parts
        const markdownParts: string[] = [];
        const debugData: any[] = [];

        // 1. Handle File URLs (Existing Webhook)
        const filePromise = (async () => {
            if (!fileUrls || fileUrls.length === 0) return;

            const webhookUrl = process.env.N8N_KB_PARSER_WEBHOOK_URL;
            if (!webhookUrl) {
                console.error("Missing N8N_KB_PARSER_WEBHOOK_URL env var");
                return;
            }

            console.log(`[Parse] Offloading ${fileUrls.length} files to n8n: ${webhookUrl}`);

            try {
                const n8nResponse = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileUrls }),
                });

                if (n8nResponse.ok) {
                    const data = await n8nResponse.json();
                    debugData.push({ source: 'files', data });
                    const text = extractText(data);
                    if (text) markdownParts.push(`## Base de Conocimiento (Archivos):\n${text}`);
                }
            } catch (err) {
                console.error("Error parsing files:", err);
            }
        })();

        // 2. Handle Website URLs (New Webhook)
        const webPromise = (async () => {
            // Support both singular and plural for backward compatibility
            const urlsToProcess = websiteUrls || (websiteUrl ? [websiteUrl] : []);

            if (!urlsToProcess || urlsToProcess.length === 0) return;

            const webWebhookUrl = "https://sswebhook.cenet.ws/webhook/base-conocimiento-url";
            console.log(`[Parse] Offloading ${urlsToProcess.length} Website URLs to n8n`);

            // Process each URL in parallel
            await Promise.all(urlsToProcess.map(async (url: string) => {
                try {
                    const n8nResponse = await fetch(webWebhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ websiteUrl: url }), // Send singular 'websiteUrl' as likely expected by n8n logic
                    });

                    if (n8nResponse.ok) {
                        const data = await n8nResponse.json();
                        debugData.push({ source: 'website', url, data });

                        let text = "";
                        if (data["KB URL"]) {
                            text = data["KB URL"];
                        } else {
                            text = extractText(data);
                        }

                        if (text) markdownParts.push(`## Base de Conocimiento (Sitio Web: ${url}):\n${text}`);
                    }
                } catch (err) {
                    console.error(`Error parsing website ${url}:`, err);
                }
            }));
        })();

        await Promise.all([filePromise, webPromise]);

        const finalMarkdown = markdownParts.join("\n\n---\n\n");

        return NextResponse.json({
            markdown: finalMarkdown || "",
            debug_raw: debugData
        });

    } catch (error: any) {
        console.error("Error parsing resources via n8n:", error);
        return NextResponse.json({ error: error.message, debug_error: true }, { status: 500 });
    }
}

// Helper to extract text from complex n8n/Gemini structures
function extractText(obj: any): string {
    if (!obj) return "";
    if (typeof obj === 'string') return obj;

    // PRIORITY: Check for user-specific format [{markdown: "..."}] directly
    if (Array.isArray(obj) && obj.length > 0 && obj[0].markdown) {
        return typeof obj[0].markdown === 'string' ? obj[0].markdown : JSON.stringify(obj[0].markdown);
    }

    if (Array.isArray(obj)) return obj.map(extractText).join("\n\n");

    // Priority keys
    if (obj["KB URL"]) return extractText(obj["KB URL"]); // Add specific key for website webhook
    if (obj.markdown) return extractText(obj.markdown);
    if (obj.text) return extractText(obj.text);
    if (obj.content) return extractText(obj.content);
    if (obj.parts) return extractText(obj.parts); // Gemini structure

    return "";
}
