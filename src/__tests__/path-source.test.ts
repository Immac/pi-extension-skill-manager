import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathSource } from '../sources/path-source.js';

describe('path-source.ts — fetch from local paths', () => {
  const tmpDir = path.join(os.tmpdir(), `sm-test-ps-${Date.now()}`);

  beforeEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should fetch from a SKILL.md file with valid frontmatter', () => {
    const skillPath = path.join(tmpDir, 'SKILL.md');
    fs.writeFileSync(skillPath, [
      '---',
      'name: my-analyzer',
      'description: Analyzes code',
      '---',
      '',
      'You are an analyzer.',
    ].join('\n'), 'utf-8');

    const result = pathSource.fetch(skillPath);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('my-analyzer');
    expect(result!.description).toBe('Analyzes code');
    expect(result!.content).toContain('You are an analyzer.');
  });

  it('should fetch from a directory containing SKILL.md', () => {
    const skillDir = path.join(tmpDir, 'my-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: dir-skill',
      'description: From directory',
      '---',
      '',
      'Content.',
    ].join('\n'), 'utf-8');

    const result = pathSource.fetch(skillDir);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('dir-skill');
    expect(result!.description).toBe('From directory');
  });

  it('should return null for non-existent path', () => {
    const result = pathSource.fetch('/nonexistent/path/SKILL.md');
    expect(result).toBeNull();
  });

  it('should return null for directory without SKILL.md', () => {
    fs.mkdirSync(path.join(tmpDir, 'empty-dir'), { recursive: true });
    const result = pathSource.fetch(path.join(tmpDir, 'empty-dir'));
    expect(result).toBeNull();
  });

  it('should return null if SKILL.md lacks name in frontmatter', () => {
    const skillPath = path.join(tmpDir, 'SKILL.md');
    fs.writeFileSync(skillPath, [
      '---',
      'description: No name here',
      '---',
      '',
      'Body.',
    ].join('\n'), 'utf-8');

    const result = pathSource.fetch(skillPath);
    expect(result).toBeNull();
  });

  it('should return null if SKILL.md has invalid frontmatter', () => {
    const skillPath = path.join(tmpDir, 'SKILL.md');
    fs.writeFileSync(skillPath, 'Just plain text, no frontmatter', 'utf-8');

    const result = pathSource.fetch(skillPath);
    expect(result).toBeNull();
  });

  it('should handle optional description', () => {
    const skillPath = path.join(tmpDir, 'SKILL.md');
    fs.writeFileSync(skillPath, [
      '---',
      'name: minimal',
      '---',
      '',
      'Body.',
    ].join('\n'), 'utf-8');

    const result = pathSource.fetch(skillPath);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('minimal');
    expect(result!.description).toBe('');
  });
});
