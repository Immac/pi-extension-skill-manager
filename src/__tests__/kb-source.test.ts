import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { kbSource } from '../sources/kb-source.js';

describe('kb-source.ts — fetch from KB articles', () => {
  const tmpDir = path.join(os.tmpdir(), `sm-test-kb-${Date.now()}`);
  const kbArticlesDir = path.join(tmpDir, '.pi', 'knowledge-base', 'articles');

  function createArticle(slug: string, outerFrontmatter: Record<string, unknown>, body: string): void {
    const articleDir = path.join(kbArticlesDir, slug);
    fs.mkdirSync(articleDir, { recursive: true });

    // Build frontmatter YAML
    const lines = ['---'];
    for (const [key, value] of Object.entries(outerFrontmatter)) {
      if (key === 'tags' && Array.isArray(value)) {
        lines.push('tags:');
        for (const tag of value) {
          lines.push(`  - "${tag}"`);
        }
      } else if (typeof value === 'string') {
        lines.push(`${key}: ${value}`);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
    lines.push('---');
    lines.push('');

    const content = lines.join('\n') + body;
    fs.writeFileSync(path.join(articleDir, 'ARTICLE.md'), content, 'utf-8');
  }

  beforeEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should fetch with skill_name in tags array and inner frontmatter', () => {
    createArticle(
      'my-analyzer-skill-source',
      {
        title: 'my-analyzer skill source',
        tags: [
          'type:skill',
          'kind:skill-source',
          'skill:enabled',
          'skill_ref:my-analyzer',
          'skill_name:my-analyzer',
          'audience:agent',
          'format:agent-skill',
          'source:user',
        ],
      },
      [
        '---',
        'name: my-analyzer',
        'description: Analyzes code structure',
        '---',
        '',
        'You are an expert analyzer.',
      ].join('\n'),
    );

    const result = kbSource.fetch('my-analyzer-skill-source', { cwd: tmpDir });
    expect(result).not.toBeNull();
    expect(result!.name).toBe('my-analyzer');
    expect(result!.description).toBe('');
    // Content should be the inner body (with inner frontmatter preserved)
    expect(result!.content).toContain('name: my-analyzer');
    expect(result!.content).toContain('You are an expert analyzer.');
    // Should NOT contain outer frontmatter fields
    expect(result!.content).not.toContain('skill_ref');
    expect(result!.content).not.toContain('kind:skill-source');
  });

  it('should return null for non-existent slug', () => {
    const result = kbSource.fetch('nonexistent-slug', { cwd: tmpDir });
    expect(result).toBeNull();
  });

  it('should return null if article has no skill_name tag and no name field', () => {
    createArticle(
      'no-name-article',
      {
        title: 'Just a guide',
        tags: ['type:guide', 'kind:skill-doc'],
      },
      'Just some content.',
    );

    const result = kbSource.fetch('no-name-article', { cwd: tmpDir });
    expect(result).toBeNull();
  });

  it('should fall back to inner frontmatter name when outer has no skill_name', () => {
    createArticle(
      'inner-only-name',
      {
        title: 'Inner name only',
        tags: ['type:skill', 'kind:skill-source', 'skill:enabled'],
      },
      [
        '---',
        'name: inner-named-skill',
        'description: Found via inner frontmatter',
        '---',
        '',
        'Body content.',
      ].join('\n'),
    );

    const result = kbSource.fetch('inner-only-name', { cwd: tmpDir });
    expect(result).not.toBeNull();
    expect(result!.name).toBe('inner-named-skill');
    expect(result!.description).toBe('Found via inner frontmatter');
  });

  it('should handle article with no inner frontmatter and name in outer tags', () => {
    createArticle(
      'no-inner-fm',
      {
        title: 'No inner frontmatter',
        tags: [
          'type:skill',
          'kind:skill-source',
          'skill:enabled',
          'skill_name:plain-skill',
          'skill_description:Plain description',
        ],
      },
      'Just raw skill content without inner frontmatter.',
    );

    const result = kbSource.fetch('no-inner-fm', { cwd: tmpDir });
    expect(result).not.toBeNull();
    expect(result!.name).toBe('plain-skill');
    expect(result!.description).toBe('Plain description');
    expect(result!.content).toBe('Just raw skill content without inner frontmatter.');
  });

  it('should find article in global KB when not in local', () => {
    // Create article in global KB
    const globalKbDir = path.join(os.homedir(), '.pi', 'knowledge-base', 'articles', 'global-test-skill');
    fs.mkdirSync(globalKbDir, { recursive: true });
    fs.writeFileSync(path.join(globalKbDir, 'ARTICLE.md'), [
      '---',
      'title: Global test',
      'tags:',
      '  - "skill_name:global-skill"',
      '---',
      '',
      '---',
      'name: global-skill',
      'description: From global KB',
      '---',
      '',
      'Global content.',
    ].join('\n'), 'utf-8');

    try {
      const result = kbSource.fetch('global-test-skill', { cwd: tmpDir });
      expect(result).not.toBeNull();
      expect(result!.name).toBe('global-skill');
    } finally {
      fs.rmSync(globalKbDir, { recursive: true, force: true });
    }
  });

  it('should not find article if only in local and we query without local path', () => {
    createArticle(
      'local-only-skill',
      {
        title: 'Local only',
        tags: ['skill_name:local-only'],
      },
      'Content.',
    );

    // Query without cwd (no local KB context)
    const result = kbSource.fetch('local-only-skill');
    expect(result).toBeNull();
  });
});
