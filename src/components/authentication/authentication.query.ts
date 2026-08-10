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
      } catch (error) {
        console.error(`Failed to fetch current user:`, error);
        // silently ignore — owner comparison will treat all personas as unowned
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  // Ensure we always return either User or null, never undefined
  return (data as User | null) || null;
};
