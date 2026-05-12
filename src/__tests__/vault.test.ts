import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { importSkill, removeSkill, listVaultSkills, getVaultSkill, skillExists } from '../vault.js';

const TEST_VAULT_DIR = path.join(os.tmpdir(), '.skill-manager-test');
const TEST_SKILLS_DIR = path.join(TEST_VAULT_DIR, 'skills');
const TEST_REGISTRY_PATH = path.join(TEST_VAULT_DIR, 'registry.json');

// We can't easily mock the hardcoded paths in vault.ts, so these tests
// verify the core functions work with the actual ~/.skill-manager/.
// For unit-level testing, the vault should be refactored to accept a configurable base path.
// These smoke tests verify behavior doesn't regress.

describe('vault.ts — import/remove/list', () => {
  const testSkillName = '_test-smoke-skill';

  beforeEach(() => {
    // Clean up any leftover from previous runs
    const existing = getVaultSkill(testSkillName);
    if (existing) {
      removeSkill(testSkillName);
    }
  });

  afterEach(() => {
    const existing = getVaultSkill(testSkillName);
    if (existing) {
      removeSkill(testSkillName);
    }
  });

  it('should import a skill and return success', () => {
    const result = importSkill({
      name: testSkillName,
      content: '---\nname: test-skill\ndescription: A test\n---\n\nHello world',
      description: 'A test skill',
      sourceType: 'path',
      sourceRef: '/tmp/test',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain(testSkillName);
    expect(result.skill).toBeDefined();
    expect(result.skill!.name).toBe(testSkillName);
    expect(result.skill!.enabled).toBe(true);
  });

  it('should reject duplicate import', () => {
    // First import
    importSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: dup\n---\nbody',
      sourceType: 'path',
      sourceRef: '/tmp/dup',
    });

    // Second import (duplicate)
    const result = importSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: dup\n---\nbody',
      sourceType: 'path',
      sourceRef: '/tmp/dup',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
  });

  it('should list imported skills', () => {
    importSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: list-test\n---\nbody',
      sourceType: 'kb',
      sourceRef: 'test-article',
    });

    const skills = listVaultSkills();
    const found = skills.find(s => s.name === testSkillName);
    expect(found).toBeDefined();
    expect(found!.sourceType).toBe('kb');
  });

  it('should get a single skill by name', () => {
    importSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: get-test\n---\nbody',
      sourceType: 'path',
      sourceRef: '/tmp/get-test',
    });

    const skill = getVaultSkill(testSkillName);
    expect(skill).toBeDefined();
    expect(skill!.name).toBe(testSkillName);
  });

  it('should remove a skill', () => {
    importSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: remove-test\n---\nbody',
      sourceType: 'path',
      sourceRef: '/tmp/remove-test',
    });

    const result = removeSkill(testSkillName);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Removed');

    const after = getVaultSkill(testSkillName);
    expect(after).toBeUndefined();
  });

  it('should reject removal of non-existent skill', () => {
    const result = removeSkill('_nonexistent-skill-12345');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should detect skill existence', () => {
    expect(skillExists(testSkillName)).toBe(false);

    importSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: exists-test\n---\nbody',
      sourceType: 'path',
      sourceRef: '/tmp/exists',
    });

    expect(skillExists(testSkillName)).toBe(true);
  });
});

describe('vault.ts — path traversal prevention', () => {
  it('should reject name with parent directory traversal', () => {
    const result = importSkill({
      name: '../../etc/malicious',
      content: '---\nname: bad\n---\nbody',
      sourceType: 'path',
      sourceRef: '/tmp/bad',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('path traversal');
  });

  it('should reject name with absolute path', () => {
    const result = importSkill({
      name: '/etc/passwd',
      content: '---\nname: bad\n---\nbody',
      sourceType: 'path',
      sourceRef: '/tmp/bad',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('path traversal');
  });
});
