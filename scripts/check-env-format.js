const fs = require('fs');
const path = require('path');

const filesToCheck = ['.env.local', '.env', '.env.development.local', '.env.development'];

function checkEnv() {
    let checkedAny = false;
    for (const file of filesToCheck) {
        const envPath = path.join(process.cwd(), file);
        if (!fs.existsSync(envPath)) continue;

        console.log(`🔎 Checking ${file}...`);
        checkedAny = true;
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            if (line.trim().startsWith('GOOGLE_GENERATIVE_AI_API_KEY')) {
                const parts = line.split('=');
                if (parts.length < 2) continue;

                let key = parts.slice(1).join('=').trim();
                if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
                    key = key.slice(1, -1);
                }

                console.log(`   Found key in ${file}. Length: ${key.length}`);
                if (key.startsWith('your') || key.includes('placeholder')) {
                    console.log("   ❌ Key looks like a placeholder ('your...'). Replace it!");
                } else if (!key.startsWith('AIza')) {
                    console.log("   ⚠️ Key seems invalid (does not start with 'AIza').");
                } else {
                    console.log("   ✅ Key format valid.");
                }
            }
        }
    }

    if (!checkedAny) {
        console.log("❌ No .env files found!");
    }
}

checkEnv();
