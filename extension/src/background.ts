import { buildAnalysisPrompt, buildPrompt } from "./promptBuilder";

const model = "qwen/qwen3-coder:free"

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'GET_MOVE') {
        handleGetMove(request.fen).then(sendResponse)
        return true // Keep the messaging channel open for the async response
    }
    else if (request.type === 'ANALYZE_GAME') {
        handleAnalyzeGame(request.pgn, _sender).then(sendResponse);
        return true;
    }
});

async function handleAnalyzeGame(pgn: string, sender: chrome.runtime.MessageSender) {
    try {
        await setupOffscreenDocument('offscreen.html');
        const evals = await chrome.runtime.sendMessage({
            type: 'OFFSCREEN_EVALUATE_GAME',
            pgn: pgn
        });

        if (evals && evals.error) {
            return { error: evals.error };
        }

        if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, { type: 'UPDATE_STATUS', status: "Stockfish evaluation complete. AI is writing the report..." }).catch(() => { });
        }

        // 2. Build the LLM prompt
        const prompt = buildAnalysisPrompt(pgn, evals);

        // 3. Fetch API Key
        const storage = await chrome.storage.sync.get(["openRouterKey", "geminiKey"]);
        const apiKey = storage.openRouterKey || storage.geminiKey;

        if (!apiKey) {
            return { error: "API key is missing. Please configure it in the popup." };
        }

        const data = await makeOpenRouterRequest(apiKey as string, prompt, model)
        if (data.error) {
            return { error: data.error.message || JSON.stringify(data.error) };
        }

        const text = data.choices?.[0]?.message?.content ?? ""

        let parsed = null;
        try {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                parsed = JSON.parse(text.substring(start, end + 1));
            } else {
                parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
            }
        } catch (e) {
            console.error("Failed to parse JSON. Raw text:", text);
            return { error: "Failed to parse analysis from AI." };
        }

        // Send the parsed report back to the content script!
        return { report: parsed };
    } catch (e: any) {
        console.error("Error analyzing game:", e)
        return { error: e.message || "An unknown error occured during analysis" }
    }
}

async function handleGetMove(fen: string) {
    const lichessData = await fetchLichessMoves(fen);

    const prompt = buildPrompt(fen, lichessData);

    const storage = await chrome.storage.sync.get(["openRouterKey", "geminiKey"]);
    const apiKey = storage.openRouterKey || storage.geminiKey;
    if (!apiKey) return { move: null, reasoning: "API key is missing" };

    const data = await makeOpenRouterRequest(apiKey as string, prompt, model);

    if (data.error) {
        return { error: data.error.message || JSON.stringify(data.error) };
    }

    try {
        const text = data.choices?.[0]?.message?.content ?? "";
        let parsed = null;
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            parsed = JSON.parse(text.substring(start, end + 1));
        } else {
            parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        }
        return parsed;
    } catch (e) {
        return { move: null, reasoning: "API key is missing" };
    }
}

async function fetchLichessMoves(fen: string) {
    const url = `https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(fen)}&ratings=1500,1800,2000&speeds=blitz,rapid&moves=5`

    try {
        const res = await fetch(url)
        const data = await res.json()

        if (!data.moves || data.moves.length === 0) return null;

        return data.moves.slice(0, 5).map((m: any) => ({
            move: m.san,
            white: m.white,
            draws: m.draws,
            black: m.black,
            total: m.white + m.draws + m.black
        }));
    } catch {
        return null;
    }
}

async function callOpenRouter(prompt: string) {
    const storage = await chrome.storage.sync.get(["openRouterKey", "geminiKey"]);
    const apiKey = storage.openRouterKey || storage.geminiKey;

    if (!apiKey) {
        return { move: null, reasoning: "API key is missing. Please configure it in the popup." };
    }

    try {
        const data = await makeOpenRouterRequest(apiKey as string, prompt, model)

        if (data.error) {
            return { move: null, reasoning: data.error.message || JSON.stringify(data.error) };
        }

        const text = data.choices?.[0]?.message?.content ?? ""

        // Try to parse JSON from the response. Sometimes the model wraps it in markdown like ```json ... ```
        let parsed = null;
        try {
            // Very naive way to extract json if it includes other text
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                parsed = JSON.parse(text.substring(start, end + 1));
            } else {
                parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
            }
        } catch (e) {
            console.error("Failed to parse JSON from OpenRouter. Raw text:", text);
            return { move: null, reasoning: text }; // Fallback to raw text
        }

        return parsed;

    } catch (error: any) {
        console.error("Error calling OpenRouter:", error);
        return { move: null, reasoning: "API request failed: " + error.message };
    }
}

async function makeOpenRouterRequest(apiKey: string, prompt: string, model: string) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/chessbot",
            "X-Title": "ChessBot Extension"
        },
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        })
    });
    return await res.json();
}

let creating: Promise<void> | null = null;
async function setupOffscreenDocument(path: string) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT || "OFFSCREEN_DOCUMENT"],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: [chrome.offscreen.Reason.WORKERS || "WORKERS"] as any,
            justification: "Run Stockfish Engine",
        });
        await creating;
        creating = null;
    }
}