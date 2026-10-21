export const INITIAL_RATING = 1000;
export const K_FACTOR = 32;

/**
 * Calculates the expected score for player A when facing player B.
 * Returns a value between 0 and 1.
 */
export function getExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface EloCalculationResult {
  newRatingA: number;
  newRatingB: number;
  deltaA: number;
  deltaB: number;
}

/**
 * Calculates updated Elo ratings for player A and player B.
 * @param ratingA Current rating of player A
 * @param ratingB Current rating of player B
 * @param scoreA Actual score for player A (1 = win, 0 = loss, 0.5 = draw)
 */
export function calculateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number
): EloCalculationResult {
  const expectedA = getExpectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;
  const scoreB = 1 - scoreA;

  const deltaA = Math.round(K_FACTOR * (scoreA - expectedA));
  const deltaB = Math.round(K_FACTOR * (scoreB - expectedB));

  return {
    newRatingA: Math.max(100, ratingA + deltaA),
    newRatingB: Math.max(100, ratingB + deltaB),
    deltaA,
    deltaB,
  };
}

/**
 * Default Elo ratings for bot opponents.
 */
export const BOT_RATINGS: Record<string, number> = {
  'bot-easy': 800,
  'bot-medium': 1000,
  'bot-hard': 1200,
};
