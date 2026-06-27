import { Chess } from 'chess.js';

function debounce(func: Function, wait: number) {
    let timeout: ReturnType<typeof setTimeout>;
    return function (this: any, ...args: any[]) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function extractMoveText(el: Element): string {
    let piece = "";
    const fig = el.querySelector('[data-figurine]');
    if (fig) {
        piece = fig.getAttribute('data-figurine') || "";
    }

    let text = (el.textContent || "").trim();
    // Replace any unicode chess symbols with standard ASCII letters just in case
    text = text.replace(/[\u2654\u265A]/g, 'K')
        .replace(/[\u2655\u265B]/g, 'Q')
        .replace(/[\u2656\u265C]/g, 'R')
        .replace(/[\u2657\u265D]/g, 'B')
        .replace(/[\u2658\u265E]/g, 'N')
        .replace(/[\n\r\s]+/g, ''); // remove newlines/spaces

    if (piece && !text.startsWith(piece)) {
        text = piece + text;
    }
    return text;
}

function extractPGNFromChessCom(): string {
    let pgn = "";

    // Attempt 1: Modern Data-Ply or Node elements
    const moveElements = document.querySelectorAll('.main-line-ply, [data-ply], .move-text-component, .node');
    if (moveElements.length > 0) {
        // We might get dupes if selectors overlap, so we track data-ply if it exists
        const moves: string[] = [];
        let currentPly = 1;

        moveElements.forEach(el => {
            const plyAttr = el.getAttribute('data-ply');
            const moveText = extractMoveText(el);
            if (!moveText) return; // skip empty elements

            if (plyAttr) {
                const ply = parseInt(plyAttr);
                if (ply === currentPly) {
                    moves.push(moveText);
                    currentPly++;
                }
            } else {
                moves.push(moveText);
            }
        });

        // If we captured something, format it!
        if (moves.length > 0) {
            for (let i = 0; i < moves.length; i++) {
                if (i % 2 === 0) pgn += `${Math.floor(i / 2) + 1}. `;
                pgn += moves[i] + " ";
            }
            console.log(pgn)
            return pgn.trim();
        }
    }

    const lichessMoves = document.querySelectorAll('lrm');
    if (lichessMoves.length > 0) {
        const moves: string[] = [];
        lichessMoves.forEach(el => moves.push(el.textContent?.trim() || ""));
        for (let i = 0; i < moves.length; i++) {
            if (i % 2 === 0) pgn += `${Math.floor(i / 2) + 1}. `;
            pgn += moves[i] + " ";
        }
        console.log(pgn)
        return pgn.trim();
    }

    return prompt("Could not automatically extract PGN. Please paste the PGN here to analyze:") || "";
}

function requestAnalysis() {
    const pgn = extractPGNFromChessCom();
    if (!pgn) return;

    showReasoning("Analyzing game with Stockfish & LLM... This may take a minute.");

    chrome.runtime.sendMessage({
        type: 'ANALYZE_GAME',
        pgn: pgn
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Runtime Error:", chrome.runtime.lastError);
            showReasoning("Analysis failed: Extension connection error. Try refreshing the page.");
            return;
        }
        if (!response) {
            showReasoning("Analysis failed: The background process died unexpectedly.");
            return;
        }
        if (response.error) {
            showReasoning("Analysis failed: " + response.error);
        } else if (response.report) {
            showReasoning("Analysis complete!");
            renderSidebar(response.report);
        }
    });
}

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'UPDATE_STATUS') {
        showReasoning(request.status);
    }
});

function renderSidebar(report: any) {
    const existing = document.getElementById('coach-sidebar');
    if (existing) existing.remove();

    const sidebar = document.createElement('div');
    sidebar.id = 'coach-sidebar';
    // Clean inline styles to render a beautiful panel without external CSS
    sidebar.style.cssText = `
        position: fixed; top: 0; right: 0; width: 340px; height: 100vh;
        background: white; z-index: 999999; box-shadow: -4px 0 15px rgba(0,0,0,0.1);
        overflow-y: auto; padding: 20px; box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #333;
    `;

    // Dynamic color depending on how well they played
    const accColor = report.accuracy >= 90 ? '#4CAF50' : report.accuracy >= 70 ? '#FFC107' : '#F44336';

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 20px;">Game Analysis</h2>
            <button id="close-sidebar" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
            <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase;">Accuracy</div>
                <div style="font-size: 24px; font-weight: bold; color: ${accColor}">${report.accuracy}%</div>
            </div>
            <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase;">Blunders</div>
                <div style="font-size: 24px; font-weight: bold; color: #F44336">${report.blunders}</div>
            </div>
            <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase;">Mistakes</div>
                <div style="font-size: 24px; font-weight: bold; color: #FF9800">${report.mistakes}</div>
            </div>
            <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase;">Inaccuracies</div>
                <div style="font-size: 24px; font-weight: bold; color: #FFEB3B">${report.inaccuracies}</div>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; margin: 0 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 4px;">Summary</h3>
            <p style="font-size: 14px; line-height: 1.5; margin: 0;">${report.summary}</p>
        </div>

        <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; margin: 0 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 4px;">Critical Moments</h3>
            ${report.criticalMoments.map((m: any) => `
                <div style="background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                    <div style="font-weight: bold; margin-bottom: 5px; font-size: 14px;">Move ${m.moveNum}</div>
                    <div style="display: flex; gap: 10px; margin-bottom: 5px; font-size: 13px;">
                        <span style="color: #d32f2f;">Played: ${m.played}</span>
                        <span style="color: #388e3c;">Best: ${m.best}</span>
                    </div>
                    <div style="font-size: 13px; color: #555;">${m.explanation}</div>
                </div>
            `).join('')}
        </div>

        <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; margin: 0 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 4px;">Patterns</h3>
            <p style="font-size: 14px; line-height: 1.5; margin: 0;">${report.patterns}</p>
        </div>

        <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; margin: 0 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 4px;">Recommendations</h3>
            <ul style="font-size: 14px; line-height: 1.5; margin: 0; padding-left: 20px;">
                ${report.recommendations.map((r: string) => `<li>${r}</li>`).join('')}
            </ul>
        </div>
    `;

    sidebar.innerHTML = html;
    document.body.appendChild(sidebar);

    document.getElementById('close-sidebar')?.addEventListener('click', () => {
        sidebar.remove();
    });
}

// DOM PARSER
function extractBoard() {

    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null))
    const pieces = document.querySelectorAll('.piece')

    pieces.forEach((piece) => {
        const classList = Array.from(piece.classList)

        const pieceCLass = classList.find(c => c.length === 2 && (c.startsWith('w') || c.startsWith('b')))
        const squareClass = classList.find(c => c.startsWith('square-'))

        if (pieceCLass && squareClass) {
            const color = pieceCLass[0]
            const type = pieceCLass[1]

            const coords = squareClass.split('-')[1]
            const file = parseInt(coords[0], 10)
            const rank = parseInt(coords[1], 10)

            const arrayX = file - 1
            const arrayY = 8 - rank


            board[arrayY][arrayX] = color === 'w' ? type.toUpperCase() : type.toLowerCase()
        }
    })
    return generateFEN(board)
}


let lastFen = "";

function generateFEN(board: (string | null)[][]) {
    const game = new Chess();
    game.clear();

    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const piece = board[r][f];
            if (piece) {
                const square = String.fromCharCode(97 + f) + (8 - r);
                game.put({ type: piece.toLowerCase() as any, color: piece === piece.toUpperCase() ? 'w' : 'b' }, square as any);
            }
        }
    }

    const turn = getSideToMove();
    const fen = game.fen().replace(/ [wb] /, ` ${turn} `);

    lastFen = fen;
    console.log('Valid FEN:', fen);
    return fen;
}


let lastSeenFen = "";

const handleBoardMutation = debounce(() => {
    const currentFen = extractBoard();
    if (currentFen !== lastSeenFen) {
        lastSeenFen = currentFen;
        // Board changed (a move was made), clear old highlights
        document.querySelectorAll('.bot-highlight').forEach(el => el.remove());
    }
}, 500);

const observer = new MutationObserver(handleBoardMutation);

function requestMove() {
    const newFen = extractBoard();
    if (!newFen) return;

    showReasoning("Fetching best move...");

    chrome.runtime.sendMessage({
        type: 'GET_MOVE',
        fen: newFen
    }, (response) => {
        if (response?.move) {
            highlightMove(response.move);
            showReasoning(response.reasoning || "Engine move suggested.");
        } else if (response?.reasoning) {
            showReasoning(response.reasoning);
        }
    });
}

chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request.type === "REQUEST_MOVE_FROM_POPUP") {
        requestMove();
    } else if (request.type === "ANALYZE_GAME_FROM_POPUP") {
        requestAnalysis();
    }
});

function getSideToMove(): 'w' | 'b' {
    const whiteTimer = document.querySelector('.clock-white.clock-player-turn');
    if (whiteTimer) return 'w';

    const blackTimer = document.querySelector('.clock-black.clock-player-turn');
    if (blackTimer) return 'b';

    return 'w';
}

let currentBoardElement: Element | null = null;

function init() {
    const boardElement = document.querySelector('wc-chess-board') || document.querySelector('#board-single') || document.querySelector('.board');

    if (boardElement && (boardElement !== currentBoardElement || !document.body.contains(currentBoardElement))) {
        console.log("New board detected");
        observer.disconnect();
        currentBoardElement = boardElement;

        observer.observe(currentBoardElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

        lastSeenFen = extractBoard();
    }

    // We must CONSTANTLY poll because chess.com deletes and recreates the board element frequently!
    setTimeout(init, 1000);
}

init()

function highlightMove(moveSan: string) {
    if (!lastFen) return;
    const game = new Chess(lastFen);
    let moveObj;
    try {
        moveObj = game.move(moveSan);
    } catch (e) {
        console.error("Invalid move returned by API:", moveSan);
        return;
    }

    if (!moveObj) return;

    // Remove old highlights
    document.querySelectorAll('.bot-highlight').forEach(el => el.remove());

    const fromSquare = algebraicToChessCom(moveObj.from);
    const toSquare = algebraicToChessCom(moveObj.to);

    if (currentBoardElement) {
        currentBoardElement.appendChild(createHighlight(fromSquare, "rgba(255, 0, 0, 0.5)"));
        currentBoardElement.appendChild(createHighlight(toSquare, "rgba(255, 0, 0, 0.5)"));
    }
}

function algebraicToChessCom(square: string) {
    const file = square.charCodeAt(0) - 96; // 'a' is 97 -> 1
    const rank = square.charAt(1);
    return `${file}${rank}`;
}

function createHighlight(squareCoords: string, color: string) {
    const div = document.createElement('div');
    div.className = `highlight square-${squareCoords} bot-highlight`;
    div.style.backgroundColor = color;
    div.style.opacity = "0.6";
    div.style.pointerEvents = "none";
    return div;
}

function showReasoning(reasoning: string) {
    let reasoningEl = document.getElementById("bot-reasoning");
    if (!reasoningEl) {
        reasoningEl = document.createElement("div");
        reasoningEl.id = "bot-reasoning";
        reasoningEl.style.position = "fixed";
        reasoningEl.style.bottom = "20px";
        reasoningEl.style.right = "20px";
        reasoningEl.style.backgroundColor = "#2a2a2a";
        reasoningEl.style.color = "#ffffff";
        reasoningEl.style.padding = "15px";
        reasoningEl.style.borderRadius = "8px";
        reasoningEl.style.maxWidth = "300px";
        reasoningEl.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
        reasoningEl.style.zIndex = "999999";
        reasoningEl.style.fontFamily = "sans-serif";
        reasoningEl.style.fontSize = "14px";
        reasoningEl.style.borderLeft = "4px solid #4CAF50";
        document.body.appendChild(reasoningEl);
    }
    reasoningEl.textContent = reasoning;
}



