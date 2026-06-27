import { Chess } from 'chess.js';

export type PositionEval = {
    fen: string;
    moveNum: number;
    color: 'w' | 'b';
    san: string;
    bestMove: string;
    centipawns: number;
    cpDrop: number;
    classification: "blunder" | "mistake" | "inaccuracy" | "good";
};

let stockfishWorker: Worker | null = null;
let evaluatePromiseResolve: ((result: Partial<PositionEval>) => void) | null = null;
let evaluatePromiseReject: ((error: Error) => void) | null = null;
let currentEval: Partial<PositionEval> = {};

function initStockfish() {
    if (stockfishWorker) return;

    // We can load the worker directly from our public folder in Manifest V3
    stockfishWorker = new Worker(chrome.runtime.getURL('stockfish.js'));
    console.log("Stockfish Worker initialized")
    stockfishWorker.onmessage = (e) => {
        const msg = e.data;
        // Parse the centipawn score from Stockfish's stream
        if (msg.startsWith("info depth ")) {
            const match = msg.match(/score cp (-?\d+)/);
            if (match) {
                currentEval.centipawns = parseInt(match[1]);
            } else {
                const mateMatch = msg.match(/score mate (-?\d+)/);
                if (mateMatch) {
                    currentEval.centipawns = parseInt(mateMatch[1]) > 0 ? 10000 : -10000;
                }
            }
        }
        // When it finishes its search, it outputs bestmove
        else if (msg.startsWith("bestmove ")) {
            currentEval.bestMove = msg.split(" ")[1];
            if (evaluatePromiseResolve) {
                evaluatePromiseResolve(currentEval);
                evaluatePromiseResolve = null;
                evaluatePromiseReject = null;
            }
        }
    };
    stockfishWorker.onerror = (e) => {
        console.error("Stockfish Worker Error:", e.message);
        if (evaluatePromiseReject) {
            evaluatePromiseReject(new Error(e.message || "Stockfish Worker failed"));
            evaluatePromiseResolve = null;
            evaluatePromiseReject = null;
        }
    };
    stockfishWorker.postMessage("uci");
}

export async function evaluatePosition(fen: string, depth: number = 1): Promise<Partial<PositionEval>> {
    if (!stockfishWorker) initStockfish();

    return new Promise((resolve, reject) => {
        let timeout: ReturnType<typeof setTimeout>;

        evaluatePromiseResolve = (res) => {
            clearTimeout(timeout);
            resolve(res);
        };
        evaluatePromiseReject = (err) => {
            clearTimeout(timeout);
            reject(err);
        };
        
        currentEval = { fen, centipawns: 0, bestMove: "" };

        // Fallback timeout in case Stockfish hangs on checkmate or terminal positions
        timeout = setTimeout(() => {
            console.log("Stockfish timed out for FEN:", fen);
            if (evaluatePromiseResolve) {
                evaluatePromiseResolve(currentEval);
                evaluatePromiseResolve = null;
                evaluatePromiseReject = null;
            }
        }, 2000);

        stockfishWorker!.postMessage(`position fen ${fen}`);
        stockfishWorker!.postMessage(`go depth ${depth}`);
    });
}

export async function evaluateGame(pgn: string): Promise<PositionEval[]> {
    const game = new Chess();
    game.loadPgn(pgn);
    const history = game.history({ verbose: true });

    const evalGame = new Chess();
    let prevEval = await evaluatePosition(evalGame.fen());

    console.log("Evalution done")

    const results: PositionEval[] = [];

    // Walk through the game move by move
    for (let i = 0; i < history.length; i++) {
        const move = history[i];
        evalGame.move(move.san);
        const currentEval = await evaluatePosition(evalGame.fen());
        console.log(currentEval)
        // Stockfish evaluations are always relative to the player whose turn it is.
        // If White was +100, and now Black is +200, White dropped 300 centipawns.
        let cpDrop = (prevEval.centipawns || 0) + (currentEval.centipawns || 0);
        cpDrop = Math.max(0, cpDrop); // Filter out engine depth noise

        // Classify the move
        let classification: "blunder" | "mistake" | "inaccuracy" | "good" = "good";
        if (cpDrop > 200) classification = "blunder";
        else if (cpDrop > 100) classification = "mistake";
        else if (cpDrop > 50) classification = "inaccuracy";

        results.push({
            fen: evalGame.fen(),
            moveNum: Math.floor(i / 2) + 1,
            color: move.color,
            san: move.san,
            bestMove: prevEval.bestMove || "",
            centipawns: currentEval.centipawns || 0,
            cpDrop,
            classification
        });

        prevEval = currentEval;
    }
    console.log("final results", results)
    return results;
}
