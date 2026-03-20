import type { ITokenResolver } from '../interfaces';

/**
 * SRP: Responsible only for resolving token strings to their actual values.
 * Supports plain strings and $ENV_VAR references.
 */
export class TokenResolver implements ITokenResolver {
  resolve(token: string): string {
    if (!token) {
      return '';
    }
    if (token.startsWith('$')) {
      const envVar = token.slice(1);
      return process.env[envVar] ?? '';
    }
    return token;
  }
}
