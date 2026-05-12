import type { SourceAdapter, SourceType } from '../types.js';
/** Get a source adapter by type */
export declare function getSource(type: SourceType): SourceAdapter | undefined;
/** List all registered source types */
export declare function listSources(): SourceAdapter[];
/**
 * Register a new source adapter at runtime.
 * Useful for extensions that want to add custom sources.
 */
export declare function registerSource(adapter: SourceAdapter): void;
//# sourceMappingURL=registry.d.ts.map