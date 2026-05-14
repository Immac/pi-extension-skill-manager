import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// Global vault (default — no projectDir)
export const GLOBAL_VAULT_DIR = path.join(os.homedir(), '.skill-manager');
export const GLOBAL_SKILLS_DIR = path.join(GLOBAL_VAULT_DIR, 'skills');
export const GLOBAL_REGISTRY_PATH = path.join(GLOBAL_VAULT_DIR, 'registry.json');
// Backward-compat aliases
export const VAULT_DIR = GLOBAL_VAULT_DIR;
export const SKILLS_DIR = GLOBAL_SKILLS_DIR;
export const REGISTRY_PATH = GLOBAL_REGISTRY_PATH;
const REGISTRY_VERSION = 1;
/**
 * Resolve vault paths based on scope.
 * When projectDir is provided, uses <projectDir>/.skill-manager/.
 * Otherwise uses the global ~/.skill-manager/.
 */
function resolvePaths(projectDir) {
    const root = projectDir
        ? path.resolve(projectDir, '.skill-manager')
        : path.join(os.homedir(), '.skill-manager');
    return {
        vaultDir: root,
        skillsDir: path.join(root, 'skills'),
        registryPath: path.join(root, 'registry.json'),
    };
}
function ensureVault(skillsDir) {
    if (!fs.existsSync(skillsDir)) {
        fs.mkdirSync(skillsDir, { recursive: true });
    }
}
function readRegistry(registryPath, skillsDir) {
    ensureVault(skillsDir);
    try {
        if (fs.existsSync(registryPath)) {
            const raw = fs.readFileSync(registryPath, 'utf-8');
            return JSON.parse(raw);
        }
    }
    catch {
        // corrupted — start fresh
    }
    return { version: REGISTRY_VERSION, skills: [] };
}
function writeRegistry(registryPath, skillsDir, reg) {
    ensureVault(skillsDir);
    fs.writeFileSync(registryPath, JSON.stringify(reg, null, 2), 'utf-8');
}
/**
 * Validate a skill name does not contain path traversal components.
 * Throws if invalid.
 */
function assertSafeSkillName(name, skillsDir) {
    const resolved = path.resolve(skillsDir, name);
    if (!resolved.startsWith(skillsDir + path.sep) && resolved !== skillsDir) {
        throw new Error(`Invalid skill name "${name}" - path traversal detected.`);
    }
}
/** Import a skill into the vault */
export function importSkill(input, projectDir) {
    const { skillsDir, registryPath } = resolvePaths(projectDir);
    const reg = readRegistry(registryPath, skillsDir);
    // Check for duplicate
    const existing = reg.skills.find(s => s.name === input.name);
    if (existing) {
        return {
            success: false,
            message: `Skill "${input.name}" already exists in vault (source: ${existing.sourceType}:${existing.sourceRef}). Remove it first or use a different name.`,
        };
    }
    let skillDir;
    try {
        assertSafeSkillName(input.name, skillsDir);
        skillDir = path.join(skillsDir, input.name);
    }
    catch (e) {
        return { success: false, message: e.message };
    }
    if (fs.existsSync(skillDir)) {
        // Clean up orphaned directory
        fs.rmSync(skillDir, { recursive: true, force: true });
    }
    fs.mkdirSync(skillDir, { recursive: true });
    // Write SKILL.md
    const skillPath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillPath, input.content, 'utf-8');
    // Write SOURCE.json — metadata linking back to the source
    const sourceMeta = {
        name: input.name,
        description: input.description || '',
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        importedAt: Date.now(),
    };
    fs.writeFileSync(path.join(skillDir, 'SOURCE.json'), JSON.stringify(sourceMeta, null, 2), 'utf-8');
    const skill = {
        name: input.name,
        description: input.description || '',
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        vaultPath: skillDir,
        installedAt: Date.now(),
        enabled: true,
    };
    reg.skills.push(skill);
    writeRegistry(registryPath, skillsDir, reg);
    return {
        success: true,
        message: `Imported skill "${input.name}" into vault from ${input.sourceType}:${input.sourceRef}`,
        skill,
    };
}
/** Update a skill in the vault (replace content and metadata, preserving vault location) */
export function updateSkill(input, projectDir) {
    const { skillsDir, registryPath } = resolvePaths(projectDir);
    const reg = readRegistry(registryPath, skillsDir);
    // Check it exists
    const existing = reg.skills.find(s => s.name === input.name);
    if (!existing) {
        return {
            success: false,
            message: `Skill "${input.name}" not found in vault. Import it first.`,
        };
    }
    let skillDir;
    try {
        assertSafeSkillName(input.name, skillsDir);
        skillDir = path.join(skillsDir, input.name);
    }
    catch (e) {
        return { success: false, message: e.message };
    }
    if (!fs.existsSync(skillDir)) {
        return {
            success: false,
            message: `Skill directory for "${input.name}" not found (expected ${skillDir}). Remove and re-import.`,
        };
    }
    // Write updated SKILL.md
    const skillPath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillPath, input.content, 'utf-8');
    // Write updated SOURCE.json
    const sourceMeta = {
        name: input.name,
        description: input.description || '',
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        importedAt: existing.installedAt,
        updatedAt: Date.now(),
    };
    fs.writeFileSync(path.join(skillDir, 'SOURCE.json'), JSON.stringify(sourceMeta, null, 2), 'utf-8');
    // Update registry entry
    existing.description = input.description || '';
    existing.sourceType = input.sourceType;
    existing.sourceRef = input.sourceRef;
    writeRegistry(registryPath, skillsDir, reg);
    return {
        success: true,
        message: `Updated skill "${input.name}" in vault (source: ${input.sourceType}:${input.sourceRef})`,
        skill: existing,
    };
}
/** Remove a skill from the vault */
export function removeSkill(name, projectDir) {
    const { skillsDir, registryPath } = resolvePaths(projectDir);
    const reg = readRegistry(registryPath, skillsDir);
    const idx = reg.skills.findIndex(s => s.name === name);
    if (idx === -1) {
        return { success: false, message: `Skill "${name}" not found in vault.` };
    }
    const skill = reg.skills[idx];
    // Delete skill directory
    try {
        assertSafeSkillName(name, skillsDir);
        const skillDir = path.join(skillsDir, name);
        if (fs.existsSync(skillDir)) {
            fs.rmSync(skillDir, { recursive: true, force: true });
        }
    }
    catch {
        // name validation failed — skip directory deletion
    }
    reg.skills.splice(idx, 1);
    writeRegistry(registryPath, skillsDir, reg);
    return {
        success: true,
        message: `Removed skill "${name}" from vault.`,
        skill,
    };
}
/** List all skills in the vault */
export function listVaultSkills(projectDir) {
    const { registryPath, skillsDir } = resolvePaths(projectDir);
    const reg = readRegistry(registryPath, skillsDir);
    return reg.skills;
}
/** Get a single skill by name */
export function getVaultSkill(name, projectDir) {
    const { registryPath, skillsDir } = resolvePaths(projectDir);
    const reg = readRegistry(registryPath, skillsDir);
    return reg.skills.find(s => s.name === name);
}
/** Check if a skill with this name already exists */
export function skillExists(name, projectDir) {
    return getVaultSkill(name, projectDir) !== undefined;
}
//# sourceMappingURL=vault.js.map