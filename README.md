# Vanish XO

A mobile-first tactical web game: **Tic-tac-toe where each player can only have 3 marks on the board**. Placing a 4th mark causes that player's **oldest mark to vanish**. There are no draws!

Built with **Next.js (App Router)** + **TypeScript** + **Tailwind CSS** + **Framer Motion** + **PartyKit** authoritative real-time multiplayer.  
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

- **Online Multiplayer (PartyKit)**:
  - Authoritative PartyKit server in `/party/server.ts` enforcing pure logic from `/lib/game`.
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
- **Multiplayer Server**: PartyKit WebSocket server (`/party/server.ts`, `/party/room.ts`) with Zod schema validation.
- **Shared Pure Game Logic**: Isolated in `/lib/game.ts` (`placeMark`, `placeRoomMark`, `getWinner`, `getNextVanish`, `getRoomBotMove`). Shared by client and server with zero browser or React dependencies.
- **Testing**: Vitest (`pnpm test`) covering game logic, room handlers, timeouts, and live PartyKit integration.

---

## 🚀 Running Locally (pnpm only)

> **Important**: This project exclusively uses `pnpm`. Do not use npm or yarn.

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run the PartyKit Server (in one terminal)
```bash
pnpm party:dev
```
The PartyKit server runs on `http://127.0.0.1:1999`.

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

| Variable | Description | Default (Local) |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_PARTYKIT_HOST` | Hostname of the PartyKit server (without protocol) | `localhost:1999` |

Create a `.env.local` file for production deployment:
```env
NEXT_PUBLIC_PARTYKIT_HOST=vanish-xo.<your-partykit-subdomain>.partykit.dev
```

---

## 🚢 Deployment

### 1. Deploy the PartyKit Server
Deploy the authoritative game server to PartyKit's edge platform:
```bash
pnpm party:deploy
```
This provisions your server at `vanish-xo.<your-partykit-subdomain>.partykit.dev`.

### 2. Deploy the Next.js Frontend to Vercel
1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. In Vercel Project Settings &gt; **Environment Variables**, add:
   - `NEXT_PUBLIC_PARTYKIT_HOST`: `vanish-xo.<your-partykit-subdomain>.partykit.dev`
4. Click **Deploy**.
