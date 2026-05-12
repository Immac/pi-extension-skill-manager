import type { SourceAdapter } from '../types.js';
/**
 * Imports a skill from the knowledge base.
 * The ref is the article slug of a skill-source article.
 *
 * KB skill-source articles have a two-level structure:
 *   1. Outer frontmatter — KB metadata (type, kind, skill_name in tags, etc.)
 *   2. Body — contains inner frontmatter (name, description) + actual SKILL.md content
 *
 * This function strips the outer frontmatter and returns the inner content
 * (inner frontmatter + body) so it can be written directly as SKILL.md.
 */
export declare const kbSource: SourceAdapter;
//# sourceMappingURL=kb-source.d.ts.map