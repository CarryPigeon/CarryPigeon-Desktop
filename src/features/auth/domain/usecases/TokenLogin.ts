/**
 * @fileoverview TokenLogin.ts
 * @description Usecase: validate existing access token.
 */

import type { AuthServicePort } from "../ports/AuthServicePort";
import type { TokenLoginResult } from "../types/AuthTypes";

/**
 * Token login usecase.
 */
export class TokenLogin {
  constructor(private readonly authService: AuthServicePort) {}

  /**
   * Validate an existing access token and retrieve user info.
   *
   * @param token - Access token to validate.
   * @returns Token login result with uid.
   */
  execute(token: string): Promise<TokenLoginResult> {
    return this.authService.tokenLogin(token);
  }
}
