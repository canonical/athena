import { useQuery } from "@tanstack/react-query";
import { fetchAuthenticationProfile } from "./authentication.client.js";
import type { User } from "./session.schema.js";

export type CurrentUserState = User | null;

export const useCurrentUser = (): CurrentUserState => {
  const { data } = useQuery({
    queryKey: [`currentUser`],
    queryFn: async () => {
      try {
        const payload = await fetchAuthenticationProfile();
        return payload.isAuthenticated && payload.user ? payload.user : null;
      } catch {
        // silently ignore — owner comparison will treat all personas as unowned
        return null;
      }
    },
    initialData: null,
  });

  return data;
};
