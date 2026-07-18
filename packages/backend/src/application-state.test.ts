import { describe, expect, it } from 'vitest';
import { deriveApplicationState } from './application-state';

describe('deriveApplicationState', () => {
  it('moves a rejected application to closed', () => {
    expect(deriveApplicationState([{ date: '2026-07-18', name: '1次面接', result: '不合格' }]))
      .toEqual({ status: '終了', currentStep: '1次面接' });
  });

  it('moves a withdrawn application to closed', () => {
    expect(deriveApplicationState([{ date: '2026-07-18', name: '説明会', result: '辞退' }]).status)
      .toBe('終了');
  });

  it('moves a final interview pass to offer', () => {
    expect(deriveApplicationState([{ date: '2026-07-18', name: '最終面接', result: '合格' }]).status)
      .toBe('内定');
  });

  it('keeps an in-progress application open', () => {
    expect(deriveApplicationState([{ date: '2026-07-18', name: '1次面接', result: '合格' }]))
      .toEqual({ status: undefined, currentStep: '1次面接' });
  });
});
