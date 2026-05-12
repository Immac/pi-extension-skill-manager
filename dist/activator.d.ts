import type { ActivateResult, ActivateScope } from './types.js';
/**
 * Activate a vault skill by adding its path to the settings.json `skills` array.
 *
 * Pi discovers skills from these paths directly — no symlinks needed.
 */
export declare function activateSkill(skillName: string, vaultPath: string, scope: ActivateScope, projectDir?: string): ActivateResult;
/**
 * Deactivate a vault skill by removing its path from the settings.json `skills` array.
 */
export declare function deactivateSkill(skillName: string, scope: ActivateScope, projectDir?: string): ActivateResult;
/**
 * List all active skills for a given scope by reading the `skills` array
 * from settings.json. Returns array of {name, vaultPath}.
 */
export declare function listActiveSkills(scope: ActivateScope, projectDir?: string): {
    name: string;
    vaultPath: string;
}[];
//# sourceMappingURL=activator.d.ts.map