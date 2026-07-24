# KartenSchach

Browser MVP for a card-driven chess variant. White is controlled by the human player, black is controlled by a simple random agent.

The binding game rules are documented in [`RULESET.md`](RULESET.md). If implementation details conflict with that file, the ruleset wins.

## Tech Stack

- React 18
- TypeScript
- Vite
- Vitest
- Testing Library
- `react-chessboard` for board presentation
- `@dnd-kit/core` for card drag-and-drop

## Requirements

- Node.js
- npm

## Install

```powershell
npm install
```

## Start The App

Run the local development server:

```powershell
npm run dev
```

Vite normally starts the app at:

```text
http://127.0.0.1:5173
```

Open that URL in your browser.

## Build

Create a production build:

```powershell
npm run build
```

## Lint

Run ESLint:

```powershell
npm run lint
```

## Test

Run the Vitest test suite:

```powershell
npm test
```

## Project Structure

- `src/domain.ts`: shared domain types
- `src/engine.ts`: framework-independent board, card, action, deck, turn, and random-agent logic
- `src/App.tsx`: React UI and reducer wiring
- `src/app.css`: responsive UI styles and card-draw animation
- `src/engine.test.ts`: core rule tests
- `RULESET.md`: full game rules
- `CODEX.md`: handoff notes for future development

## Current MVP Notes

- There is no check, checkmate, pinned-piece, or king-safety validation.
- Capturing the opposing king ends the game.
- The player must draw a figure card at the beginning of their turn.
- Cards can be clicked or dragged to the central play zone.
- Some rule-compliant UI flows are still simplified, especially action-card choices and promotion.
