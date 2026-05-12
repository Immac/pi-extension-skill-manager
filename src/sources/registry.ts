import type { SourceAdapter, SourceType } from '../types.js';
import { pathSource } from './path-source.js';
import { kbSource } from './kb-source.js';

/**
 * Registry of all available source adapters.
 * Add a new source by implementing SourceAdapter and registering it here.
 */
const adapters: Map<SourceType, SourceAdapter> = new Map();

// Register built-in sources
adapters.set('path', pathSource);
adapters.set('kb', kbSource);

/** Get a source adapter by type */
export function getSource(type: SourceType): SourceAdapter | undefined {
  return adapters.get(type);
}

/** List all registered source types */
export function listSources(): SourceAdapter[] {
  return Array.from(adapters.values());
}

/**
 * Register a new source adapter at runtime.
 * Useful for extensions that want to add custom sources.
 */
export function registerSource(adapter: SourceAdapter): void {
  adapters.set(adapter.type, adapter);
}
