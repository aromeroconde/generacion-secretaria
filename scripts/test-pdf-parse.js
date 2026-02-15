// Native fetch supported in Node 22

async function test() {
    console.log("Testing PDF Parse API...");
    // Public PDF URL (e.g. W3C dummy)
    const url = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

    try {
        const res = await fetch('http://localhost:3002/api/parse-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrls: [url] })
        });

        const text = await res.text();
        console.log("Status:", res.status);
        try {
            const data = JSON.parse(text);
            console.log("Response JSON:", JSON.stringify(data, null, 2));
        } catch (e) {
            console.log("Response Text (Not JSON):", text);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
