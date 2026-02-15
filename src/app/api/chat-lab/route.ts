import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages, systemPrompt, knowledgeBase } = await req.json();

    console.log(`🤖 Chat Request. Content Length: ${knowledgeBase?.length || 0}`);

    // System Prompt with Knowledge Base
    let strictSystem = `${systemPrompt}\n\nIMPORTANT: You have access to the KNOWLEDGE BASE provided below. Answer purely based on it. If the information is not in the Knowledge Base, say you don't know. Do NOT use external knowledge.`;

    if (knowledgeBase && knowledgeBase.trim()) {
        strictSystem += `\n\n--- KNOWLEDGE BASE START ---\n${knowledgeBase}\n--- KNOWLEDGE BASE END ---\n`;
    }

    const coreMessages = messages.map((m: any) => ({
        role: m.role,
        content: m.content
    }));

    try {
        const result = await streamText({
            model: google('models/gemini-3-flash-preview'),
            system: strictSystem,
            messages: coreMessages as any,
            onFinish: (event) => {
                console.log("🤖 Stream Finished. Reason:", event.finishReason);
            },
        });

        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error("Content generation error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
