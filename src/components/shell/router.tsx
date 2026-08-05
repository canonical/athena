import { ApplicationLayout, Card, SideNavigation } from "@canonical/react-components";
import { fetchAuthenticationProfile } from "@components/authentication/authentication.client.js";
import { RouteBreadcrumbs } from "@components/base/RouteBreadcrumbs.js";
import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import athenaLogo from "./athena-logo.svg";
import favicon from "./favicon.png";
import { primarySideNavigationItems, SideNavigationLink, useAccountSideNavigationItems } from "./SideNavigation.js";
import type { AuthenticationSearch, ConnectionListSearch, LoopDetailSearch, LoopListSearch, PersonaListSearch, ProviderDetailSearch, ProviderListSearch, RunnerListSearch, WorkgraphListSearch } from "./shell.schema.js";
import "./shell.scss";

const rootPath = `/`;
const authenticationPath = `/authentication`;
const authenticationSignOutPath = `/authentication/sign-out`;
const loopBasePath = `/loop`;
const connectionBasePath = `/connection`;
const personaBasePath = `/persona`;
const providerBasePath = `/provider`;
const runnerBasePath = `/runner`;
const workgraphBasePath = `/workgraph`;

const loopListRoutePath = `list`;
const loopDetailRoutePath = `$loopId`;
const personaListRoutePath = `list`;
const personaDetailRoutePath = `$personaId`;
const providerListRoutePath = `list`;
const providerDetailRoutePath = `$providerId`;
const runnerListRoutePath = `list`;
const runnerDetailRoutePath = `$runnerId`;
const workgraphListRoutePath = `list`;
const workgraphDetailRoutePath = `$workgraphId`;

const parseCreateFlag = (value: unknown): true | undefined => (value === true || value === `true` ? true : undefined);

const parseLoopListSearch = (search: Record<string, unknown>): LoopListSearch => ({
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
});

const parsePersonaListSearch = (search: Record<string, unknown>): PersonaListSearch => ({
  tab: search.tab === `my-personas` || search.tab === `catalog` ? search.tab : `my-personas`,
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
  clone: parseCreateFlag(search.clone),
});

const parseProviderListSearch = (search: Record<string, unknown>): ProviderListSearch => ({
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
});

const parseProviderDetailSearch = (search: Record<string, unknown>): ProviderDetailSearch => ({
  tab: search.tab === `details` || search.tab === `settings` ? search.tab : `details`,
});

const parseLoopDetailSearch = (search: Record<string, unknown>): LoopDetailSearch => ({
  tab:
    search.tab === `dashboard` ||
    search.tab === `details` ||
    search.tab === `llm-tools` ||
    search.tab === `personas` ||
    search.tab === `providers` ||
    search.tab === `runners` ||
    search.tab === `workgraphs` ||
    search.tab === `repositories`
      ? search.tab
      : `dashboard`,
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
  clone: parseCreateFlag(search.clone),
  workgraphView: typeof search.workgraphView === `string` ? search.workgraphView : undefined,
  workgraphConfigTab:
    search.workgraphConfigTab === `jql` ||
    search.workgraphConfigTab === `labels` ||
    search.workgraphConfigTab === `item-type-playbooks` ||
    search.workgraphConfigTab === `webhook-definitions` ||
    search.workgraphConfigTab === `synced-items`
      ? search.workgraphConfigTab
      : undefined,
});

const parseRunnerListSearch = (search: Record<string, unknown>): RunnerListSearch => ({
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
});

const parseConnectionListSearch = (search: Record<string, unknown>): ConnectionListSearch => ({
  tab: search.tab === `workgraphs` || search.tab === `repositories` ? search.tab : `workgraphs`,
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
});

const parseWorkgraphListSearch = (search: Record<string, unknown>): WorkgraphListSearch => ({
  create: parseCreateFlag(search.create),
  edit: typeof search.edit === `string` ? search.edit : undefined,
});

const LazyAuthenticationView = lazy(async () => {
  const module = await import("@components/authentication/Authentication.js");

  return { default: module.AuthenticationView };
});

const LazyAuthenticationSignOutView = lazy(async () => {
  const module = await import("@components/authentication/Authentication.js");

  return { default: module.AuthenticationSignOutView };
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

const LazyRunnerList = lazy(async () => {
  const module = await import("@components/runner/RunnerList.js");

  return { default: module.RunnerList };
});

const LazyRunnerLayout = lazy(async () => {
  const module = await import("@components/runner/RunnerLayout.js");

  return { default: module.RunnerLayout };
});

const LazyRunner = lazy(async () => {
  const module = await import("@components/runner/Runner.js");

  return { default: module.Runner };
});

const LazyConnections = lazy(async () => {
  const module = await import("@components/connection/Connections.js");

  return { default: module.Connections };
});

const LazyWorkgraphList = lazy(async () => {
  const module = await import("@components/workgraph/WorkgraphList.js");

  return { default: module.WorkgraphList };
});

const LazyWorkgraphLayout = lazy(async () => {
  const module = await import("@components/workgraph/WorkgraphLayout.js");

  return { default: module.WorkgraphLayout };
});

const LazyWorkgraph = lazy(async () => {
  const module = await import("@components/workgraph/Workgraph.js");

  return { default: module.Workgraph };
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
  const { tab, create, edit, clone, workgraphView, workgraphConfigTab } = loopDetailRoute.useSearch();
  const editor = create ? `create` : clone && edit ? `clone` : edit ? `edit` : undefined;

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoop
        editor={editor}
        loopId={loopId}
        personaId={edit}
        tab={tab ?? `details`}
        workgraphViewWorkgraphId={workgraphView}
        workgraphConfigTab={workgraphConfigTab}
      />
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
  const { tab } = providerDetailRoute.useSearch();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyProvider providerId={providerId} tab={tab ?? `details`} />
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
  const { tab, create, edit, clone } = personaRoute.useSearch();
  const editor = create ? `create` : clone && edit ? `clone` : edit ? `edit` : undefined;

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyPersonaList editor={editor} personaId={edit} tab={tab} />
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

function RunnerListRouteView() {
  const { create, edit } = runnerRoute.useSearch();
  const editor = create ? `create` : edit ? `edit` : undefined;

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyRunnerList editor={editor} runnerId={edit} />
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

function RunnerLayoutRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyRunnerLayout />
    </Suspense>
  );
}

function RunnerDetailView() {
  const { runnerId } = runnerDetailRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyRunner runnerId={runnerId} />
    </Suspense>
  );
}

function ConnectionRouteView() {
  const { tab, create, edit } = connectionRoute.useSearch();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyConnections tab={tab ?? `workgraphs`} create={create} edit={edit} />
    </Suspense>
  );
}

function WorkgraphListRouteView() {
  const { create, edit } = workgraphRoute.useSearch();
  const editor = create ? `create` : edit ? `edit` : undefined;

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyWorkgraphList editor={editor} workgraphId={edit} />
    </Suspense>
  );
}

function WorkgraphLayoutRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyWorkgraphLayout />
    </Suspense>
  );
}

function WorkgraphDetailView() {
  const { workgraphId } = workgraphDetailRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyWorkgraph workgraphId={workgraphId} />
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

const connectionRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: connectionBasePath,
  validateSearch: parseConnectionListSearch,
  component: ConnectionRouteView,
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
  validateSearch: parseProviderDetailSearch,
  component: ProviderDetailView,
});

const runnerLayoutRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: runnerBasePath,
  component: RunnerLayoutRouteView,
});

const runnerRoute = createRoute({
  getParentRoute: () => runnerLayoutRoute,
  path: runnerListRoutePath,
  validateSearch: parseRunnerListSearch,
  component: RunnerListRouteView,
});

const runnerDetailRoute = createRoute({
  getParentRoute: () => runnerLayoutRoute,
  path: runnerDetailRoutePath,
  component: RunnerDetailView,
});

const workgraphLayoutRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: workgraphBasePath,
  component: WorkgraphLayoutRouteView,
});

const workgraphRoute = createRoute({
  getParentRoute: () => workgraphLayoutRoute,
  path: workgraphListRoutePath,
  validateSearch: parseWorkgraphListSearch,
  component: WorkgraphListRouteView,
});

const workgraphDetailRoute = createRoute({
  getParentRoute: () => workgraphLayoutRoute,
  path: workgraphDetailRoutePath,
  component: WorkgraphDetailView,
});

const routeTree = rootRoute.addChildren([
  authenticationRoute,
  authenticationSignOutRoute,
  protectedRoute.addChildren([
    overviewRoute,
    connectionRoute,
    loopLayoutRoute.addChildren([loopListRoute, loopDetailRoute]),
    personaLayoutRoute.addChildren([personaRoute, personaDetailRoute]),
    providerLayoutRoute.addChildren([providerRoute, providerDetailRoute]),
    runnerLayoutRoute.addChildren([runnerRoute, runnerDetailRoute]),
    workgraphLayoutRoute.addChildren([workgraphRoute, workgraphDetailRoute]),
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
