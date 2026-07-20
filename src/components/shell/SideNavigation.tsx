import type { SideNavigationProps } from "@canonical/react-components";
import { useCurrentUser } from "@components/authentication/authentication.query.js";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef } from "react";

export const primarySideNavigationItems: SideNavigationProps["items"] = [
  {
    items: [
      {
        icon: "status",
        label: "Overview",
        href: `/`,
      },
      {
        icon: "applications",
        label: "Loops",
        href: `/loop/list`,
      },
      {
        icon: "topic",
        label: "Events",
        href: `/event/list`,
      },
      {
        icon: "user-group",
        label: "Personas",
        href: `/persona/list`,
      },
      {
        icon: "models",
        label: "Providers",
        href: `/provider/list`,
      },
      {
        icon: "settings",
        label: "Harnesses",
        href: `/harness/list`,
      },
    ],
  },
];

export function useAccountSideNavigationItems(): SideNavigationProps["items"] {
  const user = useCurrentUser();

  return [
    {
      items: [
        {
          icon: "profile",
          label: "Profile",
          href: `/authentication`,
        },
        {
          icon: "log-out",
          label: user ? "Sign out" : "Sign in",
          href: user ? `/authentication/sign-out` : `/authentication`,
        },
      ],
    },
  ];
}

type NavigationLinkProps = ComponentPropsWithoutRef<"a">;
type InternalToPath = LinkProps["to"];

export function SideNavigationLink({ href, ...props }: NavigationLinkProps) {
  if (!href) {
    return <a {...props} />;
  }

  if (href.startsWith(`http`) || href.startsWith(`mailto:`) || href.startsWith(`tel:`) || href.startsWith(`#`)) {
    return <a href={href} {...props} />;
  }

  return <Link to={href as InternalToPath} {...props} />;
}
