import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import matter from 'gray-matter';
/**
 * Resolves the knowledge base directory.
 * Checks KB_SKILLS_KB_PATH env var, then default ~/.pi/knowledge-base/
 */
function resolveKbDir() {
    return process.env.KB_SKILLS_KB_PATH || path.join(os.homedir(), '.pi', 'knowledge-base');
}
/**
 * Resolve a slug to an article file path.
 * Tries local (cwd/.pi/knowledge-base/) then global (~/.pi/knowledge-base/).
 */
function resolveArticlePath(slug, cwd) {
    const candidates = [];
    // Project-local KB first
    if (cwd) {
        candidates.push(path.join(cwd, '.pi', 'knowledge-base', 'articles', `${slug}.md`));
    }
    // Global KB
    candidates.push(path.resolve(resolveKbDir(), 'articles', `${slug}.md`));
    for (const p of candidates) {
        if (fs.existsSync(p))
            return p;
    }
    return null;
}
/**
 * Imports a skill from the knowledge base.
 * The ref is the article slug of a skill-source article.
 */
export const kbSource = {
    type: 'kb',
    label: 'Knowledge base',
    refDescription: 'Slug of a skill-source article in the knowledge base (e.g. my-analyzer-skill-source)',
    fetch(ref, params) {
        const slug = ref.trim();
        const cwd = params?.cwd;
        const articlePath = resolveArticlePath(slug, cwd);
        if (!articlePath)
            return null;
        try {
            const raw = fs.readFileSync(articlePath, 'utf-8');
            const parsed = matter(raw);
            // Outer tags/content may define the skill
            const name = parsed.data.skill_name || parsed.data.name;
            const description = parsed.data.skill_description || parsed.data.description;
            if (!name)
                return null;
            // The skill content is the body of the KB article
            // (may have inner frontmatter for the SKILL.md itself)
            return {
                name: String(name),
                description: description ? String(description) : '',
                content: raw, // full article content — the skill materializer will parse it
            };
        }
        catch {
            return null;
        }
    },
};
//# sourceMappingURL=kb-source.js.map