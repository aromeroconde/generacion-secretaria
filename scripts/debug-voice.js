const fs = require('fs');

function createSilentWav(durationSec = 1, sampleRate = 24000) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = durationSec * byteRate;
    const chunkSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);

    // Header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(chunkSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Data is already zeros (silence)

    return buffer.toString('base64');
}

const wavBase64 = createSilentWav(1.5); // 1.5 seconds

async function debugVoice() {
    console.log("Sending request to /api/chat-lab...");

    try {
        const response = await fetch('http://localhost:3000/api/chat-lab', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [],
                systemPrompt: "You are a helpful assistant. If you hear silence, say 'I heard silence'.",
                audioData: wavBase64
            })
        });

        console.log("Status:", response.status);

        if (!response.ok) {
            console.log("Error Body:", await response.text());
            return;
        }

        const data = await response.json();
        console.log("Response Keys:", Object.keys(data));
        console.log("Text Response:", data.text);

        if (data.audio) {
            console.log("Audio Response Length:", data.audio.length);
            fs.writeFileSync('output_debug.wav', Buffer.from(data.audio, 'base64'));
            console.log("Saved output_debug.wav");
        } else {
            console.log("No Audio returned.");
        }

    } catch (e) {
        console.error(e);
    }
}

debugVoice();
