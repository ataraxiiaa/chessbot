




chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'GET_MOVE') {
        handleGetMove(request.fen).then(sendResponse)
        return true // Keep the messaging channel open for the async response
    }
});

async function handleGetMove(fen: string) {
    const lichessData = await fetchLichessMoves(fen);

    const prompt = buildPrompt(fen, lichessData);

    const move = await callOpenRouter(prompt);
    return move;
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


function buildPrompt(fen: string, lichessMoves: any[] | null) {
    let context = "";

    if (lichessMoves && lichessMoves.length > 0) {
        const moveLines = lichessMoves.map(m => {
            const total = m.total;
            const winRate = total > 0 ? Math.round((m.white / total) * 100) : 0;
            return `  ${m.move}: played ${total.toLocaleString()} times, white wins ${winRate}%`;
        }).join("\n");

        context = `\nLichess database (1500-2000 Elo) shows these moves played in this position:\n${moveLines}\n`;
    }

    return `You are a chess engine. Analyze the position and return the best move.

FEN: ${fen}
${context}
Respond ONLY with this JSON, no other text:
{
  "move": "<move in SAN notation e.g. Nf3>",
  "reasoning": "<one sentence explanation>"
}`;
}

async function callOpenRouter(prompt: string) {
    const storage = await chrome.storage.sync.get(["openRouterKey", "geminiKey"]);
    const apiKey = (storage.openRouterKey || storage.geminiKey) as string;
    console.log("API key", apiKey)
    if (!apiKey) {
        return { move: null, reasoning: "API key is missing" };
    }

    try {
        let data = await makeOpenRouterRequest(apiKey, prompt, "meta-llama/llama-3.3-70b-instruct:free");

        // If the primary free provider is down, fallback to another highly capable free model
        if (data.error && data.error.message.includes("Provider returned error")) {
            console.warn("Llama 3.3 free provider is down, falling back to Gemma 4 31B...");
            data = await makeOpenRouterRequest(apiKey, prompt, "google/gemma-4-31b-it:free");
        }

        if (data.error) {
            console.error("OpenRouter API Error:", data.error);
            return { move: null, reasoning: `API Error: ${data.error.message}` };
        }

        const text = data.choices?.[0]?.message?.content ?? "";

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
            return { move: null, reasoning: `AI returned invalid format: ${text.substring(0, 50)}...` };
        }

        return parsed;
    } catch (e) {
        console.error("OpenRouter Error:", e);
        return { move: null, reasoning: "Parse error or Network error" };
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