import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isTutorialCompleted,
  markTutorialCompleted,
  TUTORIAL_STORAGE_KEY,
  LEGACY_TUTORIAL_KEY,
} from './FirstTimeHint';

class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] || null;
  }
}

describe('First-Time Tutorial Persistence', () => {
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', {});
  });

  it('detects first-time player when neither key is set', () => {
    expect(isTutorialCompleted()).toBe(false);
  });

  it('marks tutorial as completed in localStorage with vanishxo_tutorial_done', () => {
    markTutorialCompleted();
    expect(mockStorage.getItem(TUTORIAL_STORAGE_KEY)).toBe('true');
    expect(isTutorialCompleted()).toBe(true);
  });

  it('recognizes returning player who completed legacy tutorial', () => {
    mockStorage.setItem(LEGACY_TUTORIAL_KEY, 'true');
    expect(isTutorialCompleted()).toBe(true);
  });

  it('safely handles localStorage throwing errors', () => {
    vi.spyOn(mockStorage, 'getItem').mockImplementation(() => {
      throw new Error('Access denied');
    });

    expect(() => isTutorialCompleted()).not.toThrow();
    // Fallback on error is true to avoid repeatedly trapping the user
    expect(isTutorialCompleted()).toBe(true);

    vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(() => markTutorialCompleted()).not.toThrow();
  });
});
