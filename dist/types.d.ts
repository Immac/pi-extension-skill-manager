/** Source types for importing skills into the vault */
export type SourceType = 'path' | 'kb';
/** Scope for activation */
export type ActivateScope = 'user' | 'project';
/** A skill record in the vault registry */
export interface VaultSkill {
    name: string;
    description: string;
    sourceType: SourceType;
    sourceRef: string;
    vaultPath: string;
    installedAt: number;
    enabled: boolean;
}
/** The vault registry file structure */
export interface VaultRegistry {
    version: number;
    skills: VaultSkill[];
}
/** Result of a vault operation */
export interface VaultResult {
    success: boolean;
    message: string;
    skill?: VaultSkill;
}
/** Result of an activation operation */
export interface ActivateResult {
    success: boolean;
    message: string;
    targetPath?: string;
}
/** Input for importing a skill from any source */
export interface ImportSkillInput {
    name: string;
    content: string;
    description?: string;
    sourceType: SourceType;
    sourceRef: string;
}
/** Data a source adapter must return */
export interface SourceSkillData {
    name: string;
    description: string;
    content: string;
}
/**
 * A source adapter — implement this to add a new source type.
 */
export interface SourceAdapter {
    type: SourceType;
    label: string;
    /** Fetch skill data from the source. Returns null if not found. */
    fetch(ref: string, params?: Record<string, string>): SourceSkillData | null;
    /** Describe what ref format is expected (for tool docs) */
    refDescription: string;
}
//# sourceMappingURL=types.d.ts.map