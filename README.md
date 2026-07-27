# KartenSchach

Browser MVP for a card-driven chess variant. White is controlled by the human player, black is controlled by a simple random agent.

The app also includes an online two-player mode backed by a Cloudflare Worker, Durable Object rooms, and WebSockets.

The binding game rules are documented in [`RULESET.md`](RULESET.md). If implementation details conflict with that file, the ruleset wins.

## Tech Stack

- React 18
- TypeScript
- Vite
- Vitest
- Testing Library
- `react-chessboard` for board presentation
- Cloudflare Workers, Durable Objects, and Wrangler for online multiplayer

## Requirements

- Node.js
- npm
- A Cloudflare account for Worker deployment

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

## Start The Online Worker Locally

Build the app and start Wrangler's local Miniflare/workerd server:

```powershell
npm run worker:dev
```

Wrangler normally serves the Worker, assets, Durable Object, and WebSocket routes at:

```text
http://127.0.0.1:8787
```

Use `Create online game` on the start screen to create a room. The owner URL contains the player token; the visible share link can be sent to the second player.

## Build

Create a production build:

```powershell
npm run build
```

## Deploy To GitHub Pages

This repository is configured for GitHub Pages at:

```text
https://STrucks.github.io/KartenSchach/
```

The deployment workflow is in `.github/workflows/deploy.yml`. It runs automatically whenever changes are pushed to `main`, and it can also be started manually from the GitHub Actions tab.

Before the first deployment, open the repository on GitHub and set:

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

Then push `main`:

```powershell
git push origin main
```

## Deploy To Cloudflare Workers

Log in to Cloudflare with Wrangler:

```powershell
npx wrangler login
```

If this is the first Worker on the account, register a `workers.dev` subdomain in the Cloudflare dashboard:

```text
Workers & Pages -> Overview -> workers.dev onboarding
```

Then deploy the Worker, static assets, and Durable Object migration:

```powershell
npm run worker:deploy
```

Cloudflare Workers also deploy automatically from GitHub Actions on pushes to `main`. Add these repository secrets in GitHub before relying on the workflow:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Required secret:

```text
CLOUDFLARE_API_TOKEN=<Cloudflare API token with Workers Scripts edit permission>
```

Create the API token in Cloudflare:

```text
Cloudflare Dashboard -> My Profile -> API Tokens -> Create Token
```

Use the Cloudflare Workers edit template if available, or create a custom token with Workers Scripts edit access for this account. Keep the token private; GitHub stores it encrypted as a secret.

Useful Worker commands:

```powershell
npm run worker:typecheck
npx wrangler whoami
npx wrangler deployments
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
- `src/OnlineGame.tsx`: online multiplayer UI and WebSocket client
- `src/onlineTypes.ts`: shared client/server messages and public views
- `worker/index.ts`: Cloudflare Worker and Durable Object game room
- `wrangler.jsonc`: Cloudflare Workers deployment config
- `src/app.css`: responsive UI styles and card-draw animation
- `src/engine.test.ts`: core rule tests
- `RULESET.md`: full game rules
- `CODEX.md`: handoff notes for future development

## Current MVP Notes

- There is no check, checkmate, pinned-piece, or king-safety validation.
- Capturing the opposing king ends the game.
- The player must draw a figure card at the beginning of their turn.
- Cards are selected by clicking or tapping them.
- Online rooms hide private hand contents and send opponent-safe event messages.
- Some rule-compliant UI flows are still simplified, especially action-card choices and promotion.
