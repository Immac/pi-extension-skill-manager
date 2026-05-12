import { Type } from '@mariozechner/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { importSkill, removeSkill, listVaultSkills, getVaultSkill } from './vault.js';
import { activateSkill, deactivateSkill, listActiveSkills } from './activator.js';
import { getSource, listSources } from './sources/registry.js';
import type { ActivateScope, SourceType } from './types.js';

export default function skillManager(pi: ExtensionAPI) {
  // ── skill_manager tool ───────────────────────────────────────────
  pi.registerTool({
    name: 'skill_manager',
    label: 'Skill Manager',
    description: 'Manage skills in the skill vault — import, activate, deactivate, list, remove.',
    parameters: Type.Object({
      action: Type.String({
        description: 'Action to perform: import | activate | deactivate | list | remove',
      }),
      name: Type.Optional(Type.String({
        description: 'Skill name (required for import, activate, deactivate, remove)',
      })),
      source: Type.Optional(Type.Union([Type.Literal('path'), Type.Literal('kb')], {
        description: 'Source type for import: "path" or "kb" (default: "path")',
      })),
      ref: Type.Optional(Type.String({
        description: 'Source reference — path to SKILL.md for "path" source, article slug for "kb" source',
      })),
      scope: Type.Optional(Type.Union([Type.Literal('user'), Type.Literal('project')], {
        description: 'Activation scope: "user" (default) or "project"',
      })),
      content: Type.Optional(Type.String({
        description: 'Full SKILL.md content (alternative to source/ref — pass content directly)',
      })),
      description: Type.Optional(Type.String({
        description: 'Optional description for import',
      })),
    }),
    async execute(_toolCallId, params: any, _signal, _onUpdate, ctx: any) {
      const action = (params.action as string || '').toLowerCase();
      const name = params.name as string | undefined;
      const sourceType = (params.source as string || 'path') as SourceType;
      const ref = params.ref as string | undefined;
      const scope = (params.scope as string || 'user') as ActivateScope;
      const content = params.content as string | undefined;
      const description = params.description as string | undefined;
      const projectDir = ctx?.cwd as string | undefined;

      switch (action) {
        // ── IMPORT ──
        case 'import': {
          if (!name) {
            return {
              content: [{ type: 'text', text: 'Error: "name" is required for import.' }],
              details: {},
            };
          }

          // If content is provided directly, use it
          if (content) {
            const result = importSkill({ name, content, description, sourceType, sourceRef: ref || 'direct' });
            return {
              content: [{ type: 'text', text: formatMessage(result) }],
              details: { result },
            };
          }

          // Otherwise, use a source adapter
          if (!ref) {
            return {
              content: [{ type: 'text', text: 'Error: Provide either "content" directly or a "ref" for the source.' }],
              details: {},
            };
          }

          const adapter = getSource(sourceType);
          if (!adapter) {
            const available = listSources().map(s => s.type).join(', ');
            return {
              content: [{ type: 'text', text: `Unknown source type "${sourceType}". Available: ${available}` }],
              details: {},
            };
          }

          const skillData = adapter.fetch(ref, { cwd: projectDir || '' });
          if (!skillData) {
            return {
              content: [{ type: 'text', text: `Could not fetch skill from ${sourceType}:${ref}. Check the reference.` }],
              details: {},
            };
          }

          const result = importSkill({
            name,
            content: skillData.content,
            description: skillData.description || description,
            sourceType,
            sourceRef: ref,
          });
          return {
            content: [{ type: 'text', text: formatMessage(result) }],
            details: { result },
          };
        }

        // ── ACTIVATE ──
        case 'activate': {
          if (!name) {
            return {
              content: [{ type: 'text', text: 'Error: "name" is required for activate.' }],
              details: {},
            };
          }
          const vaultSkill = getVaultSkill(name);
          if (!vaultSkill) {
            return {
              content: [{ type: 'text', text: `Skill "${name}" not found in vault. Import it first.` }],
              details: {},
            };
          }
          const actResult = activateSkill(name, vaultSkill.vaultPath, scope, projectDir);
          return {
            content: [{ type: 'text', text: formatMessage(actResult) }],
            details: { result: actResult },
          };
        }

        // ── DEACTIVATE ──
        case 'deactivate': {
          if (!name) {
            return {
              content: [{ type: 'text', text: 'Error: "name" is required for deactivate.' }],
              details: {},
            };
          }
          const deactResult = deactivateSkill(name, scope, projectDir);
          return {
            content: [{ type: 'text', text: formatMessage(deactResult) }],
            details: { result: deactResult },
          };
        }

        // ── LIST ──
        case 'list': {
          const vaultSkills = listVaultSkills();
          const userActive = listActiveSkills('user', projectDir);
          const projectActive = listActiveSkills('project', projectDir);

          const userNames = new Set(userActive.map(a => a.name));
          const projectNames = new Set(projectActive.map(a => a.name));

          let text = '## Skill Vault\n\n';
          if (vaultSkills.length === 0) {
            text += 'Vault is empty. Use action:import to add skills.\n\n';
          } else {
            text += `**${vaultSkills.length} skill(s) in vault:**\n\n`;
            for (const s of vaultSkills) {
              const user = userNames.has(s.name) ? '✅ user' : '';
              const proj = projectNames.has(s.name) ? '✅ project' : '';
              const activeFlags = [user, proj].filter(Boolean).join(', ');
              text += `- **${s.name}** — ${s.description || 'no description'}\n`;
              text += `  source: ${s.sourceType}:${s.sourceRef} | active: ${activeFlags || '—'}\n`;
            }
          }

          text += '\n### Active (user scope)\n';
          if (userActive.length === 0) text += '  None\n';
          else for (const a of userActive) text += `  - ${a.name} (${a.vaultPath})\n`;

          text += '\n### Active (project scope)\n';
          if (projectActive.length === 0) text += '  None\n';
          else for (const a of projectActive) text += `  - ${a.name} (${a.vaultPath})\n`;

          return {
            content: [{ type: 'text', text }],
            details: { vault: vaultSkills, userActive, projectActive },
          };
        }

        // ── REMOVE ──
        case 'remove': {
          if (!name) {
            return {
              content: [{ type: 'text', text: 'Error: "name" is required for remove.' }],
              details: {},
            };
          }
          // Deactivate from both scopes first
          deactivateSkill(name, 'user', projectDir);
          deactivateSkill(name, 'project', projectDir);
          const rmResult = removeSkill(name);
          return {
            content: [{ type: 'text', text: formatMessage(rmResult) }],
            details: { result: rmResult },
          };
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown action "${action}". Valid: import, activate, deactivate, list, remove` }],
            details: {},
          };
      }
    },
  });

  // ── /list-vault-skills command ──────────────────────────────────
  pi.registerCommand('list-vault-skills', {
    description: 'List all skills in the vault and their activation status',
    handler: async (_args: string, ctx: any) => {
      const vaultSkills = listVaultSkills();
      const projectDir = ctx.cwd as string;
      const userActive = listActiveSkills('user', projectDir);
      const projectActive = listActiveSkills('project', projectDir);

      const userNames = new Set(userActive.map(a => a.name));
      const projectNames = new Set(projectActive.map(a => a.name));

      if (vaultSkills.length === 0) {
        ctx.ui.notify('Vault is empty. Use skill_manager tool to import skills.', 'info');
        return;
      }

      const lines: string[] = [];
      lines.push(`Skills in vault: ${vaultSkills.length}`);
      for (const s of vaultSkills) {
        const user = userNames.has(s.name) ? '✅' : '⬜';
        const proj = projectNames.has(s.name) ? '✅' : '⬜';
        lines.push(`  ${s.name}  [user:${user} project:${proj}]  (${s.sourceType}:${s.sourceRef})`);
      }
      ctx.ui.notify(lines.join('\n'), 'info');
    },
  });
}

// ── Formatting helpers ─────────────────────────────────────────────

function formatMessage(result: { success: boolean; message: string }): string {
  return result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
}
