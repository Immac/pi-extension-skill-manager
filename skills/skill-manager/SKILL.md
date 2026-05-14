---
name: skill-manager
description: Manage skills via the skill vault — import, activate, deactivate, list, and remove skills with pluggable sources (path, kb, and more).
---

# skill-manager

Manage pi skills through a centralized **skill vault** (`~/.skill-manager/`). Skills are imported from various sources into the vault, then activated by adding their path to the `skills` array in `settings.json` — the same pattern pi uses for extensions via the `packages` array.

## Architecture

```
~/.skill-manager/
├── registry.json           # Tracks all vault skills (name, source, metadata)
└── skills/
    └── <skill-name>/
        ├── SKILL.md        # The skill definition
        └── SOURCE.json     # Source metadata
```

**Activation** adds the vault skill path to settings.json:

| Scope | Settings file |
|-------|---------------|
| `user` | `~/.pi/agent/settings.json` → `skills[]` |
| `project` | `.pi/settings.json` → `skills[]` |

No symlinks or file copies — pi discovers skills directly from the vault paths listed in `settings.json`.

## Tool: `skill_manager`

Single unified tool with actions:

| Action | Description |
|--------|-------------|
| `import` | Bring a skill into the vault from a source (path, kb, or direct content) |
| `update` | Replace vault skill content/metadata in-place (preserves activation) |
| `activate` | Add vault skill path to `settings.json` `skills[]` array |
| `deactivate` | Remove vault skill path from `settings.json` `skills[]` array |
| `list` | Show vault contents + activation status across both scopes |
| `remove` | Deactivate from all scopes + delete from vault |

### Import sources

| Source | Ref format | Example |
|--------|-----------|---------|
| `path` (default) | Path to SKILL.md or a directory containing one | `./my-skill/SKILL.md` |
| `kb` | Knowledge base article slug | `my-analyzer-skill-source` |

**To add a new source:** implement the `SourceAdapter` interface in `src/sources/` and register it in `src/sources/registry.ts`.

## Command

`/list-vault-skills` — quick CLI view of vault contents and activation status.

## Usage examples

```text
# Import from a local path
skill_manager action:import name:"my-analyzer" source:path ref:"./my-skill/SKILL.md"

# Import from knowledge base
skill_manager action:import name:"my-analyzer" source:kb ref:"my-analyzer-skill-source"

# Import with direct content
skill_manager action:import name:"my-analyzer" content:"---\nname: my-analyzer\n...\n"

# Activate at user scope (default)
skill_manager action:activate name:"my-analyzer"

# Activate at project scope
skill_manager action:activate name:"my-analyzer" scope:project

# Deactivate
skill_manager action:deactivate name:"my-analyzer" scope:user

# List everything
skill_manager action:list

# Update (re-import) an existing skill in-place from source
skill_manager action:update name:"my-analyzer" source:path ref:"./my-skill/SKILL.md"

# Update with direct content
skill_manager action:update name:"my-analyzer" content:"---\nname: my-analyzer\n...\n"

# Remove from vault (also deactivates everywhere)
skill_manager action:remove name:"my-analyzer"
```

After activating, run `/reload` in pi to pick up the new skill.
