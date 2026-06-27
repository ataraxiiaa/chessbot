import { evaluateGame, evaluatePosition } from "./analyzer";

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'OFFSCREEN_EVALUATE_GAME') {
        evaluateGame(request.pgn)
            .then(sendResponse)
            .catch(e => sendResponse({ error: e.message }));
        return true;
    }
    if (request.type === 'OFFSCREEN_EVALUATE_POSITION') {
        evaluatePosition(request.fen, request.depth)
            .then(sendResponse)
            .catch(e => sendResponse({ error: e.message }));
        return true;
    }
});
