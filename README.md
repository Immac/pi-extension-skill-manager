# Skill Manager

A skill manager for [pi](https://github.com/earendil-works/pi-coding-agent) — manages skills in a vault, imports them from multiple sources, and activates/deactivates them at user or project scope.

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)
![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Pi Extension](https://img.shields.io/badge/pi--extension-orange?style=flat-square)

## Features

- 📦 **Skill vault** — central directory (`~/.skill-manager/skills/`) where skills are stored and managed
- 📋 **Registry-based** — JSON-based tracking (not symlinks), similar to how extension-creator manages extensions
- 🔌 **Pluggable sources** — import skills from `path` (local file) or `kb` (knowledge base article)
- 🔄 **Update** — re-import a skill to refresh its content
- 🎯 **Scoped activation** — activate at user level (`~/.pi/agent/skills/`) or project level (`.pi/agent/skills/`)
- 🔍 **List & inspect** — browse vault skills or active skills with details
- 🗑️ **Remove** — delete from vault and deactivate in one action
- 👁️ **File watcher** — optional `SKILL_MANAGER_WATCH=1` flag for live reload notifications

## Tools

| Tool | Description |
|---|---|
| `skill_manager` | Single tool with `action` parameter: `import`, `activate`, `deactivate`, `update`, `list`, `remove` |

### Usage

```
skill_manager(action: "import", source: "path"|"kb", ref: "<path-or-slug>")
skill_manager(action: "activate", name: "<skill-name>", scope: "user"|"project")
skill_manager(action: "deactivate", name: "<skill-name>", scope: "user"|"project")
skill_manager(action: "list")
skill_manager(action: "remove", name: "<skill-name>")
skill_manager(action: "update", name: "<skill-name>")
```

## Architecture

```
~/.skill-manager/
├── registry.json          ← JSON registry of all vault skills
└── skills/                ← Vault storage (copied from sources)
    └── <skill-name>/
        └── SKILL.md

src/
├── skill-manager.ts       ← Main entry, tool registration
├── vault.ts               ← Vault CRUD (import, update, remove, list)
├── activator.ts           ← Activation/deactivation logic
├── types.ts               ← Shared types
└── sources/               ← Source plugins
    ├── registry.ts
    ├── path-source.ts
    └── kb-source.ts
```

## Development

```bash
npm run build    # Compile TypeScript
npm test         # Run tests (vitest)
```

## Related

- [`extension-creator`](../extension-creator/) — extension installation (sister tool)
- [`knowledge-base-skills`](../knowledge-base-skills/) — KB-based skill save/install
