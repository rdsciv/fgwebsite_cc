import { describe, expect, it } from 'vitest';
import { isFormerOwner, tenure } from './former';
import type { Owner } from '../types';

const owner = (seasonsPlayed: number[]) => ({ seasonsPlayed }) as unknown as Owner;

describe('isFormerOwner', () => {
  it('treats a franchise in the latest season as active', () => {
    expect(isFormerOwner(owner([2014, 2015, 2025]), 2025)).toBe(false);
  });

  it('treats a franchise that stopped before the latest season as former', () => {
    expect(isFormerOwner(owner([2016, 2023]), 2025)).toBe(true);
  });

  it('counts a single-season franchise as former once the league moves on', () => {
    expect(isFormerOwner(owner([2014]), 2025)).toBe(true);
    expect(isFormerOwner(owner([2025]), 2025)).toBe(false);
  });

  it('treats a franchise with no recorded seasons as former rather than crashing', () => {
    expect(isFormerOwner(owner([]), 2025)).toBe(true);
  });

  it('does not mark a gap year as former if the franchise returned', () => {
    // Sat out 2024, back in 2025 — still active.
    expect(isFormerOwner(owner([2022, 2023, 2025]), 2025)).toBe(false);
  });
});

describe('tenure', () => {
  it('renders a span for multi-season franchises', () => {
    expect(tenure(owner([2016, 2017, 2023]))).toBe('2016–2023');
  });

  it('renders a single year for one-and-done franchises', () => {
    expect(tenure(owner([2014]))).toBe('2014');
  });

  it('renders nothing when there are no seasons', () => {
    expect(tenure(owner([]))).toBe('');
  });
});
