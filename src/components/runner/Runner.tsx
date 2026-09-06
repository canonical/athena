import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useState } from "react";
import { createRunnerToken, revokeRunnerToken } from "./runner.client.js";
import { useRunnerById, useRunnerInstances, useRunnerTokens } from "./runner.query.js";

type RunnerDetailProps = {
  runnerId: string;
};

const lifecycleLabel = {
  active: `Active`,
  deprecated: `Deprecated`,
  archived: `Archived`,
} as const;

export function Runner({ runnerId }: RunnerDetailProps) {
  const { state } = useRunnerById(runnerId);
  const { state: tokenState, reload: reloadTokens } = useRunnerTokens(runnerId);
  const { state: instanceState } = useRunnerInstances(runnerId);
  const [tokenName, setTokenName] = useState(``);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);

  if (state.status === `loading`) {
    return <p className="p-text--default">Loading runner...</p>;
  }

  if (state.status === `error`) {
    return (
      <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load runner">
        {state.message}
      </Notification>
    );
  }

  const runner = state.runner;
  const createToken = async () => {
    setTokenError(null);
    try {
      const result = await createRunnerToken(runnerId, { name: tokenName || `Default token` });
      setCreatedToken(result.token);
      setTokenName(``);
      reloadTokens();
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : String(error));
    }
  };

  const revokeToken = async (tokenId: string) => {
    setRevokingTokenId(tokenId);
    setTokenError(null);
    try {
      await revokeRunnerToken(runnerId, tokenId);
      reloadTokens();
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : String(error));
    } finally {
      setRevokingTokenId(null);
    }
  };

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">{runner.name}</h1>
      <div className="p-card p-strip is-shallow">
        <h2 className="p-heading--4">Runner details</h2>
        <dl>
          <dt>Runner</dt>
          <dd>{runner.type}</dd>
          <dt>Lifecycle status</dt>
          <dd>{lifecycleLabel[runner.lifecycleStatus] ?? runner.lifecycleStatus}</dd>
          <dt>Credential configured</dt>
          <dd>{runner.hasCredential ? `Yes` : `No`}</dd>
        </dl>
      </div>
      {runner.type === `athena-workshop` ? (
        <div className="p-card p-strip is-shallow">
          <h2 className="p-heading--4">Workforce connection</h2>
          <p>Use one token across multiple Workshop runner units.</p>
          <label htmlFor="runner-token-name">Token name</label>
          <input id="runner-token-name" onChange={(event) => setTokenName(event.target.value)} value={tokenName} />
          <Button appearance="positive" onClick={() => void createToken()} type="button">
            Create token
          </Button>
          {createdToken ? (
            <>
              <p>Copy this token now. It will not be shown again.</p>
              <pre>{createdToken}</pre>
            </>
          ) : null}
          {tokenError ? (
            <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to create token">
              {tokenError}
            </Notification>
          ) : null}
          <h3 className="p-heading--5">Tokens</h3>
          {tokenState.status === `success` ? (
            <ul>
              {tokenState.tokens.map((token) => (
                <li key={token.id}>
                  {token.name} {token.revokedAt ? `(revoked)` : `(active)`}
                  {!token.revokedAt ? (
                    <Button appearance="base" disabled={revokingTokenId === token.id} onClick={() => void revokeToken(token.id)} type="button">
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <h3 className="p-heading--5">Connected instances</h3>
          {instanceState.status === `success` ? (
            <ul>
              {instanceState.instances.map((instance) => (
                <li key={instance.id}>
                  {instance.name} ({new Date(instance.lastSeenAt).toLocaleString()})
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
