import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { useEffect, useState } from "react";
import { authenticationApiPaths, getAuthenticationLoginPath } from "./authentication.client.js";

type AuthenticationProfile = {
  isAuthenticated: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    picture: string;
  } | null;
};

type AuthenticationViewProps = {
  returnTo: string;
};

export function AuthenticationView({ returnTo }: AuthenticationViewProps) {
  const resolvedReturnTo = new URL(returnTo || `/`, window.location.origin).toString();
  const authenticationLoginPath = getAuthenticationLoginPath(resolvedReturnTo);
  const [profile, setProfile] = useState<AuthenticationProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const response = await fetch(authenticationApiPaths.profile, { credentials: `include` });

        if (!response.ok) {
          throw new Error(`Authentication profile request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as AuthenticationProfile;

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
      <section className="athena-home">
        <p className="p-heading--5">Authentication</p>
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load authentication state">
          {errorMessage}
        </Notification>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="athena-home">
        <p className="p-heading--5">Authentication</p>
        <p className="p-text--default">Checking authentication status...</p>
      </section>
    );
  }

  if (!profile.isAuthenticated || !profile.user) {
    return (
      <section className="athena-home">
        <p className="p-heading--5">Authentication</p>
        <h1 className="p-heading--2">Sign in to Athena</h1>
        <p className="p-text--default">Authenticate with the configured OIDC provider to access protected backend routes.</p>
        <Button appearance="positive" element="a" href={authenticationLoginPath}>
          Sign in
        </Button>
      </section>
    );
  }

  return (
    <section className="athena-home">
      <p className="p-heading--5">Authentication</p>
      <h1 className="p-heading--2">You are authenticated</h1>
      <p className="p-text--default">Signed in as {profile.user.email || profile.user.name || profile.user.id}.</p>
      <Button appearance="base" element="a" href={authenticationApiPaths.logout}>
        Sign out
      </Button>
    </section>
  );
}
