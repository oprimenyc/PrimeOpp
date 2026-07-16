// Secrets contracts — references to external vaults, never raw material.
import type { SecretReference } from './common.js';

export interface SecretResolver {
  resolve(ref: SecretReference): Promise<string | undefined>;
  describe(ref: SecretReference): { readonly vault: string; readonly key: string; readonly hasValue: boolean };
}

export const PRIMEOPP_VAULT_NAME = 'prime-vault';

export function primeVaultRef(key: string, version?: string): SecretReference {
  return { vault: PRIMEOPP_VAULT_NAME, key, version };
}
