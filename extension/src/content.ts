import { Chess } from 'chess.js';


function debounce(func: Function, wait: number) {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
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


function generateFEN(board: (string | null)[][]) {
    const game = new Chess();
    game.clear();

    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const piece = board[r][f];
            if (piece) {
                const square = String.fromCharCode(97 + f) + (8 - r);
                game.put({ type: piece.toLowerCase() as any, color: piece === piece.toUpperCase() ? 'w' : 'b' }, square);
            }
        }
    }

    const turn = getSideToMove();
    const fen = game.fen().replace(/ [wb] /, ` ${turn} `);

    console.log('Valid FEN:', fen);
    return fen;
}


const handleBoardMutation = debounce(() => {
    console.log('board change')
    const newFen = extractBoard()
    console.log('New FEN:', newFen)
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