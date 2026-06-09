import { ApplicationLayout, Chip, Notification, NotificationSeverity } from "@canonical/react-components";
import { AuthenticationView } from "@components/authentication/Authentication.js";
import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";

import athenaLogo from "./athena-logo.svg";
import favicon from "./favicon.png";
import { SideNavigationLink, sideNavigationItems } from "./SideNavigation.js";
import "./shell.scss";

const rootPath = `/`;
const authenticationPath = `/authentication`;

type AuthenticationSearch = {
  returnTo?: string;
};

function ShellLayout() {
  return (
    <ApplicationLayout
      dark={true}
      logo={{
        href: rootPath,
        icon: favicon,
        iconAlt: "Athena",
        name: athenaLogo,
        nameAlt: "Athena",
      }}
      mainId="main-content"
      navItems={sideNavigationItems}
      navLinkComponent={SideNavigationLink}
      status={<Chip appearance="information" isReadOnly value="beta" />}
    >
      <Outlet />
    </ApplicationLayout>
  );
}

function OverviewView() {
  return (
    <section className="athena-home">
      <p className="p-heading--5">Athena</p>
      <h1 className="p-heading--2">Hello from Athena</h1>
      <p className="p-text--default">Athena is live. This is the first React homepage, wired with Canonical React Components and a sidebar application layout.</p>
      <div className="athena-callout">
        <Notification severity={NotificationSeverity.INFORMATION} title="Status">
          Frontend shell is active.
        </Notification>
      </div>
    </section>
  );
}

function AuthenticationRouteView() {
  const { returnTo } = authenticationRoute.useSearch();

  return <AuthenticationView returnTo={returnTo ?? rootPath} />;
}

function NotFoundView() {
  return (
    <section className="athena-home">
      <p className="p-heading--5">Athena</p>
      <h1 className="p-heading--2">Page not found</h1>
      <p className="p-text--default">The requested route does not exist.</p>
      <Link to={rootPath}>Go back to overview</Link>
    </section>
  );
}

const rootRoute = createRootRoute({
  component: ShellLayout,
  notFoundComponent: NotFoundView,
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: rootPath,
  component: OverviewView,
});

const authenticationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: authenticationPath,
  validateSearch: (search: Record<string, unknown>): AuthenticationSearch => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
  }),
  component: AuthenticationRouteView,
});

const routeTree = rootRoute.addChildren([overviewRoute, authenticationRoute]);

export const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
