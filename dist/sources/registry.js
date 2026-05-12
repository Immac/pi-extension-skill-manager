import { pathSource } from './path-source.js';
import { kbSource } from './kb-source.js';
/**
 * Registry of all available source adapters.
 * Add a new source by implementing SourceAdapter and registering it here.
 */
const adapters = new Map();
// Register built-in sources
adapters.set('path', pathSource);
adapters.set('kb', kbSource);
/** Get a source adapter by type */
export function getSource(type) {
    return adapters.get(type);
}
/** List all registered source types */
export function listSources() {
    return Array.from(adapters.values());
}
/**
 * Register a new source adapter at runtime.
 * Useful for extensions that want to add custom sources.
 */
export function registerSource(adapter) {
    adapters.set(adapter.type, adapter);
}
//# sourceMappingURL=registry.js.map