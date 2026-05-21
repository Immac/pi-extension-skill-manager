import { describe, it, expect } from 'vitest';
import { getSource, listSources, registerSource } from '../sources/registry.js';

describe('sources/registry.ts', () => {
  it('getSource returns path adapter', () => {
    const adapter = getSource('path');
    expect(adapter).toBeDefined();
    expect(adapter!.type).toBe('path');
  });

  it('getSource returns kb adapter', () => {
    const adapter = getSource('kb');
    expect(adapter).toBeDefined();
    expect(adapter!.type).toBe('kb');
  });

  it('getSource returns undefined for unknown type', () => {
    expect(getSource('unknown' as any)).toBeUndefined();
  });

  it('listSources returns both built-in sources', () => {
    const sources = listSources();
    expect(sources).toHaveLength(2);
    const types = sources.map(s => s.type).sort();
    expect(types).toEqual(['kb', 'path']);
  });

  it('registerSource adds a new source adapter', () => {
    const mockAdapter = {
      type: 'test' as any,
      fetch: () => null,
      label: 'Test Source',
      refDescription: 'A test ref',
    };
    registerSource(mockAdapter);
    expect(getSource('test' as any)).toBe(mockAdapter);
  });
});
