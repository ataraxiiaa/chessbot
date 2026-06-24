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

    const board: (string | null)[][] = Array[8].fill(null).map(() => Array[8].fill(null))
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
    let fen = '';
    for (let r = 0; r < 8; r++) {
        let emptyCount = 0;
        for (let f = 0; f < 8; f++) {
            const piece = board[r][f];
            if (piece) {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                fen += piece;
            } else {
                emptyCount++;
            }
        }
        if (emptyCount > 0) {
            fen += emptyCount;
        }
        if (r < 7) fen += '/';
    }
    const sideToMove = 'w';
    const completeFEN = `${fen} ${sideToMove} KQkq - 0 1`;

    console.log('Current FEN:', completeFEN);
    return completeFEN;
}


const handleBoardMutation = debounce(() => {
    console.log('board change')
}, 100)

const observer = new MutationObserver(handleBoardMutation)

function init() {
    const boardElement = document.querySelector('wc-chess-board') || document.querySelector('#board-singe')
    if (boardElement) {
        console.log("board detected")
        observer.observe(boardElement, { childList: true, subtree: true, attributes: true })
        extractBoard()
    }
    else {
        setTimeout(init, 1000)
    }
}

init()