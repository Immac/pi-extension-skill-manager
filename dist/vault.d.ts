import type { VaultSkill, VaultResult, ImportSkillInput } from './types.js';
/** Import a skill into the vault */
export declare function importSkill(input: ImportSkillInput): VaultResult;
/** Remove a skill from the vault */
export declare function removeSkill(name: string): VaultResult;
/** List all skills in the vault */
export declare function listVaultSkills(): VaultSkill[];
/** Get a single skill by name */
export declare function getVaultSkill(name: string): VaultSkill | undefined;
/** Check if a skill with this name already exists */
export declare function skillExists(name: string): boolean;
//# sourceMappingURL=vault.d.ts.map