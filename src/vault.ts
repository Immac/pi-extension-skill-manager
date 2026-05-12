import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { VaultRegistry, VaultSkill, VaultResult, ImportSkillInput } from './types.js';

const VAULT_DIR = path.join(os.homedir(), '.skill-manager');
const SKILLS_DIR = path.join(VAULT_DIR, 'skills');
const REGISTRY_PATH = path.join(VAULT_DIR, 'registry.json');

const REGISTRY_VERSION = 1;

function ensureVault(): void {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
}

function readRegistry(): VaultRegistry {
  ensureVault();
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // corrupted — start fresh
  }
  return { version: REGISTRY_VERSION, skills: [] };
}

function writeRegistry(reg: VaultRegistry): void {
  ensureVault();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2), 'utf-8');
}

/**
 * Validate a skill name does not contain path traversal components.
 * Throws if invalid.
 */
function assertSafeSkillName(name: string): void {
  const resolved = path.resolve(SKILLS_DIR, name);
  if (!resolved.startsWith(SKILLS_DIR + path.sep) && resolved !== SKILLS_DIR) {
    throw new Error(`Invalid skill name "${name}" - path traversal detected.`);
  }
}

/** Import a skill into the vault */
export function importSkill(input: ImportSkillInput): VaultResult {
  const reg = readRegistry();

  // Check for duplicate
  const existing = reg.skills.find(s => s.name === input.name);
  if (existing) {
    return {
      success: false,
      message: `Skill "${input.name}" already exists in vault (source: ${existing.sourceType}:${existing.sourceRef}). Remove it first or use a different name.`,
    };
  }

  let skillDir: string;
  try {
    assertSafeSkillName(input.name);
    skillDir = path.join(SKILLS_DIR, input.name);
  } catch (e) {
    return { success: false, message: (e as Error).message };
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
  fs.writeFileSync(
    path.join(skillDir, 'SOURCE.json'),
    JSON.stringify(sourceMeta, null, 2),
    'utf-8',
  );

  const skill: VaultSkill = {
    name: input.name,
    description: input.description || '',
    sourceType: input.sourceType,
    sourceRef: input.sourceRef,
    vaultPath: skillDir,
    installedAt: Date.now(),
    enabled: true,
  };

  reg.skills.push(skill);
  writeRegistry(reg);

  return {
    success: true,
    message: `Imported skill "${input.name}" into vault from ${input.sourceType}:${input.sourceRef}`,
    skill,
  };
}

/** Remove a skill from the vault */
export function removeSkill(name: string): VaultResult {
  const reg = readRegistry();
  const idx = reg.skills.findIndex(s => s.name === name);
  if (idx === -1) {
    return { success: false, message: `Skill "${name}" not found in vault.` };
  }

  const skill = reg.skills[idx];

  // Delete skill directory
  try {
    assertSafeSkillName(name);
    const skillDir = path.join(SKILLS_DIR, name);
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
    }
  } catch {
    // name validation failed — skip directory deletion
  }

  reg.skills.splice(idx, 1);
  writeRegistry(reg);

  return {
    success: true,
    message: `Removed skill "${name}" from vault.`,
    skill,
  };
}

/** List all skills in the vault */
export function listVaultSkills(): VaultSkill[] {
  const reg = readRegistry();
  return reg.skills;
}

/** Get a single skill by name */
export function getVaultSkill(name: string): VaultSkill | undefined {
  const reg = readRegistry();
  return reg.skills.find(s => s.name === name);
}

/** Check if a skill with this name already exists */
export function skillExists(name: string): boolean {
  return getVaultSkill(name) !== undefined;
}
