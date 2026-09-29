import { describe, expect, it } from 'vitest';
import { LOD, lodAt, lodForZoom } from './lod';

const F = LOD.farBelow;
const h = LOD.hysteresis;

describe('lod', () => {
  it('uses thresholds without history', () => {
    expect(lodAt(0.25)).toBe('far');
    expect(lodAt(F - 0.001)).toBe('far');
    expect(lodAt(F)).toBe('mid');
    expect(lodAt(0.89)).toBe('mid');
    expect(lodAt(0.9)).toBe('near');
    expect(lodAt(1)).toBe('near');
  });
  it('has hysteresis around the far/mid boundary', () => {
    expect(lodForZoom(F + h / 2, 'far')).toBe('far');
    expect(lodForZoom(F + h * 1.5, 'far')).toBe('mid');
    expect(lodForZoom(F - h / 2, 'mid')).toBe('mid');
    expect(lodForZoom(F - h * 1.5, 'mid')).toBe('far');
  });
  it('has hysteresis around the mid/near boundary', () => {
    expect(lodForZoom(0.91, 'mid')).toBe('mid');
    expect(lodForZoom(0.94, 'mid')).toBe('near');
    expect(lodForZoom(0.89, 'near')).toBe('near');
    expect(lodForZoom(0.86, 'near')).toBe('mid');
  });
  it('can jump two levels', () => {
    expect(lodForZoom(1, 'far')).toBe('near');
    expect(lodForZoom(0.2, 'near')).toBe('far');
  });
});
