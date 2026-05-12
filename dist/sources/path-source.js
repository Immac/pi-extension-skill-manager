import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
/**
 * Imports a skill from a local file path.
 * The ref can be:
 *   - a path to a SKILL.md file
 *   - a path to a directory containing a SKILL.md file
 */
export const pathSource = {
    type: 'path',
    label: 'Local file path',
    refDescription: 'Path to a SKILL.md file or a directory containing one',
    fetch(ref, _params) {
        let skillPath = ref.trim();
        // If it's a directory, look for SKILL.md inside
        try {
            const stat = fs.statSync(skillPath);
            if (stat.isDirectory()) {
                skillPath = path.join(skillPath, 'SKILL.md');
            }
        }
        catch {
            return null;
        }
        if (!fs.existsSync(skillPath))
            return null;
        try {
            const raw = fs.readFileSync(skillPath, 'utf-8');
            const parsed = matter(raw);
            const name = parsed.data.name;
            const description = parsed.data.description;
            if (!name)
                return null;
            return {
                name: String(name),
                description: description ? String(description) : '',
                content: raw,
            };
        }
        catch {
            return null;
        }
    },
};
//# sourceMappingURL=path-source.js.map