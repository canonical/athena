import type { OIDCUserInfo } from "@components/authentication/authentication.schema.js";
import type { AuthenticatedUser, Session, User } from "@components/authentication/session.schema.js";
import { config } from "@components/config/config.js";
import { getPool } from "@components/postgres/postgres.js";
import type { Request } from "express";
import * as oidClient from "openid-client";
import { type AuthenticateOptions, Strategy } from "openid-client/passport";
import passport from "passport";

let oidcConfigPromise: Promise<oidClient.Configuration> | null = null;
let oidcStrategyPromise: Promise<void> | null = null;
const oidcSessionKey = `athenaOidc`;

const allowedReturnToOrigins = new Set(
  config.cors.allowedOrigins
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return undefined;
      }
    })
    .filter((origin): origin is string => Boolean(origin)),
);

const isAllowedAbsoluteReturnTo = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== `http:` && parsed.protocol !== `https:`) {
      return false;
    }

    return allowedReturnToOrigins.has(parsed.origin);
  } catch {
    return false;
  }
};

const isAllowedRelativeReturnTo = (value: string): boolean => value.startsWith(`/`) && !value.startsWith(`//`);

class AthenaStrategy extends Strategy {
  override authorizationRequestParams<TOptions extends AuthenticateOptions>(req: Request, options: TOptions): URLSearchParams | Record<string, string> | undefined {
    const params = new URLSearchParams(super.authorizationRequestParams(req, options));

    if (!params.has(`state`)) {
      params.set(`state`, oidClient.randomState());
    }

    return params;
  }
}

const sanitizeReturnTo = (value: unknown): string | undefined => {
  if (typeof value !== `string`) {
    return undefined;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return undefined;
  }

  if (isAllowedRelativeReturnTo(normalized) || isAllowedAbsoluteReturnTo(normalized)) {
    return normalized;
  }

  return undefined;
};

const getOidcConfiguration = async (): Promise<oidClient.Configuration> => {
  if (!oidcConfigPromise) {
    const discoveryOptions = config.application.nodeEnv === `production` ? undefined : { execute: [oidClient.allowInsecureRequests] };

    oidcConfigPromise = oidClient.discovery(new URL(config.authentication.oidc.discoveryUrl), config.authentication.oidc.clientId, config.authentication.oidc.clientSecret, undefined, discoveryOptions);
  }

  return oidcConfigPromise;
};

const ensureOidcStrategy = async (): Promise<void> => {
  if (!oidcStrategyPromise) {
    oidcStrategyPromise = (async () => {
      const oidcConfig = await getOidcConfiguration();

      passport.use(
        `oidc`,
        new AthenaStrategy(
          {
            config: oidcConfig,
            name: `oidc`,
            sessionKey: oidcSessionKey,
            callbackURL: config.authentication.oidc.oauthCallbackUrl,
            scope: `openid profile email`,
          },
          (tokens, done) => {
            const claims = tokens.claims();
            const subject = claims?.sub;
            const accessToken = tokens.access_token;
            const idToken = tokens.id_token;

            if (!subject || !accessToken || !idToken) {
              done(new Error(`OIDC token response did not include required claims or tokens`));
              return;
            }

            oidClient
              .fetchUserInfo(oidcConfig, accessToken, subject)
              .then((userInfo: OIDCUserInfo) => {
                const email = userInfo.email?.trim();

                if (!email) {
                  done(new Error(`OIDC user info did not include a required email claim`));
                  return;
                }

                done(null, {
                  id: email,
                  subject: userInfo.sub,
                  name: userInfo.name?.trim() || ``,
                  email,
                  picture: userInfo.picture?.trim() || ``,
                  idToken,
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

const isAuthenticatedUser = (value: unknown): value is AuthenticatedUser => {
  if (!value || typeof value !== `object`) {
    return false;
  }

  const candidate = value as Partial<AuthenticatedUser>;

  return (
    typeof candidate.id === `string` &&
    candidate.id.length > 0 &&
    typeof candidate.subject === `string` &&
    typeof candidate.name === `string` &&
    typeof candidate.email === `string` &&
    candidate.email.length > 0 &&
    candidate.id === candidate.email &&
    typeof candidate.picture === `string` &&
    typeof candidate.idToken === `string` &&
    typeof candidate.accessToken === `string`
  );
};

export const normalizeReturnTo = (value: unknown): string | undefined => {
  const singleValue = sanitizeReturnTo(value);

  if (singleValue) {
    return singleValue;
  }

  if (Array.isArray(value)) {
    const firstSafe = value.map((entry) => sanitizeReturnTo(entry)).find((entry): entry is string => typeof entry === `string`);

    return firstSafe;
  }

  return undefined;
};

export const storeReturnTo = (session: Session | null, returnTo: string | undefined): void => {
  if (session && returnTo) {
    session.returnTo = returnTo;
  }
};

export const resolveFrontendReturnTo = (returnTo: string | undefined): string => new URL(returnTo ?? `/`, config.frontend.baseUrl).toString();

export const pruneSessionToCookieFields = (session: Session | null | undefined): void => {
  if (!session) {
    return;
  }

  for (const key of Object.keys(session)) {
    if (key !== `id` && key !== `returnTo`) {
      delete (session as Record<string, unknown>)[key];
    }
  }
};

export const storeAuthenticatedUser = async (session: Session | null, user: unknown): Promise<void> => {
  if (!session) {
    return;
  }

  if (!isAuthenticatedUser(user)) {
    throw new Error(`Authenticated user payload is invalid`);
  }

  const client = await getPool().connect();

  try {
    await client.query(`BEGIN`);

    await client.query(
      `
        INSERT INTO "user" ("id", "subject", "name", "picture")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("id") DO UPDATE SET
          "subject" = EXCLUDED."subject",
          "name" = EXCLUDED."name",
          "picture" = EXCLUDED."picture",
          "updatedAt" = NOW()
      `,
      [user.id, user.subject, user.name, user.picture],
    );

    const result = await client.query<{ id: string }>(
      `
        INSERT INTO "session" ("user", "idToken", "accessToken")
        VALUES ($1, $2, $3)
        RETURNING "id"
      `,
      [user.id, user.idToken, user.accessToken],
    );

    const sessionId = result.rows[0]?.id;

    if (!sessionId) {
      throw new Error(`Authentication session was not created`);
    }

    await client.query(`COMMIT`);
    session.id = sessionId;
    pruneSessionToCookieFields(session);
  } catch (error) {
    await client.query(`ROLLBACK`);
    throw error;
  } finally {
    client.release();
  }
};

export const getAuthenticatedUser = async (sessionId: string | undefined): Promise<User | undefined> => {
  if (!sessionId) {
    return undefined;
  }

  const result = await getPool().query<User>(
    `
      SELECT
        u."id",
        u."name",
        u."id" AS "email",
        u."picture"
      FROM "session" s
      JOIN "user" u ON u."id" = s."user"
      WHERE s."id" = $1
    `,
    [sessionId],
  );

  return result.rows[0];
};

export const deleteAuthenticationSession = async (sessionId: string | undefined): Promise<void> => {
  if (!sessionId) {
    return;
  }

  await getPool().query(`DELETE FROM "session" WHERE "id" = $1`, [sessionId]);
};

export const consumeReturnTo = (session: Session | null): string => {
  const returnTo = resolveFrontendReturnTo(session?.returnTo);

  if (session) {
    delete session.returnTo;
  }

  return returnTo;
};

export const clearSession = (): null => null;

export const buildProfileResponse = (user: User | undefined): { isAuthenticated: boolean; user: User | null } => {
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
