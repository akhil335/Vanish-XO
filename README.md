# Vanish XO

A mobile-first tactical web game: **Tic-tac-toe where each player can only have 3 marks on the board**. Placing a 4th mark causes that player's **oldest mark to vanish**. There are no draws!

Built with **Next.js (App Router)** + **TypeScript** + **Tailwind CSS** + **Framer Motion** + **PartyServer** authoritative real-time multiplayer on Cloudflare Workers.  
Dark neon aesthetic featuring electric cyan X, hot pink O, neon yellow ▲, and neon purple ■.

---

## ⚡ Game Rules

1. **3x3 Board**: Players alternate turns placing marks on empty cells.
2. **3-Mark Maximum**: Each player maintains a FIFO queue of their marks (up to 3 marks).
3. **The Vanish Twist**: When placing a 4th mark, that player's oldest mark is removed from the board.
4. **Vanish-Before-Win Order**: The oldest mark vanishes **first**, and only then is the 3-in-a-row win condition evaluated. (Momentary 4-in-a-row formations with the discarded mark do not count).
5. **No Draws**: Because at most 6 marks exist on the 9-cell board at any time, a draw is impossible.

---

## 👁️ Visual Teaching (Zero Reading Required)

The UI requires no reading to learn and play:
- **Oldest Mark Warning**: When a player has 3 marks, their oldest mark pulses, shrinks slightly, and dims with a dashed warning ring.
- **Age Differentiation**:
  - *Newest Mark*: Brightest, solid, vivid neon bloom.
  - *Middle Mark*: Moderately dim, softer glow.
  - *Oldest Mark*: Faded with subtle flicker.
- **Dissolve Particle Effect**: When a mark vanishes, an animated 400ms particle explosion bursts outward from the cell.
- **Turn Indicators & Timer**: Subtle colored glow along the board edge and glowing outlines on the active player's badge. In online mode, a thin 20s countdown bar wraps the active player card without text.
- **Connection Dots**: Connected players show a solid glowing dot; disconnected players show a hollow pulsing red ring.
- **Victory Celebration**: Winning line blazes in gold, non-winning marks dim, and confetti erupts with a single **AGAIN** button.
- **First-Time Hint**: A looping, zero-word visual demonstration displays on first load, stored in `localStorage` once dismissed.

---

## 🎮 Modes

- **Online Multiplayer (PartyServer on Cloudflare Workers)**:
  - Authoritative realtime server in `/realtime/server.ts` enforcing pure logic from `/lib/game`.
  - 4-character room codes (`/room/CODE`) without ambiguous characters (`no 0, O, 1, I`).
  - Host configures 2, 3, or 4 seats; empty seats can be filled with server-run bots or joined by friends.
  - Instant join with no signups or menus; shapes & colors assigned by seat.
  - Spectator support for full rooms (live read-only).
  - Turn timers (20s) with auto-play on timeout.
  - Reconnect recovery with random `playerId` stored in `localStorage`.
  - Disconnect handling: auto-plays after 20s offline during turn; server bot takes over after 60s offline.
  - Rematch rotates starting player.
- **Play vs Bot (Offline)**:
  - **Easy**: Random valid moves.
  - **Medium**: Seizes immediate winning moves and blocks opponent threats while factoring in the vanishing rule.
  - **Hard**: Minimax algorithm with alpha-beta pruning and cycle detection that simulates future vanishing moves.
- **Pass and Play**: Local 2-player mode on the same device.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, Framer Motion, canvas-confetti, Lucide icons.
- **Multiplayer Server**: PartyServer WebSocket Durable Objects on Cloudflare Workers (`/realtime/server.ts`, `/realtime/room.ts`, `/realtime/lobby.ts`) with Zod schema validation.
- **Shared Pure Game Logic**: Isolated in `/lib/game.ts` (`placeMark`, `placeRoomMark`, `getWinner`, `getNextVanish`, `getRoomBotMove`). Shared by client and server with zero browser or React dependencies.
- **Testing**: Vitest (`pnpm test`) covering game logic, room handlers, timeouts, and live class integration.

---

## 🚀 Running Locally (pnpm only)

> **Important**: This project exclusively uses `pnpm`. Do not use npm or yarn.

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run the Realtime Server (in one terminal)
```bash
pnpm realtime:dev
```
The realtime server runs on `http://localhost:8787` (via Wrangler).

### 3. Run the Next.js Frontend (in a second terminal)
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Unit & Integration Tests
```bash
pnpm test
```

### 5. Linting & Type Checking
```bash
pnpm lint
```

### 6. Production Build
```bash
pnpm build
```

---

## 🌐 Environment Variables

See `.env.example` for the environment template.

| Variable | Description | Default (Local) | Example (Production) |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_REALTIME_HOST` | Bare hostname of realtime server (no protocol, port, or trailing slash) | `localhost:8787` (development only) | `vanish-xo.<your-subdomain>.workers.dev` |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL of the web frontend (used for Open Graph, invite links, sitemap) | `http://localhost:3000` | `https://vanish-xo.vercel.app` | `https://vanishxo.online/`

---

## 🚢 Deploy

Follow these steps to deploy Vanish XO to production:

1. **Cloudflare Account & Login**:
   Create a free [Cloudflare](https://dash.cloudflare.com/sign-up) account, then authenticate Wrangler:
   ```bash
   pnpm wrangler login
   ```

2. **Deploy the Realtime Server**:
   Deploy the Cloudflare Worker with SQLite-backed Durable Objects:
   ```bash
   pnpm realtime:deploy
   ```
   Copy the printed `workers.dev` host from the output (e.g., `vanish-xo.<your-subdomain>.workers.dev`).

3. **Set Environment Variables in Vercel**:
   Import your repository into [Vercel](https://vercel.com) and set the environment variables in **Project Settings > Environment Variables**:
   - `NEXT_PUBLIC_REALTIME_HOST`: Your bare host only (e.g., `vanish-xo.<your-subdomain>.workers.dev`), omitting `https://`, ports, or trailing slashes.
   - `NEXT_PUBLIC_SITE_URL`: Your web domain with protocol (e.g., `https://vanishxo.online/`).

4. **Redeploy Vercel**:
   Next.js bakes `NEXT_PUBLIC_*` variables into the static bundle at **build time**. If setting or modifying these variables, trigger a redeploy in Vercel (via **Deployments > ... > Redeploy**) so the build bakes in the new values.

5. **Enable Analytics in Vercel Dashboard**:
   Navigate to the **Analytics** tab in your Vercel project dashboard and click **Enable**. The app tracks gameplay actions anonymously with zero personal data.

6. **Troubleshooting**:
   - **Wrong Host Format**: Ensure `NEXT_PUBLIC_REALTIME_HOST` is a bare hostname without `https://`, `wss://`, port numbers, or trailing slashes.
   - **Missing Redeploy**: If client rooms show "server busy" or fail to reach the worker, ensure Vercel was redeployed after environment variables were saved.
   - **WS vs WSS Protocol**: `ws://` is strictly restricted to `localhost:8787` in development. In production, `wss://` is automatically enforced on remote hosts.
   - **Live Worker Logs**: Inspect real-time logs and verify room lifecycle and alarm triggers by running:
     ```bash
     pnpm wrangler tail
     ```
