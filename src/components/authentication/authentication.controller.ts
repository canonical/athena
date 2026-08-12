import type { OIDCUserInfo } from "@components/authentication/authentication.schema.js";
import type { AuthenticatedUser, Session, User } from "@components/authentication/session.schema.js";
import { config } from "@components/config/config.js";
import { getPool, query } from "@components/postgres/postgres.js";
import { retry } from "@components/utilities/perseverance.js";
import type { Request } from "express";
import * as oidClient from "openid-client";
import { type AuthenticateOptions, Strategy } from "openid-client/passport";
import passport from "passport";

let oidcConfigPromise: Promise<oidClient.Configuration> | null = null;
let oidcStrategyPromise: Promise<void> | null = null;
const oidcSessionKey = `athenaOidc`;
const oidcRetryCount = 3;
const oidcRetryIntervalMs = 1000;

const parseCfVisitorScheme = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as { scheme?: string };
    if (parsed.scheme === `http` || parsed.scheme === `https`) {
      return parsed.scheme;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

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

    oidcConfigPromise = retry(
      () => oidClient.discovery(new URL(config.authentication.oidc.discoveryUrl), config.authentication.oidc.clientId, config.authentication.oidc.clientSecret, undefined, discoveryOptions),
      oidcRetryCount,
      oidcRetryIntervalMs,
    ).catch((error: unknown) => {
      oidcConfigPromise = null;
      throw error;
    });
  }

  return oidcConfigPromise;
};

const ensureOidcStrategy = async (): Promise<void> => {
  if (!oidcStrategyPromise) {
    oidcStrategyPromise = retry(
      async () => {
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

              if (!subject || !accessToken) {
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
                    subject,
                    name: userInfo.name?.trim() || ``,
                    email,
                    picture: userInfo.picture?.trim() || ``,
                  });
                })
                .catch((error: unknown) => {
                  done(error);
                });
            },
          ),
        );
      },
      oidcRetryCount,
      oidcRetryIntervalMs,
    ).catch((error: unknown) => {
      oidcStrategyPromise = null;
      throw error;
    });
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
    typeof candidate.picture === `string`
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

export const resolveExternalOrigin = (request: Request): string | undefined => {
  const host = request.get(`x-forwarded-host`) ?? request.get(`host`);

  if (!host) {
    return undefined;
  }

  const cfVisitorScheme = parseCfVisitorScheme(request.get(`cf-visitor`));
  const forwardedProto = request
    .get(`x-forwarded-proto`)
    ?.split(`,`)
    .map((value) => value.trim())
    .find((value) => value.length > 0);
  const protocol = cfVisitorScheme ?? forwardedProto ?? request.protocol;

  try {
    return new URL(`/`, `${protocol}://${host}`).origin;
  } catch {
    return undefined;
  }
};

export const resolveFrontendReturnToForRequest = (request: Request, returnTo: string | undefined): string => {
  const origin = resolveExternalOrigin(request);
  if (origin) {
    return new URL(returnTo ?? `/`, origin).toString();
  }

  return resolveFrontendReturnTo(returnTo);
};

export const resolveOidcCallbackUrl = (request: Request): string => {
  const origin = resolveExternalOrigin(request);

  if (!origin) {
    return config.authentication.oidc.oauthCallbackUrl;
  }

  try {
    return new URL(`/api/authentication/callback`, origin).toString();
  } catch {
    return config.authentication.oidc.oauthCallbackUrl;
  }
};

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
        DELETE FROM "session"
        WHERE "createdAt" < NOW() - (INTERVAL '1 millisecond' * $1::double precision)
      `,
      [config.authentication.session.maxAgeMs],
    );

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
        INSERT INTO "session" ("user")
        VALUES ($1)
        RETURNING "id"
      `,
      [user.id],
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

export const getAuthenticatedUser = async (sessionId: string | undefined): Promise<AuthenticatedUser | undefined> => {
  if (!sessionId) {
    return undefined;
  }

  const result = await query<AuthenticatedUser>(
    `
      SELECT
        u."id",
        u."subject",
        u."name",
        u."id" AS "email",
        u."picture"
      FROM "session" s
      JOIN "user" u ON u."id" = s."user"
      WHERE s."id" = $1
        AND s."createdAt" >= NOW() - (INTERVAL '1 millisecond' * $2::double precision)
    `,
    [sessionId, config.authentication.session.maxAgeMs],
  );

  return result.rows[0];
};

export const deleteAuthenticationSession = async (sessionId: string | undefined): Promise<void> => {
  if (!sessionId) {
    return;
  }

  await query(`DELETE FROM "session" WHERE "id" = $1`, [sessionId]);
};

export const consumeReturnTo = (session: Session | null, request: Request): string => {
  const returnTo = resolveFrontendReturnToForRequest(request, session?.returnTo);

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
