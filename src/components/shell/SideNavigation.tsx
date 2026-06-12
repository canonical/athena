import type { SideNavigationProps } from "@canonical/react-components";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef } from "react";

export const sideNavigationItems: SideNavigationProps["items"] = [
  {
    className: "athena-nav-primary",
    items: [
      {
        icon: "status-online",
        label: "Overview",
        href: `/`,
      },
      {
        icon: "user",
        label: "Authentication",
        href: `/authentication`,
      },
      {
        icon: "applications",
        label: "Projects",
        href: `/projects`,
      },
      {
        icon: "queue",
        label: "Loop",
        href: `/loop`,
      },
      {
        icon: "user-group",
        label: "Personas",
        nonInteractive: true,
      },
      {
        icon: "code",
        label: "Definitions",
        nonInteractive: true,
      },
    ],
  },
];

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
