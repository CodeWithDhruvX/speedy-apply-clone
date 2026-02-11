// Background Service Worker for SpeedyApply
// Handles calls to external/local APIs to avoid Mixed Content issues in Content Scripts

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'OLLAMA_REQUEST') {
        handleOllamaRequest(request, sendResponse);
        return true; // Keep the message channel open for async response
    }

    if (request.action === 'CHECK_OLLAMA_STATUS') {
        checkOllamaStatus(sendResponse);
        return true;
    }
});

async function handleOllamaRequest(request, sendResponse) {
    const { prompt, model } = request;
    const targetModel = model || 'qwen2.5-coder:3b';

    try {
        console.log(`SpeedyApply BG: Sending prompt to Ollama (${targetModel})...`);
        const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: targetModel,
                messages: [
                    { role: 'user', content: prompt }
                ],
                stream: false // We want a single response for simplicity
            })
        });

        if (!response.ok) {
            if (response.status === 403) {
                console.error("SpeedyApply BG: Ollama 403 Forbidden. You likely need to set OLLAMA_ORIGINS=\"*\" environment variable.");
                console.error("Run: setx OLLAMA_ORIGINS \"*\" in your terminal and restart Ollama.");
            }
            throw new Error(`Ollama API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("SpeedyApply BG: Ollama Response received.", data);

        if (data.message && data.message.content) {
            sendResponse({ success: true, data: data.message.content });
        } else {
            sendResponse({ success: false, error: 'Invalid response format from Ollama' });
        }

    } catch (error) {
        console.error("SpeedyApply BG: Ollama Request Failed", error);
        sendResponse({ success: false, error: error.message });
    }
}

async function checkOllamaStatus(sendResponse) {
    try {
        const response = await fetch('http://localhost:11434/api/tags'); // Lightweight endpoint to list models
        if (response.ok) {
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Unreachable' });
        }
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}
