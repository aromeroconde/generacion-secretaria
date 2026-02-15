import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages, systemPrompt, knowledgeBase, audioData } = await req.json();

    console.log(`🤖 Chat Request. Content Length: ${knowledgeBase?.length || 0}. Audio: ${!!audioData}`);

    // Strict System Prompt Supplement
    let strictSystem = `${systemPrompt}\n\nIMPORTANT: You have access to the KNOWLEDGE BASE provided below. Answer purely based on it. If the information is not in the Knowledge Base, say you don't know. Do NOT use external knowledge.`;

    if (knowledgeBase && knowledgeBase.trim()) {
        strictSystem += `\n\n--- KNOWLEDGE BASE START ---\n${knowledgeBase}\n--- KNOWLEDGE BASE END ---\n`;
    }

    // Audio Debugging
    if (audioData) {
        console.log(`🎤 Server received audio. Length: ${audioData.length}`);
    }

    // Prepare Messages
    let coreMessages: any[] = [];

    if (audioData) {
        // Voice Mode: Use Gemini 2.5 Native Audio
        // We need to construct a multipart message for the latest user message
        const previousMessages = messages.slice(0, -1).map((m: any) => ({
            role: m.role,
            content: m.content
        }));

        const lastMessage = {
            role: 'user',
            content: [
                { type: 'text', text: 'Please respond to this audio input.' },
                { type: 'file', data: audioData, mimeType: 'audio/wav' }
            ]
        };

        coreMessages = [...previousMessages, lastMessage];
    } else {
        // Text Mode
        coreMessages = messages.map((m: any) => ({
            role: m.role,
            content: m.content
        }));
    }

    try {
        const modelName = audioData
            ? 'models/gemini-2.5-flash-native-audio'  // User requested specific model for voice
            : 'models/gemini-3-flash-preview';        // Keep Gemini 3 for text chat

        const result = await streamText({
            model: google(modelName),
            system: strictSystem,
            messages: coreMessages as any,
        });

        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error("Content generation error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
