import { ApplicationLayout, Card, SideNavigation } from "@canonical/react-components";
import { fetchAuthenticationProfile } from "@components/authentication/authentication.client.js";
import { RouteBreadcrumbs } from "@components/base/RouteBreadcrumbs.js";
import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import athenaLogo from "./athena-logo.svg";
import favicon from "./favicon.png";
import { primarySideNavigationItems, SideNavigationLink, useAccountSideNavigationItems } from "./SideNavigation.js";
import type { AuthenticationSearch, LoopDetailSearch, LoopListSearch, PersonaListSearch, ProviderListSearch } from "./shell.schema.js";
import "./shell.scss";

const rootPath = `/`;
const authenticationPath = `/authentication`;
const authenticationSignOutPath = `/authentication/sign-out`;
const loopBasePath = `/loop`;
const eventBasePath = `/event`;
const personaBasePath = `/persona`;
const providerBasePath = `/provider`;

const loopListRoutePath = `list`;
const loopDetailRoutePath = `$loopId`;
const eventListRoutePath = `list`;
const personaListRoutePath = `list`;
const personaDetailRoutePath = `$personaId`;
const providerListRoutePath = `list`;
const providerDetailRoutePath = `$providerId`;

const parseCreateFlag = (value: unknown): true | undefined => (value === true || value === `true` ? true : undefined);

const parseLoopListSearch = (search: Record<string, unknown>): LoopListSearch => ({
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
});

const parsePersonaListSearch = (search: Record<string, unknown>): PersonaListSearch => ({
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
  clone: parseCreateFlag(search.clone),
});

const parseProviderListSearch = (search: Record<string, unknown>): ProviderListSearch => ({
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
});

const parseLoopDetailSearch = (search: Record<string, unknown>): LoopDetailSearch => ({
  tab: search.tab === `personas` || search.tab === `providers` ? search.tab : `details`,
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
  clone: parseCreateFlag(search.clone),
});

const LazyAuthenticationView = lazy(async () => {
  const module = await import("@components/authentication/Authentication.js");

  return { default: module.AuthenticationView };
});

const LazyAuthenticationSignOutView = lazy(async () => {
  const module = await import("@components/authentication/Authentication.js");

  return { default: module.AuthenticationSignOutView };
});

const LazyEvent = lazy(async () => {
  const module = await import("@components/event/Event.js");

  return { default: module.Event };
});

const LazyEventLayout = lazy(async () => {
  const module = await import("@components/event/EventLayout.js");

  return { default: module.EventLayout };
});

const LazyLoop = lazy(async () => {
  const module = await import("@components/loop/Loop.js");

  return { default: module.Loop };
});

const LazyLoopLayout = lazy(async () => {
  const module = await import("@components/loop/LoopLayout.js");

  return { default: module.LoopLayout };
});

const LazyLoopList = lazy(async () => {
  const module = await import("@components/loop/LoopList.js");

  return { default: module.LoopList };
});

const LazyNotFoundView = lazy(async () => {
  const module = await import("./NotFoundView.js");

  return { default: module.NotFoundView };
});

const LazyOverviewView = lazy(async () => {
  const module = await import("./OverviewView.js");

  return { default: module.OverviewView };
});

const LazyPersona = lazy(async () => {
  const module = await import("@components/persona/Persona.js");

  return { default: module.Persona };
});

const LazyPersonaLayout = lazy(async () => {
  const module = await import("@components/persona/PersonaLayout.js");

  return { default: module.PersonaLayout };
});

const LazyPersonaList = lazy(async () => {
  const module = await import("@components/persona/PersonaList.js");

  return { default: module.PersonaList };
});

const LazyProviderList = lazy(async () => {
  const module = await import("@components/provider/ProviderList.js");

  return { default: module.ProviderList };
});

const LazyProviderLayout = lazy(async () => {
  const module = await import("@components/provider/ProviderLayout.js");

  return { default: module.ProviderLayout };
});

const LazyProvider = lazy(async () => {
  const module = await import("@components/provider/Provider.js");

  return { default: module.Provider };
});

function ShellLayout() {
  const accountSideNavigationItems = useAccountSideNavigationItems();

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
      sideNavigation={
        <div className="athena-side-navigation-shell">
          <SideNavigation dark={true} hasIcons={true} items={primarySideNavigationItems} linkComponent={SideNavigationLink} />
          <div className="athena-side-navigation-shell__account">
            <hr />
            <SideNavigation dark={true} hasIcons={true} items={accountSideNavigationItems} linkComponent={SideNavigationLink} />
          </div>
        </div>
      }
    >
      <Card style={{ height: `100vh` }} className="u-no-margin">
        <RouteBreadcrumbs />
        <Outlet />
      </Card>
    </ApplicationLayout>
  );
}

function RouteLoadingView() {
  return (
    <section className="p-strip is-shallow u-no-max-width">
      <p className="p-text--default">Loading page...</p>
    </section>
  );
}

function AuthenticationRouteView() {
  const { returnTo } = authenticationRoute.useSearch();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyAuthenticationView returnTo={returnTo ?? rootPath} />
    </Suspense>
  );
}

function AuthenticationSignOutRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyAuthenticationSignOutView />
    </Suspense>
  );
}

const resolveReturnTo = (location: { href?: string }): string => {
  const fallbackOrigin = typeof window === `undefined` ? `http://athena.localhost` : window.location.origin;
  const targetUrl = new URL(location.href ?? rootPath, fallbackOrigin);

  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
};

const guardAuthenticatedRoute = async (location: { href?: string }) => {
  const profile = await fetchAuthenticationProfile();

  if (!profile.isAuthenticated || !profile.user) {
    throw redirect({ to: authenticationPath, search: { returnTo: resolveReturnTo(location) } });
  }
};

function LoopDetailView() {
  const { loopId } = loopDetailRoute.useParams();
  const { tab, create, edit, clone } = loopDetailRoute.useSearch();
  const editor = create ? `create` : clone && edit ? `clone` : edit ? `edit` : undefined;

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoop editor={editor} loopId={loopId} personaId={edit} tab={tab ?? `details`} />
    </Suspense>
  );
}

function PersonaDetailView() {
  const { personaId } = personaDetailRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyPersona personaId={personaId} />
    </Suspense>
  );
}

function ProviderDetailView() {
  const { providerId } = providerDetailRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyProvider providerId={providerId} />
    </Suspense>
  );
}

function LoopListRouteView() {
  const { create, edit } = loopListRoute.useSearch();
  const editor = create ? `create` : edit ? `edit` : undefined;

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopList editor={editor} loopId={edit} />
    </Suspense>
  );
}

function PersonaListRouteView() {
  const { create, edit, clone } = personaRoute.useSearch();
  const editor = create ? `create` : clone && edit ? `clone` : edit ? `edit` : undefined;

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyPersonaList editor={editor} personaId={edit} />
    </Suspense>
  );
}

function ProviderListRouteView() {
  const { create, edit } = providerRoute.useSearch();
  const editor = create ? `create` : edit ? `edit` : undefined;

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyProviderList editor={editor} providerId={edit} />
    </Suspense>
  );
}

function PersonaLayoutRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyPersonaLayout />
    </Suspense>
  );
}

function ProviderLayoutRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyProviderLayout />
    </Suspense>
  );
}

function LoopLayoutRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopLayout />
    </Suspense>
  );
}

function EventRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyEvent />
    </Suspense>
  );
}

function EventLayoutRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyEventLayout />
    </Suspense>
  );
}

function OverviewRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyOverviewView />
    </Suspense>
  );
}

function NotFoundRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyNotFoundView />
    </Suspense>
  );
}

const rootRoute = createRootRoute({
  component: ShellLayout,
  notFoundComponent: NotFoundRouteView,
});

const overviewRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: rootPath,
  component: OverviewRouteView,
});

const authenticationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: authenticationPath,
  validateSearch: (search: Record<string, unknown>): AuthenticationSearch => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
  }),
  component: AuthenticationRouteView,
});

const authenticationSignOutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: authenticationSignOutPath,
  component: AuthenticationSignOutRouteView,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: `authenticated`,
  beforeLoad: async ({ location }) => {
    await guardAuthenticatedRoute(location);
  },
  component: Outlet,
});

const loopLayoutRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: loopBasePath,
  component: LoopLayoutRouteView,
});

const loopListRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopListRoutePath,
  validateSearch: parseLoopListSearch,
  component: LoopListRouteView,
});

const loopDetailRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopDetailRoutePath,
  validateSearch: parseLoopDetailSearch,
  component: LoopDetailView,
});

const eventLayoutRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: eventBasePath,
  component: EventLayoutRouteView,
});

const eventRoute = createRoute({
  getParentRoute: () => eventLayoutRoute,
  path: eventListRoutePath,
  component: EventRouteView,
});

const personaLayoutRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: personaBasePath,
  component: PersonaLayoutRouteView,
});

const personaRoute = createRoute({
  getParentRoute: () => personaLayoutRoute,
  path: personaListRoutePath,
  validateSearch: parsePersonaListSearch,
  component: PersonaListRouteView,
});

const personaDetailRoute = createRoute({
  getParentRoute: () => personaLayoutRoute,
  path: personaDetailRoutePath,
  component: PersonaDetailView,
});

const providerLayoutRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: providerBasePath,
  component: ProviderLayoutRouteView,
});

const providerRoute = createRoute({
  getParentRoute: () => providerLayoutRoute,
  path: providerListRoutePath,
  validateSearch: parseProviderListSearch,
  component: ProviderListRouteView,
});

const providerDetailRoute = createRoute({
  getParentRoute: () => providerLayoutRoute,
  path: providerDetailRoutePath,
  component: ProviderDetailView,
});

const routeTree = rootRoute.addChildren([
  authenticationRoute,
  authenticationSignOutRoute,
  protectedRoute.addChildren([
    overviewRoute,
    loopLayoutRoute.addChildren([loopListRoute, loopDetailRoute]),
    eventLayoutRoute.addChildren([eventRoute]),
    personaLayoutRoute.addChildren([personaRoute, personaDetailRoute]),
    providerLayoutRoute.addChildren([providerRoute, providerDetailRoute]),
  ]),
]);

export const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
