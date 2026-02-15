import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export const maxDuration = 60;

export async function POST(req: Request) {
    const { currentPrompt, feedback, task } = await req.json();
    // task: 'chat' | 'voice'

    console.log(`✨ Refining prompt for ${task}. Feedback len: ${feedback?.length}.`);

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "Missing API Key" }), { status: 500 });
    }

    try {
        let metaPrompt = `
You are an expert AI Prompt Engineer and System Architect.
Your goal is to REWRITE the "System Prompt" for a virtual assistant.

**Context:**
The user wants to improve the behavior/personality of the bot based on feedback.
NOTE: The bot has a separate Knowledge Base (RAG) for data. You do NOT need to add data.
Focus on the Instructions, Tone, and Role.

**Original System Prompt:**
"""
${currentPrompt}
"""

**User Feedback (What to improve):**
"""
${feedback}
"""

**Instructions:**
1. Analyze the Original Prompt and the User Feedback.
2. Rewrite the System Prompt to implement the feedback.
3. Keep the prompt structured (Identity, Context, Rules).
4. If the user says "Don't say X", add a negative constraint.
5. If the user says "Be more friendly", adjust the Tone section.
6. Return ONLY the new system prompt.
        `.trim();

        // No KB injection here.
        console.log("📝 Sending meta-prompt to Architect (Gemini 3 Pro)...");

        const { text } = await generateText({
            model: google('models/gemini-3-pro-preview'), // Updated to available preview model
            messages: [
                {
                    role: 'user',
                    content: metaPrompt
                }
            ]
        });

        console.log("✅ Prompt refined successfully. Length:", text.length);
        return new Response(JSON.stringify({ newPrompt: text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("❌ Error refining prompt:", error);
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
