import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { activateSkill, deactivateSkill, listActiveSkills } from '../activator.js';

describe('activator.ts — activate/deactivate/list', () => {
  const tmpDir = path.join(os.tmpdir(), `sm-test-${Date.now()}`);
  const projectSettingsDir = path.join(tmpDir, '.pi');
  const projectSettingsPath = path.join(projectSettingsDir, 'settings.json');
  const vaultSkillsDir = path.join(tmpDir, '.skill-manager', 'skills');

  // Create vault directories simulating vault skills
  const skill1Dir = path.join(vaultSkillsDir, 'test-skill-a');
  const skill2Dir = path.join(vaultSkillsDir, 'test-skill-b');

  beforeEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });

    // Create vault skill directories
    fs.mkdirSync(skill1Dir, { recursive: true });
    fs.mkdirSync(skill2Dir, { recursive: true });
    fs.writeFileSync(path.join(skill1Dir, 'SKILL.md'), '---\nname: test-skill-a\n---\nbody', 'utf-8');
    fs.writeFileSync(path.join(skill2Dir, 'SKILL.md'), '---\nname: test-skill-b\n---\nbody', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── User scope tests ──────────────────────────────────────────
  // Note: User scope writes to ~/.pi/agent/settings.json (real home dir).
  // These tests verify behavior via result messages to avoid side effects.
  describe('user scope', () => {
    it('should activate a skill at user scope (returns success message)', () => {
      const result = activateSkill('test-skill-a', skill1Dir, 'user', tmpDir);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Activated');
      expect(result.message).toContain('user');
      expect(result.message).toContain('/reload');
    });

    it('should report already active on duplicate activation', () => {
      activateSkill('test-skill-a', skill1Dir, 'user', tmpDir);
      const result = activateSkill('test-skill-a', skill1Dir, 'user', tmpDir);
      expect(result.success).toBe(true);
      expect(result.message).toContain('already active');
    });

    it('should deactivate a skill at user scope', () => {
      activateSkill('test-skill-a', skill1Dir, 'user', tmpDir);
      const result = deactivateSkill('test-skill-a', 'user', tmpDir);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Deactivated');
    });

    it('should report not active on deactivation of inactive skill', () => {
      const result = deactivateSkill('nonexistent', 'user', tmpDir);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not active');
    });
  });

  // ── Project scope tests ───────────────────────────────────────
  // Project scope respects the projectDir parameter, so we can test
  // the actual file operations.
  describe('project scope', () => {
    it('should activate a skill at project scope and write to .pi/settings.json', () => {
      const result = activateSkill('test-skill-a', skill1Dir, 'project', tmpDir);
      expect(result.success).toBe(true);
      expect(result.targetPath).toBe(projectSettingsPath);

      // Verify the file was created
      expect(fs.existsSync(projectSettingsPath)).toBe(true);
      const settings = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf-8'));
      expect(settings.skills).toHaveLength(1);
      expect(settings.skills[0]).toBe(skill1Dir);
    });

    it('should deactivate a skill at project scope and remove from settings', () => {
      activateSkill('test-skill-a', skill1Dir, 'project', tmpDir);
      const result = deactivateSkill('test-skill-a', 'project', tmpDir);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Deactivated');

      const settings = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf-8'));
      expect(settings.skills).toHaveLength(0);
    });

    it('should list active skills at project scope', () => {
      activateSkill('test-skill-a', skill1Dir, 'project', tmpDir);

      const active = listActiveSkills('project', tmpDir);
      expect(active).toHaveLength(1);
      expect(active[0].name).toBe('test-skill-a');
      expect(active[0].vaultPath).toBe(skill1Dir);
    });

    it('should sort active skills alphabetically', () => {
      activateSkill('test-skill-b', skill2Dir, 'project', tmpDir);
      activateSkill('test-skill-a', skill1Dir, 'project', tmpDir);

      const active = listActiveSkills('project', tmpDir);
      expect(active).toHaveLength(2);
      expect(active[0].name).toBe('test-skill-a');
      expect(active[1].name).toBe('test-skill-b');
    });

    it('should skip non-existent vault paths in list', () => {
      // Manually create settings with a non-existent path
      fs.mkdirSync(projectSettingsDir, { recursive: true });
      fs.writeFileSync(projectSettingsPath, JSON.stringify({
        skills: ['/tmp/nonexistent-vault-path'],
      }), 'utf-8');

      const active = listActiveSkills('project', tmpDir);
      expect(active).toHaveLength(0);
    });

    it('should not conflict user and project scopes', () => {
      // Activate at both scopes
      activateSkill('test-skill-a', skill1Dir, 'user', tmpDir);
      activateSkill('test-skill-a', skill1Dir, 'project', tmpDir);

      // Deactivate only project scope
      const result = deactivateSkill('test-skill-a', 'project', tmpDir);
      expect(result.success).toBe(true);

      // Project scope should be empty now
      const projectActive = listActiveSkills('project', tmpDir);
      expect(projectActive).toHaveLength(0);
    });
  });

  // ── Settings corruption ───────────────────────────────────────
  describe('settings file handling', () => {
    it('should handle corrupted settings.json gracefully (project scope)', () => {
      fs.mkdirSync(projectSettingsDir, { recursive: true });
      fs.writeFileSync(projectSettingsPath, 'not valid json', 'utf-8');

      const result = activateSkill('test-skill-a', skill1Dir, 'project', tmpDir);
      expect(result.success).toBe(true);

      // Should have overwritten with fresh settings
      const settings = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf-8'));
      expect(settings.skills).toHaveLength(1);
    });
  });
});
