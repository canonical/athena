import type { OIDCResult, OIDCUserInfo } from "@components/authentication/authentication.schema.js";
import type { AuthUser, SessionData } from "@components/authentication/session.schema.js";
import { config } from "@components/config/config.js";
import * as oidClient from "openid-client";
import passport from "passport";
import { Strategy as OAuth2Strategy, type VerifyCallback as OAuth2VerifyCallback } from "passport-oauth2";

let oidcConfigPromise: Promise<oidClient.Configuration> | null = null;
let oidcStrategyPromise: Promise<void> | null = null;

const getOidcConfiguration = async (): Promise<oidClient.Configuration> => {
  if (!oidcConfigPromise) {
    const discoveryOptions = config.application.nodeEnv === `production` ? undefined : { execute: [oidClient.allowInsecureRequests] };

    oidcConfigPromise = oidClient.discovery(new URL(config.authentication.oidc.discoveryUrl), config.authentication.oidc.clientId, config.authentication.oidc.clientSecret, undefined, discoveryOptions);
  }

  return oidcConfigPromise;
};

const decodeTokenSubject = (idToken: string): string => {
  const tokenSections = idToken.split(`.`);

  if (tokenSections.length < 2) {
    throw new Error(`OIDC id_token payload is malformed`);
  }

  const payload = JSON.parse(Buffer.from(tokenSections[1], `base64url`).toString(`utf8`)) as { sub?: string };

  if (!payload.sub) {
    throw new Error(`OIDC id_token payload did not include subject`);
  }

  return payload.sub;
};

const ensureOidcStrategy = async (): Promise<void> => {
  if (!oidcStrategyPromise) {
    oidcStrategyPromise = (async () => {
      const oidcConfig = await getOidcConfiguration();
      const oidcMetadata = oidcConfig.serverMetadata();

      passport.use(
        `oidc`,
        new OAuth2Strategy(
          {
            authorizationURL: oidcMetadata.authorization_endpoint ?? ``,
            clientID: config.authentication.oidc.clientId,
            clientSecret: config.authentication.oidc.clientSecret,
            callbackURL: config.authentication.oidc.oauthCallbackUrl,
            tokenURL: oidcMetadata.token_endpoint ?? ``,
            scope: [`openid`, `profile`, `email`],
            state: true,
          },
          (accessToken: string, _refreshToken: unknown, result: OIDCResult, _profile: unknown, done: OAuth2VerifyCallback) => {
            const subject = decodeTokenSubject(result.id_token);

            oidClient
              .fetchUserInfo(oidcConfig, accessToken, subject)
              .then((userInfo: OIDCUserInfo) => {
                done(null, {
                  id: userInfo.sub,
                  name: userInfo.name || ``,
                  email: userInfo.email || ``,
                  picture: userInfo.picture || ``,
                  idToken: result.id_token,
                  accessToken,
                });
              })
              .catch((error: unknown) => {
                done(error);
              });
          },
        ),
      );
    })();
  }

  return oidcStrategyPromise;
};

const isAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== `object`) {
    return false;
  }

  const candidate = value as Partial<AuthUser>;

  return (
    typeof candidate.id === `string` && typeof candidate.name === `string` && typeof candidate.email === `string` && typeof candidate.picture === `string` && typeof candidate.idToken === `string` && typeof candidate.accessToken === `string`
  );
};

export const normalizeReturnTo = (value: unknown): string | undefined => {
  if (typeof value === `string` && value.length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === `string` && entry.length > 0);
    return first;
  }

  return undefined;
};

export const storeReturnTo = (session: SessionData | null, returnTo: string | undefined): void => {
  if (session && returnTo) {
    session.returnTo = returnTo;
  }
};

export const storeAuthenticatedUser = (session: SessionData | null, user: unknown): void => {
  if (!session) {
    return;
  }

  if (!isAuthUser(user)) {
    throw new Error(`Authenticated user payload is invalid`);
  }

  session.user = user;
};

export const consumeReturnTo = (session: SessionData | null): string => {
  const returnTo = session?.returnTo || `/`;

  if (session) {
    delete session.returnTo;
  }

  return returnTo;
};

export const clearSession = (): null => null;

export const buildProfileResponse = (user: AuthUser | undefined): { isAuthenticated: boolean; user: AuthUser | null } => {
  if (user) {
    return {
      isAuthenticated: true,
      user,
    };
  }

  return {
    isAuthenticated: false,
    user: null,
  };
};

export { ensureOidcStrategy, passport };
