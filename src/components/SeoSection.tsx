import React from 'react';

export const SeoSection: React.FC = () => {
  return (
    <footer className="w-full max-w-2xl mx-auto mt-16 px-4 py-8 border-t border-slate-800/80 text-slate-400 text-sm leading-relaxed">
      <div className="space-y-6">
        <header className="space-y-2">
          <h2 className="text-lg font-bold text-slate-200 tracking-tight">
            About Vanish XO
          </h2>
          <p className="text-slate-400">
            <strong>Vanish XO</strong> is a modern tactical reinvention of classic Tic-Tac-Toe.
            While traditional Tic-Tac-Toe often ends in a repetitive draw, Vanish XO introduces an
            unforgiving rule: <em>each player can only have three marks on the grid at any given moment</em>.
          </p>
        </header>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-cyan-400">
            How The Vanishing Twist Works
          </h3>
          <ul className="list-disc list-inside space-y-1.5 text-slate-300">
            <li>
              <strong>3-Mark Limit:</strong> When you place your 4th mark, your 1st (oldest) mark dissolves off the board.
            </li>
            <li>
              <strong>Order of Play:</strong> The oldest mark is removed before evaluating the 3-in-a-row victory check.
            </li>
            <li>
              <strong>No Draws:</strong> Because there are at most 6 marks on the 9-cell grid, a draw is impossible. One player will always outmaneuver the other.
            </li>
            <li>
              <strong>Visual Age Indicators:</strong> Marks visibly transition from vivid neon to a fading pulse, alerting you before they vanish.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-pink-400">
            Game Modes & Artificial Intelligence
          </h3>
          <p className="text-slate-400">
            Challenge our built-in AI across three distinct levels — <strong>Easy</strong>, <strong>Medium</strong> (which predicts wins and actively blocks), and <strong>Hard</strong> (powered by a minimax algorithm with full vanishing simulation) — or play locally with a friend using <strong>Pass &amp; Play</strong>.
          </p>
        </section>

        <div className="pt-4 text-center text-xs text-slate-600">
          Vanish XO &copy; 2026 &bull; Built with Next.js, TypeScript &amp; Tailwind CSS
        </div>
      </div>
    </footer>
  );
};
