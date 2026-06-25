import { Chess } from 'chess.js';


function debounce(func: Function, wait: number) {
    let timeout: ReturnType<typeof setTimeout>;
    return function (this: any, ...args: any[]) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
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


let lastRequestedFen = "";

const handleBoardMutation = debounce(() => {
    const newFen = extractBoard()
    if (newFen === lastRequestedFen) return;

    console.log('board change, New FEN:', newFen)
    lastRequestedFen = newFen;

    chrome.runtime.sendMessage({
        type: 'GET_MOVE',
        fen: newFen
    }, (response) => {
        console.log("Background API Response:", response);
        if (response?.move) {
            console.log("Engine Move:", response.move);
            console.log("Reasoning:", response.reasoning);
            highlightMove(response.move)
            showReasoning(response.reasoning)
        } else if (response?.reasoning) {
            showReasoning(response.reasoning);
        }
    })

}, 100)

const observer = new MutationObserver(handleBoardMutation)


function getSideToMove(): 'w' | 'b' {
    const whiteTimer = document.querySelector('.clock-white.clock-player-turn');
    if (whiteTimer) return 'w';

    const blackTimer = document.querySelector('.clock-black.clock-player-turn');
    if (blackTimer) return 'b';

    return 'w';
}

let currentBoardElement: Element | null = null;

function init() {
    const boardElement = document.querySelector('wc-chess-board') || document.querySelector('#board-single') || document.querySelector('.board')

    // Check if we found a board AND it's a new board (or the old one was removed from the DOM)
    if (boardElement && (boardElement !== currentBoardElement || !document.body.contains(currentBoardElement))) {
        console.log("New board detected, attaching observer...")
        observer.disconnect() // Disconnect from the old board just in case
        currentBoardElement = boardElement

        // attributeFilter: ['class'] is crucial so that smooth piece animations (which change 'style')
        // don't trigger the observer hundreds of times and starve your debounce function!
        observer.observe(currentBoardElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })

        // Extract initial board state
        extractBoard()
    }

    // We must CONSTANTLY poll because chess.com deletes and recreates the board element frequently!
    setTimeout(init, 1000)
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