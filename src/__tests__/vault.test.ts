import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { importSkill, updateSkill, removeSkill, listVaultSkills, getVaultSkill, skillExists } from '../vault.js';

// Mock homedir so vault operations go to /tmp/ instead of ~/.skill-manager/
const testHome = vi.hoisted(() => {
  const p = require('node:path');
  return p.join('/tmp', `sm-test-vault-${Date.now()}`);
});
vi.mock('node:os', () => {
  const m = {
    homedir: () => testHome,
    tmpdir: () => '/tmp',
    platform: () => 'linux',
    release: () => '1.0.0',
    type: () => 'Linux',
    arch: () => 'x64',
    hostname: () => 'test',
    userInfo: () => ({ username: 'test', uid: -1, gid: -1, shell: null, homedir: testHome }),
    EOL: '\n' as const,
    cpus: () => [],
    freemem: () => 0,
    totalmem: () => 0,
    loadavg: () => [0, 0, 0],
    uptime: () => 0,
    networkInterfaces: () => ({}),
    constants: {},
    version: () => '',
  };
  return { default: m, ...m };
});

const TEST_VAULT_DIR = path.join(testHome, '.skill-manager');
const TEST_SKILLS_DIR = path.join(TEST_VAULT_DIR, 'skills');
const TEST_REGISTRY_PATH = path.join(TEST_VAULT_DIR, 'registry.json');

describe('vault.ts — import/remove/list', () => {
  const testSkillName = '_test-smoke-skill';

  beforeEach(() => {
    // Wipe the temp vault dir so each test starts clean
    if (fs.existsSync(TEST_VAULT_DIR)) {
      fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test skill if still present
    if (fs.existsSync(TEST_VAULT_DIR)) {
      fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
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

describe('vault.ts — project-scoped vault', () => {
  const testSkillName = '_test-project-skill';
  const projectDir = path.join('/tmp', `sm-test-project-${Date.now()}`);
  const projectVaultDir = path.join(projectDir, '.skill-manager');
  const projectSkillsDir = path.join(projectVaultDir, 'skills');
  const projectRegistryPath = path.join(projectVaultDir, 'registry.json');

  beforeEach(() => {
    // Clean both vaults
    if (fs.existsSync(TEST_VAULT_DIR)) {
      fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_VAULT_DIR)) {
      fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('should import a skill into project vault when projectDir is provided', () => {
    const result = importSkill({
      name: testSkillName,
      content: '---\nname: project-test\ndescription: Project test\n---\n\nHello world',
      description: 'Project-scoped test skill',
      sourceType: 'path',
      sourceRef: '/tmp/project-ref',
    }, projectDir);

    expect(result.success).toBe(true);
    expect(result.skill).toBeDefined();

    // Verify the skill was created in the project vault
    const skillDir = path.join(projectSkillsDir, testSkillName);
    expect(fs.existsSync(skillDir)).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'SOURCE.json'))).toBe(true);

    // Verify the project registry exists
    expect(fs.existsSync(projectRegistryPath)).toBe(true);
    const reg = JSON.parse(fs.readFileSync(projectRegistryPath, 'utf-8'));
    expect(reg.skills).toHaveLength(1);
    expect(reg.skills[0].name).toBe(testSkillName);
  });

  it('should not mix global and project vaults', () => {
    // Import same name to both vaults — should succeed independently
    const globalResult = importSkill({
      name: testSkillName,
      content: '---\nname: global\ndescription: Global\n---\nbody',
      description: 'Global',
      sourceType: 'path',
      sourceRef: '/tmp/global',
    });
    expect(globalResult.success).toBe(true);

    const projectResult = importSkill({
      name: testSkillName,
      content: '---\nname: project\ndescription: Project\n---\nbody',
      description: 'Project',
      sourceType: 'path',
      sourceRef: '/tmp/project',
    }, projectDir);
    expect(projectResult.success).toBe(true);

    // Global vault should have 1 skill
    const globalSkills = listVaultSkills();
    expect(globalSkills).toHaveLength(1);
    expect(globalSkills[0].name).toBe(testSkillName);
    expect(globalSkills[0].sourceRef).toBe('/tmp/global');

    // Project vault should have 1 skill
    const projectSkills = listVaultSkills(projectDir);
    expect(projectSkills).toHaveLength(1);
    expect(projectSkills[0].name).toBe(testSkillName);
    expect(projectSkills[0].sourceRef).toBe('/tmp/project');
  });

  it('should list only project-scoped skills when projectDir is given', () => {
    // Import to global
    importSkill({
      name: 'global-skill',
      content: '---\nname: global\ndescription: g\n---\nbody',
      description: 'global',
      sourceType: 'path',
      sourceRef: '/tmp/global',
    });

    // Import to project
    importSkill({
      name: 'project-skill',
      content: '---\nname: project\ndescription: p\n---\nbody',
      description: 'project',
      sourceType: 'path',
      sourceRef: '/tmp/project',
    }, projectDir);

    // List from global vault
    const globalSkills = listVaultSkills();
    expect(globalSkills).toHaveLength(1);
    expect(globalSkills[0].name).toBe('global-skill');

    // List from project vault
    const projectSkills = listVaultSkills(projectDir);
    expect(projectSkills).toHaveLength(1);
    expect(projectSkills[0].name).toBe('project-skill');
  });

  it('should remove a skill from project vault without affecting global', () => {
    importSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: remove-test\n---\nbody',
      sourceType: 'path',
      sourceRef: '/tmp/remove',
    });

    importSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: remove-test\n---\nbody',
      sourceType: 'path',
      sourceRef: '/tmp/remove-proj',
    }, projectDir);

    // Remove from project vault
    const rmResult = removeSkill(testSkillName, projectDir);
    expect(rmResult.success).toBe(true);

    // Project vault should be empty
    expect(listVaultSkills(projectDir)).toHaveLength(0);

    // Global vault should still have it
    expect(listVaultSkills()).toHaveLength(1);
  });

  it('should update a skill in the project vault', () => {
    // Import to project
    importSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: original\n---\nbody',
      description: 'original',
      sourceType: 'path',
      sourceRef: '/tmp/update',
    }, projectDir);

    // Update
    const updateResult = updateSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: updated\n---\nupdated body',
      description: 'updated',
      sourceType: 'path',
      sourceRef: '/tmp/update',
    }, projectDir);

    expect(updateResult.success).toBe(true);

    // Verify updated content
    const skillPath = path.join(projectSkillsDir, testSkillName, 'SKILL.md');
    const content = fs.readFileSync(skillPath, 'utf-8');
    expect(content).toContain('updated body');

    // Verify registry updated
    const projectSkills = listVaultSkills(projectDir);
    expect(projectSkills[0].description).toBe('updated');
  });

  it('should check existence scoped to vault', () => {
    // Import only to global
    importSkill({
      name: testSkillName,
      content: '---\nname: test\ndescription: exists\n---\nbody',
      sourceType: 'path',
      sourceRef: '/tmp/exists',
    });

    // Should exist in global
    expect(skillExists(testSkillName)).toBe(true);

    // Should NOT exist in project
    expect(skillExists(testSkillName, projectDir)).toBe(false);
  });
});

describe('vault.ts — path traversal prevention', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_VAULT_DIR)) {
      fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_VAULT_DIR)) {
      fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
    }
  });

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
