# Vanish XO

A mobile-first tactical web game: **Tic-tac-toe where each player can only have 3 marks on the board**. Placing a 4th mark causes that player's **oldest mark to vanish**. There are no draws!

Built with **Next.js (App Router)** + **TypeScript** + **Tailwind CSS** + **Framer Motion**.  
Dark neon aesthetic featuring electric cyan X and hot pink O.

---

## ⚡ Game Rules

1. **3x3 Board**: Two players alternate turns placing marks on empty cells.
2. **3-Mark Maximum**: Each player maintains a FIFO queue of their marks (up to 3 marks).
3. **The Vanish Twist**: When placing a 4th mark, that player's oldest mark is removed from the board.
4. **Vanish-Before-Win Order**: The oldest mark vanishes **first**, and only then is the 3-in-a-row win condition evaluated. (Momentary 4-in-a-row formations with the discarded mark do not count).
5. **No Draws**: Because at most 6 marks exist on the 9-cell board at any time, a draw is impossible.

---

## 👁️ Visual Teaching

The UI requires no reading to learn and play:
- **Oldest Mark Warning**: When a player has 3 marks, their oldest mark pulses, shrinks slightly, and dims with a dashed warning ring.
- **Age Differentiation**:
  - *Newest Mark*: Brightest, solid, vivid neon glow.
  - *Middle Mark*: Moderately dim, softer glow.
  - *Oldest Mark*: Faded with subtle flicker.
- **Dissolve Particle Effect**: When a mark vanishes, an animated 400ms particle explosion bursts outward from the cell.
- **Turn Indicators**: Subtle colored glow along the board edge and glowing outlines on the active player's badge.
- **Victory Celebration**: Winning line blazes in gold, non-winning marks dim, and confetti erupts with a single **AGAIN** button.
- **First-Time Hint**: A looping, zero-word visual demonstration displays on first load, stored in `localStorage` once dismissed.

---

## 🎮 Modes

- **Play vs Bot (Default)**:
  - **Easy**: Random valid moves.
  - **Medium**: Seizes immediate winning moves and blocks opponent threats while factoring in the vanishing rule.
  - **Hard**: Minimax algorithm with alpha-beta pruning and cycle detection that simulates future vanishing moves.
  - Natural 500ms bot reaction time.
- **Pass and Play**: Local 2-player mode on the same device.
- **Invite a Friend**: Serializable game state foundation with share link copy.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4 + custom neon glow filters & keyframes
- **Animation**: Framer Motion
- **Unit Testing**: Vitest
- **Audio & Haptics**: Native Web Audio API synthesizer (zero external audio dependencies) & Mobile vibration API

Pure game logic is isolated in `src/lib/game.ts` (`placeMark`, `getWinner`, `getNextVanish`, `getBotMove`) with 100% serializable state.

---

## 🚀 Commands (pnpm only)

> **Important**: This project exclusively uses `pnpm`. Do not use npm or yarn.

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Unit Tests
```bash
pnpm test
```

### 4. Code Quality & Linting
```bash
pnpm lint
```

### 5. Production Build & Static Generation
```bash
pnpm build
```

### 6. Run Production Server
```bash
pnpm start
```

### 7. Deployment
To deploy to Vercel or any Node.js hosting platform:
```bash
pnpm build
```
Deploy the output bundle using standard Vercel or container commands configured with `pnpm`.
