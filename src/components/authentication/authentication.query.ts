import { useEffect, useState } from "react";
import { authenticationApiPaths } from "./authentication.client.js";
import type { User } from "./session.schema.js";

export type CurrentUserState = User | null;

export const useCurrentUser = (): CurrentUserState => {
  const [user, setUser] = useState<CurrentUserState>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(authenticationApiPaths.profile, { credentials: `include` });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { isAuthenticated: boolean; user: User | null };

        if (active && payload.isAuthenticated && payload.user) {
          setUser(payload.user);
        }
      } catch {
        // silently ignore — owner comparison will treat all personas as unowned
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  return user;
};
