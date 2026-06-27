import type { PositionEval } from "./analyzer";

export function buildAnalysisPrompt(pgn: string, evals: PositionEval[]): string {
    const blunders = evals.filter(e => e.classification === 'blunder').length
    const mistakes = evals.filter(e => e.classification === 'mistake').length
    const inaccuracies = evals.filter(e => e.classification === 'inaccuracy').length

    let totalDrop = 0;
    evals.forEach(e => totalDrop += e.cpDrop);
    const avgDrop = evals.length > 0 ? totalDrop / evals.length : 0;
    let accuracy = 100 - (avgDrop / 10);
    accuracy = Math.max(0, Math.min(100, accuracy));

    const criticalMoves = evals.filter(e => e.cpDrop > 50).map(e => {
        return `Move ${e.moveNum} (${e.color === 'w' ? 'White' : 'Black'}): Played ${e.san}. Engine preferred: ${e.bestMove}. Centipawn drop: ${e.cpDrop} (${e.classification})`;
    });

    const criticalContext = criticalMoves.length > 0
        ? criticalMoves.join("\n")
        : "No major mistakes were made. It was a very clean game.";

    return `You are an expert chess coach analyzing a game. 
Review the following PGN and the engine evaluation of the critical moments.
Write like a chess coach, not a cold engine. Reference specific move numbers. Be specific and direct in your feedback.
Do NOT output markdown fences like \`\`\`json. Return ONLY valid JSON.
PGN:
${pgn}
Overall Stats calculated by Stockfish:
- Accuracy: ${accuracy.toFixed(1)}%
- Blunders: ${blunders}
- Mistakes: ${mistakes}
- Inaccuracies: ${inaccuracies}
Critical Engine Moments (only showing drops > 50cp):
${criticalContext}
You MUST return ONLY valid JSON matching this exact structure:
{
  "accuracy": ${Math.round(accuracy)},
  "blunders": ${blunders},
  "mistakes": ${mistakes},
  "inaccuracies": ${inaccuracies},
  "summary": "<A 2-3 sentence overall summary of the game flow and turning points>",
  "criticalMoments": [
    { "moveNum": <number>, "played": "<string>", "best": "<string>", "explanation": "<Why the played move was bad and the best move was better>" }
  ],
  "patterns": "<1-2 sentences identifying recurring strategic or tactical flaws>",
  "recommendations": ["<Specific advice 1>", "<Specific advice 2>"]
}`;

}
export function buildPrompt(fen: string, lichessData: any): string {
    return `You are a Grandmaster. Suggest a move for FEN: ${fen}. \nLichess data: ${JSON.stringify(lichessData)}\nReturn JSON with move and reasoning.`;
}

