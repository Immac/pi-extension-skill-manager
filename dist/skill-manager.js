import fs from 'node:fs';
import path from 'node:path';
import { Type } from '@mariozechner/pi-ai';
import { importSkill, updateSkill, removeSkill, listVaultSkills, getVaultSkill, REGISTRY_PATH } from './vault.js';
import { activateSkill, deactivateSkill, listActiveSkills } from './activator.js';
import { getSource, listSources } from './sources/registry.js';
export default function skillManager(pi) {
    // ── Scoped state for TUI status reporting ──────────────────────
    let knownTimestamp = 0;
    let watchCleanup = null;
    const STATUS_ID = 'skill-manager-reload';
    function checkReloadNeeded(ctx) {
        try {
            if (!fs.existsSync(REGISTRY_PATH))
                return;
            const mtime = fs.statSync(REGISTRY_PATH).mtimeMs;
            if (mtime > knownTimestamp && knownTimestamp > 0) {
                ctx.ui?.setStatus?.(STATUS_ID, '⚠️ Skills changed — /reload to apply');
            }
        }
        catch {
            // fail silently
        }
    }
    function markTimestamp() {
        try {
            if (fs.existsSync(REGISTRY_PATH)) {
                knownTimestamp = fs.statSync(REGISTRY_PATH).mtimeMs;
            }
        }
        catch {
            // fail silently
        }
    }
    function clearReloadStatus(ctx) {
        ctx.ui?.setStatus?.(STATUS_ID, undefined);
    }
    function notifyMutation(ctx, message, type = 'info') {
        ctx.ui?.notify?.(message, type);
        markTimestamp();
    }
    function startWatcherIfEnabled(ctx) {
        if (watchCleanup)
            return;
        if (process.env.SKILL_MANAGER_WATCH !== '1')
            return;
        try {
            const vaultDir = path.dirname(REGISTRY_PATH);
            if (!fs.existsSync(vaultDir))
                return;
            const watcher = fs.watch(vaultDir, (eventType, filename) => {
                if (filename === 'registry.json' && eventType === 'change') {
                    checkReloadNeeded(ctx);
                }
            });
            watchCleanup = () => {
                watcher.close();
                watchCleanup = null;
            };
            pi.on('session_shutdown', () => {
                watchCleanup?.();
            });
        }
        catch {
            // fail silently
        }
    }
    // ── skill_manager tool ───────────────────────────────────────────
    pi.registerTool({
        name: 'skill_manager',
        label: 'Skill Manager',
        description: 'Manage skills in the skill vault — import, activate, deactivate, update, list, remove.',
        parameters: Type.Object({
            action: Type.String({
                description: 'Action to perform: import | activate | deactivate | update | list | remove',
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
        async execute(_toolCallId, params, signal, _onUpdate, ctx) {
            if (signal?.aborted)
                return { content: [{ type: 'text', text: 'Aborted by caller' }], details: {}, isError: true };
            const action = (params.action || '').toLowerCase();
            const name = params.name;
            const sourceType = (params.source || 'path');
            const ref = params.ref;
            const scope = (params.scope || 'user');
            const content = params.content;
            const description = params.description;
            const projectDir = ctx?.cwd;
            switch (action) {
                // ── IMPORT ──
                case 'import': {
                    if (!name) {
                        return {
                            content: [{ type: 'text', text: 'Error: "name" is required for import.' }],
                            details: {},
                        };
                    }
                    let result;
                    if (content) {
                        result = importSkill({ name, content, description, sourceType, sourceRef: ref || 'direct' }, projectDir);
                    }
                    else if (!ref) {
                        return {
                            content: [{ type: 'text', text: 'Error: Provide either "content" directly or a "ref" for the source.' }],
                            details: {},
                        };
                    }
                    else {
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
                        result = importSkill({
                            name,
                            content: skillData.content,
                            description: skillData.description || description,
                            sourceType,
                            sourceRef: ref,
                        }, projectDir);
                    }
                    if (result.success)
                        notifyMutation(ctx, `Imported skill "${name}"`, 'success');
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
                    // Look up skill in the vault matching the activation scope
                    const vaultSkill = getVaultSkill(name, scope === 'project' ? projectDir : undefined);
                    if (!vaultSkill) {
                        const vaultHint = scope === 'project' ? 'project vault' : 'global vault';
                        return {
                            content: [{ type: 'text', text: `Skill "${name}" not found in ${vaultHint}. Import it first with the correct scope.` }],
                            details: {},
                        };
                    }
                    const actResult = activateSkill(name, vaultSkill.vaultPath, scope, projectDir);
                    if (actResult.success)
                        notifyMutation(ctx, `Activated skill "${name}" (${scope})`, 'info');
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
                    if (deactResult.success)
                        notifyMutation(ctx, `Deactivated skill "${name}" (${scope})`, 'info');
                    return {
                        content: [{ type: 'text', text: formatMessage(deactResult) }],
                        details: { result: deactResult },
                    };
                }
                // ── LIST ──
                case 'list': {
                    const globalSkills = listVaultSkills();
                    const projectSkills = projectDir ? listVaultSkills(projectDir) : [];
                    const vaultSkills = [...globalSkills, ...projectSkills];
                    const userActive = listActiveSkills('user', projectDir);
                    const projectActive = listActiveSkills('project', projectDir);
                    const userNames = new Set(userActive.map(a => a.name));
                    const projectNames = new Set(projectActive.map(a => a.name));
                    let text = '## Skill Vault\n\n';
                    if (vaultSkills.length === 0) {
                        text += 'Vaults are empty. Use action:import to add skills.\n\n';
                    }
                    else {
                        text += `**${vaultSkills.length} skill(s) in vault(s):**\n\n`;
                        for (const s of vaultSkills) {
                            const vaultOrigin = globalSkills.find(g => g.name === s.name && g.vaultPath === s.vaultPath)
                                ? '🌐 global'
                                : '📁 project';
                            const user = userNames.has(s.name) ? '✅ user' : '';
                            const proj = projectNames.has(s.name) ? '✅ project' : '';
                            const activeFlags = [user, proj].filter(Boolean).join(', ');
                            text += `- **${s.name}** — ${s.description || 'no description'}\n`;
                            text += `  vault: ${vaultOrigin} | source: ${s.sourceType}:${s.sourceRef} | active: ${activeFlags || '—'}\n`;
                        }
                    }
                    text += '\n### Active (user scope)\n';
                    if (userActive.length === 0)
                        text += '  None\n';
                    else
                        for (const a of userActive)
                            text += `  - ${a.name} (${a.vaultPath})\n`;
                    text += '\n### Active (project scope)\n';
                    if (projectActive.length === 0)
                        text += '  None\n';
                    else
                        for (const a of projectActive)
                            text += `  - ${a.name} (${a.vaultPath})\n`;
                    ctx.ui?.notify?.(`📋 ${vaultSkills.length} skills in vault(s), ${userActive.length} active (user), ${projectActive.length} active (project)`, 'info');
                    return {
                        content: [{ type: 'text', text }],
                        details: { vault: vaultSkills, global: globalSkills, project: projectSkills, userActive, projectActive },
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
                    const rmResult = removeSkill(name, projectDir);
                    if (rmResult.success)
                        notifyMutation(ctx, `Removed skill "${name}"`, 'info');
                    return {
                        content: [{ type: 'text', text: formatMessage(rmResult) }],
                        details: { result: rmResult },
                    };
                }
                // ── UPDATE ──
                case 'update': {
                    if (!name) {
                        return {
                            content: [{ type: 'text', text: 'Error: "name" is required for update.' }],
                            details: {},
                        };
                    }
                    const existingSkill = getVaultSkill(name, projectDir);
                    if (!existingSkill) {
                        return {
                            content: [{ type: 'text', text: `Skill "${name}" not found in vault. Use action:import instead.` }],
                            details: {},
                        };
                    }
                    let result;
                    if (content) {
                        // Explicit content wins
                        result = updateSkill({
                            name,
                            content,
                            description,
                            sourceType: sourceType,
                            sourceRef: ref || existingSkill.sourceRef,
                        }, projectDir);
                    }
                    else if (ref) {
                        // Explicit ref — fetch from source
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
                        result = updateSkill({
                            name,
                            content: skillData.content,
                            description: skillData.description || description,
                            sourceType: sourceType,
                            sourceRef: ref,
                        }, projectDir);
                    }
                    else {
                        // Neither content nor ref — re-fetch from original source
                        const adapter = getSource(existingSkill.sourceType);
                        if (!adapter) {
                            return {
                                content: [{ type: 'text', text: `Cannot re-fetch skill "${name}": unknown source type "${existingSkill.sourceType}". Provide "content" or "ref" explicitly.` }],
                                details: {},
                            };
                        }
                        const skillData = adapter.fetch(existingSkill.sourceRef, { cwd: projectDir || '' });
                        if (!skillData) {
                            return {
                                content: [{ type: 'text', text: `Could not re-fetch skill "${name}" from original source (${existingSkill.sourceType}:${existingSkill.sourceRef}). The source may have moved. Provide "content" or "ref" explicitly.` }],
                                details: {},
                            };
                        }
                        result = updateSkill({
                            name,
                            content: skillData.content,
                            description: skillData.description || existingSkill.description,
                            sourceType: existingSkill.sourceType,
                            sourceRef: existingSkill.sourceRef,
                        }, projectDir);
                    }
                    if (result.success)
                        notifyMutation(ctx, `Updated skill "${name}"`, 'success');
                    return {
                        content: [{ type: 'text', text: formatMessage(result) }],
                        details: { result },
                    };
                }
                default:
                    return {
                        content: [{ type: 'text', text: `Unknown action "${action}". Valid: import, activate, deactivate, update, list, remove` }],
                        details: {},
                    };
            }
        },
    });
    // ── /list-vault-skills command ──────────────────────────────────
    pi.registerCommand('list-vault-skills', {
        description: 'List all skills in the vault and their activation status',
        handler: async (_args, ctx) => {
            const projectDir = ctx.cwd;
            const globalSkills = listVaultSkills();
            const projectSkills = projectDir ? listVaultSkills(projectDir) : [];
            const vaultSkills = [...globalSkills, ...projectSkills];
            const userActive = listActiveSkills('user', projectDir);
            const projectActive = listActiveSkills('project', projectDir);
            const userNames = new Set(userActive.map(a => a.name));
            const projectNames = new Set(projectActive.map(a => a.name));
            if (vaultSkills.length === 0) {
                ctx.ui.notify('Vaults are empty. Use skill_manager tool to import skills.', 'info');
                return;
            }
            const lines = [];
            lines.push(`Skills in vault(s): ${vaultSkills.length}`);
            for (const s of vaultSkills) {
                const vaultOrigin = globalSkills.find(g => g.name === s.name && g.vaultPath === s.vaultPath)
                    ? 'global'
                    : 'project';
                const user = userNames.has(s.name) ? '✅' : '⬜';
                const proj = projectNames.has(s.name) ? '✅' : '⬜';
                lines.push(`  ${s.name}  [${vaultOrigin}] [user:${user} project:${proj}]  (${s.sourceType}:${s.sourceRef})`);
            }
            ctx.ui.notify(lines.join('\n'), 'info');
        },
    });
    // ── Session lifecycle hooks for TUI status ──────────────────────
    pi.on('session_start', async (_event, ctx) => {
        markTimestamp();
        clearReloadStatus(ctx);
        startWatcherIfEnabled(ctx);
    });
    pi.on('turn_start', async (_event, ctx) => {
        checkReloadNeeded(ctx);
    });
}
// ── Formatting helpers ─────────────────────────────────────────────
function formatMessage(result) {
    return result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
}
//# sourceMappingURL=skill-manager.js.map