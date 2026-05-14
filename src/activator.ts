import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ActivateResult, ActivateScope } from './types.js';

interface SettingsFile {
  skills?: string[];
  packages?: string[];
  [key: string]: unknown;
}

/**
 * Resolve the settings.json path for a given scope.
 */
function settingsPath(scope: ActivateScope, projectDir?: string): string {
  if (scope === 'user') {
    return path.join(os.homedir(), '.pi', 'agent', 'settings.json');
  }
  const base = projectDir ? path.resolve(projectDir) : process.cwd();
  return path.join(base, '.pi', 'settings.json');
}

/**
 * Read settings.json, returning a mutable copy.
 */
function readSettings(filePath: string): SettingsFile {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // corrupted — start fresh
  }
  return {};
}

/**
 * Write settings.json, preserving all existing fields.
 */
function writeSettings(filePath: string, data: SettingsFile): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, '  '), 'utf-8');
}

/**
 * Activate a vault skill by adding its path to the settings.json `skills` array.
 *
 * Pi discovers skills from these paths directly — no symlinks needed.
 */
export function activateSkill(
  skillName: string,
  vaultPath: string,
  scope: ActivateScope,
  projectDir?: string,
): ActivateResult {
  // Verify the vault path exists before activating
  if (!fs.existsSync(vaultPath)) {
    return {
      success: false,
      message: `Skill directory not found at ${vaultPath}. Import the skill first.`,
    };
  }

  const settingsFile = settingsPath(scope, projectDir);
  const settings = readSettings(settingsFile);

  const skills = settings.skills ?? [];

  // Normalize the vault path
  const normalizedVaultPath = path.resolve(vaultPath);

  // Check if already active
  if (skills.some(s => path.resolve(s) === normalizedVaultPath)) {
    return {
      success: true,
      message: `Skill "${skillName}" is already active (${scope} scope)`,
      targetPath: settingsFile,
    };
  }

  // Add to skills array
  skills.push(normalizedVaultPath);
  settings.skills = skills;
  writeSettings(settingsFile, settings);

  return {
    success: true,
    message: `Activated skill "${skillName}" (${scope} scope) — /reload to apply`,
    targetPath: settingsFile,
  };
}

/**
 * Deactivate a vault skill by removing its path from the settings.json `skills` array.
 */
export function deactivateSkill(
  skillName: string,
  scope: ActivateScope,
  projectDir?: string,
): ActivateResult {
  const settingsFile = settingsPath(scope, projectDir);
  const settings = readSettings(settingsFile);

  const skills = settings.skills ?? [];

  // Find and remove by vault directory name
  const filtered = skills.filter(s => {
    const resolved = path.resolve(s);
    const dirName = path.basename(resolved);
    return dirName !== skillName;
  });

  if (filtered.length === skills.length) {
    return {
      success: false,
      message: `Skill "${skillName}" is not active (${scope} scope) — nothing to deactivate`,
    };
  }

  settings.skills = filtered;
  writeSettings(settingsFile, settings);

  return {
    success: true,
    message: `Deactivated skill "${skillName}" (${scope} scope) — /reload to apply`,
    targetPath: settingsFile,
  };
}

/**
 * List all active skills for a given scope by reading the `skills` array
 * from settings.json. Returns array of {name, vaultPath}.
 */
export function listActiveSkills(
  scope: ActivateScope,
  projectDir?: string,
): { name: string; vaultPath: string }[] {
  const settingsFile = settingsPath(scope, projectDir);
  const settings = readSettings(settingsFile);

  const skills = settings.skills ?? [];
  const result: { name: string; vaultPath: string }[] = [];

  for (const entry of skills) {
    const resolved = path.resolve(entry);
    const name = path.basename(resolved);
    if (fs.existsSync(resolved)) {
      result.push({ name, vaultPath: resolved });
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}
