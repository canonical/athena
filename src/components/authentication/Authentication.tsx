import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useEffect, useState } from "react";
import { authenticationApiPaths, fetchAuthenticationProfile, getAuthenticationLoginPath } from "./authentication.client.js";
import type { AuthenticationProfile } from "./authentication.schema.js";

type AuthenticationViewProps = {
  returnTo: string;
};

export function AuthenticationView({ returnTo }: AuthenticationViewProps) {
  const resolvedReturnTo = new URL(returnTo || `/`, window.location.origin).toString();
  const authenticationLoginPath = getAuthenticationLoginPath(resolvedReturnTo);
  const [profile, setProfile] = useState<AuthenticationProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const response = await fetch(authenticationApiPaths.logout, { method: `POST`, credentials: `include` });

      if (!response.ok) {
        throw new Error(`Authentication logout request failed with status ${response.status}`);
      }

      window.location.assign(new URL(`/`, window.location.origin).toString());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setIsSigningOut(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const payload = await fetchAuthenticationProfile();

        if (!active) {
          return;
        }

        setProfile(payload);
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setErrorMessage(message);
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  if (errorMessage) {
    return (
      <section className="p-strip is-shallow">
        <div className="row">
          <div className="col-6 col-start-large-4">
            <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load authentication state">
              {errorMessage}
            </Notification>
          </div>
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="p-strip is-shallow">
        <div className="row">
          <div className="col-6 col-start-large-4">
            <div className="p-card p-strip is-shallow">
              <p className="p-text--default">Checking authentication status...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!profile.isAuthenticated || !profile.user) {
    return (
      <section className="p-strip is-shallow">
        <div className="row">
          <div className="col-6 col-start-large-4">
            <h1 className="p-heading--2">Sign in to Athena</h1>
            <div className="p-card p-strip is-shallow">
              <p className="p-text--default">Authenticate with the configured OIDC provider to access protected backend routes.</p>
              <div className="u-align--right">
                <Button appearance="positive" element="a" href={authenticationLoginPath}>
                  Sign in
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="p-strip is-shallow">
      <div className="row">
        <div className="col-6 col-start-large-4">
          <h1 className="p-heading--2">You are authenticated</h1>
          <div className="p-card p-strip is-shallow">
            <p className="p-text--default">Signed in as {profile.user.email || profile.user.name || profile.user.id}.</p>
            <div className="u-align--right">
              <Button appearance="base" disabled={isSigningOut} onClick={handleSignOut} type="button">
                {isSigningOut ? `Signing out...` : `Sign out`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AuthenticationSignOutView() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const signOut = async () => {
      try {
        const response = await fetch(authenticationApiPaths.logout, { method: `POST`, credentials: `include` });

        if (!response.ok) {
          throw new Error(`Authentication logout request failed with status ${response.status}`);
        }

        window.location.assign(new URL(`/authentication`, window.location.origin).toString());
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setErrorMessage(message);
      }
    };

    void signOut();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">Signing out</h1>
      <div className="p-card p-strip is-shallow">
        {errorMessage ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to sign out">
            {errorMessage}
          </Notification>
        ) : (
          <p className="p-text--default">Ending your session...</p>
        )}
      </div>
    </section>
  );
}
