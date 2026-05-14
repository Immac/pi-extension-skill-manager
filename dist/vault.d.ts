import type { VaultSkill, VaultResult, ImportSkillInput } from './types.js';
export declare const GLOBAL_VAULT_DIR: string;
export declare const GLOBAL_SKILLS_DIR: string;
export declare const GLOBAL_REGISTRY_PATH: string;
export declare const VAULT_DIR: string;
export declare const SKILLS_DIR: string;
export declare const REGISTRY_PATH: string;
/** Import a skill into the vault */
export declare function importSkill(input: ImportSkillInput, projectDir?: string): VaultResult;
/** Update a skill in the vault (replace content and metadata, preserving vault location) */
export declare function updateSkill(input: ImportSkillInput, projectDir?: string): VaultResult;
/** Remove a skill from the vault */
export declare function removeSkill(name: string, projectDir?: string): VaultResult;
/** List all skills in the vault */
export declare function listVaultSkills(projectDir?: string): VaultSkill[];
/** Get a single skill by name */
export declare function getVaultSkill(name: string, projectDir?: string): VaultSkill | undefined;
/** Check if a skill with this name already exists */
export declare function skillExists(name: string, projectDir?: string): boolean;
//# sourceMappingURL=vault.d.ts.map