# Chess LLM Agent

A powerful, modern Chrome Extension designed for Chess.com that combines the tactical precision of a local **Stockfish Engine** with the conversational coaching of **Large Language Models (LLMs)**.

## Features

- **Post-Game Analysis:** Instantly analyze your finished games. The extension extracts the game PGN and evaluates every move using a locally running Stockfish 16.1 WebAssembly engine.
- **LLM Coaching Report:** After Stockfish finds the blunders, mistakes, and inaccuracies, the data is sent to an LLM (via OpenRouter or Google Gemini API) to generate a human-readable, grandmaster-level coaching report.
- **Move Suggestions:** Stuck in a position? You can request a move suggestion based on current FEN and Lichess opening explorer data.
- **Privacy & Speed:** Stockfish runs entirely locally in your browser using Manifest V3 **Offscreen Documents** to bypass strict Content Security Policies, ensuring fast and compliant evaluation.

## How It Works (Architecture)

1. **Content Script (`src/content.ts`):** Injects a seamless UI into Chess.com and extracts the current board FEN or the full game PGN (handling modern dynamic figurines).
2. **Background Worker (`src/background.ts`):** Orchestrates the API calls to the LLM (OpenRouter/Gemini) and manages extension state.
3. **Offscreen Document (`offscreen.html` / `src/analyzer.ts`):** Since Manifest V3 blocks Web Workers inside content scripts on heavily protected sites like Chess.com, this extension spins up a secure Offscreen Document. This document loads the `stockfish.wasm` engine and rapidly processes the game evaluations without lagging your browser.
4. **Popup (`index.html`):** A sleek user interface to enter your API keys and trigger analysis.

## Installation & Setup

### 1. Build the Extension
Ensure you have [Node.js](https://nodejs.org/) installed, then run the following commands in the root of the project:

```bash
# Install dependencies
npm install

# Build the extension for production
npm run build
```

This will compile the TypeScript code and generate the extension files into a `dist/` folder.

*(Note: If you are actively developing, you can use `npm run dev` to start the CRXJS dev server for Hot Module Replacement).*

### 2. Load into Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Turn on **Developer mode** (toggle switch in the top right corner).
3. Click the **Load unpacked** button in the top left.
4. Select the `dist/` folder generated in the previous step.

### 3. Configure API Keys
1. Pin the Chess LLM Agent extension to your Chrome toolbar.
2. Click the extension icon to open the popup.
3. Enter your **OpenRouter API Key** or **Gemini API Key**.
   - Get a free OpenRouter key here: [OpenRouter](https://openrouter.ai/)
   - Alternatively, get a Gemini API key here: [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Click **Save Keys**.

## Usage

1. Go to [Chess.com](https://www.chess.com) and play or open a game.
2. Click on the Chess LLM Agent extension icon in your toolbar.
3. Click **Analyze Game** for a full post-game coaching report, or **Suggest Move** for immediate tactical advice.
4. The extension will run Stockfish locally (you'll see "Stockfish evaluation complete"), wait for the LLM to write the report, and then render a beautiful sidebar directly on the webpage with your results!

## Technologies Used
- **Vite & CRXJS:** For lightning-fast bundling and modern extension development.
- **TypeScript:** For robust and type-safe code.
- **Stockfish.js / WebAssembly:** For local engine evaluation.
- **chess.js:** For move validation and PGN parsing.
