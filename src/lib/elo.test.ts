import { describe, it, expect } from 'vitest';
import { calculateElo, getExpectedScore, INITIAL_RATING, K_FACTOR } from './elo';

describe('Elo Rating System', () => {
  it('has initial rating 1000 and K=32', () => {
    expect(INITIAL_RATING).toBe(1000);
    expect(K_FACTOR).toBe(32);
  });

  it('calculates equal expected scores for identical ratings', () => {
    const expected = getExpectedScore(1000, 1000);
    expect(expected).toBe(0.5);
  });

  it('calculates expected score correctly for higher rated player', () => {
    const expected = getExpectedScore(1200, 1000);
    expect(expected).toBeGreaterThan(0.75);
    expect(expected).toBeLessThan(0.77);
  });

  it('updates ratings correctly when player wins with K=32', () => {
    // Both 1000, win for A
    const res = calculateElo(1000, 1000, 1);
    expect(res.deltaA).toBe(16);
    expect(res.deltaB).toBe(-16);
    expect(res.newRatingA).toBe(1016);
    expect(res.newRatingB).toBe(984);
  });

  it('updates ratings correctly on loss', () => {
    // Both 1000, loss for A
    const res = calculateElo(1000, 1000, 0);
    expect(res.deltaA).toBe(-16);
    expect(res.deltaB).toBe(16);
    expect(res.newRatingA).toBe(984);
    expect(res.newRatingB).toBe(1016);
  });

  it('awards minimal points when heavily favored player wins', () => {
    const res = calculateElo(1500, 800, 1);
    expect(res.deltaA).toBeLessThanOrEqual(2);
    expect(res.newRatingA).toBe(1500 + res.deltaA);
  });

  it('awards huge upset points when underdog wins', () => {
    const res = calculateElo(800, 1500, 1);
    expect(res.deltaA).toBeGreaterThanOrEqual(30);
    expect(res.newRatingA).toBe(800 + res.deltaA);
  });

  it('handles draws evenly between equal players', () => {
    const res = calculateElo(1000, 1000, 0.5);
    expect(res.deltaA).toBe(0);
    expect(res.deltaB).toBe(0);
    expect(res.newRatingA).toBe(1000);
    expect(res.newRatingB).toBe(1000);
  });
});
