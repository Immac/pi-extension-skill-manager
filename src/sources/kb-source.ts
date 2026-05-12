import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import matter from 'gray-matter';
import type { SourceAdapter, SourceSkillData } from '../types.js';

/**
 * Resolves the knowledge base directory.
 * Checks KB_SKILLS_KB_PATH env var, then default ~/.pi/knowledge-base/
 */
function resolveKbDir(): string {
  return process.env.KB_SKILLS_KB_PATH || path.join(os.homedir(), '.pi', 'knowledge-base');
}

/**
 * Resolve a slug to an article file path.
 * Tries local (cwd/.pi/knowledge-base/) then global (~/.pi/knowledge-base/).
 * KB articles are stored as directories with an ARTICLE.md inside.
 */
function resolveArticlePath(slug: string, cwd?: string): string | null {
  const candidates: string[] = [];

  if (cwd) {
    candidates.push(path.join(cwd, '.pi', 'knowledge-base', 'articles', slug, 'ARTICLE.md'));
  }
  candidates.push(path.resolve(resolveKbDir(), 'articles', slug, 'ARTICLE.md'));

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Extract a value from a KB tags array by prefix (e.g. "skill_name:" -> "value").
 * Tags are stored as "key:value" strings.
 */
function tagValue(tags: unknown[], prefix: string): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  for (const tag of tags) {
    if (typeof tag === 'string' && tag.startsWith(prefix)) {
      return tag.slice(prefix.length);
    }
  }
  return undefined;
}

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
export const kbSource: SourceAdapter = {
  type: 'kb',
  label: 'Knowledge base',
  refDescription: 'Slug of a skill-source article in the knowledge base (e.g. my-analyzer-skill-source)',

  fetch(ref: string, params?: Record<string, string>): SourceSkillData | null {
    const slug = ref.trim();
    const cwd = params?.cwd;

    const articlePath = resolveArticlePath(slug, cwd);
    if (!articlePath) return null;

    try {
      const raw = fs.readFileSync(articlePath, 'utf-8');

      // Parse outer frontmatter (KB article metadata)
      const outerParsed = matter(raw);

      // Extract skill metadata from tags array (e.g. "skill_name:my-skill")
      const tags: unknown[] = Array.isArray(outerParsed.data.tags) ? outerParsed.data.tags : [];
      const name = tagValue(tags, 'skill_name:') || outerParsed.data.skill_name || outerParsed.data.name;
      const description = tagValue(tags, 'skill_description:') || outerParsed.data.skill_description || outerParsed.data.description;

      if (!name) {
        // Try parsing inner frontmatter for a fallback name
        const innerParsed = matter(outerParsed.content);
        if (innerParsed.data.name) {
          return {
            name: String(innerParsed.data.name),
            description: innerParsed.data.description ? String(innerParsed.data.description) : '',
            content: outerParsed.content,
          };
        }
        return null;
      }

      // `content` is the body after stripping outer frontmatter.
      // It may contain inner frontmatter for the SKILL.md itself —
      // that's the frontmatter pi's skill loader expects.
      return {
        name: String(name),
        description: description ? String(description) : '',
        content: outerParsed.content,
      };
    } catch {
      return null;
    }
  },
};
