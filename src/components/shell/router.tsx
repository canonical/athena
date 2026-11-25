import { ApplicationLayout, Select, SideNavigation } from "@canonical/react-components";
import { fetchAuthenticationProfile } from "@components/authentication/authentication.client.js";
import { useLoopLayoutContext } from "@components/loop/loop.context.js";
import { useLoopList } from "@components/loop/loop.query.js";
import { loopTabs } from "@components/loop/loop.schema.js";
import type { LinkProps } from "@tanstack/react-router";
import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { type ComponentPropsWithoutRef, lazy, Suspense } from "react";

import athenaLogo from "./athena-logo.svg";
import favicon from "./favicon.png";
import { primarySideNavigationItems, SideNavigationLink, useAccountSideNavigationItems } from "./SideNavigation.js";
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

const personaListRoutePath = `list`;
const loopDetailRoutePath = `$loopId`;
const loopListCreateRoutePath = `loops/create`;
const loopListEditRoutePath = `loops/edit/$loopEditorId`;
const loopTaskListRoutePath = `${loopDetailRoutePath}/task/list`;
const loopTaskDetailRoutePath = `${loopDetailRoutePath}/task/$taskId`;
const loopDetailsRoutePath = `${loopDetailRoutePath}/details`;
const loopStepSequencesRoutePath = `${loopDetailRoutePath}/step-sequences`;
const loopStepSequenceDetailRoutePath = `${loopStepSequencesRoutePath}/$stepSequenceId`;
const loopStepDefinitionsRoutePath = `${loopDetailRoutePath}/step-definitions`;
const loopLegacyStepsRoutePath = `${loopDetailRoutePath}/steps`;
const loopToolsRoutePath = `${loopDetailRoutePath}/tools`;
const loopMembersRoutePath = `${loopDetailRoutePath}/members`;
const loopPersonasRoutePath = `${loopDetailRoutePath}/personas`;
const loopPersonaCreateRoutePath = `${loopDetailRoutePath}/personas/create`;
const loopPersonaEditRoutePath = `${loopDetailRoutePath}/personas/edit/$personaId`;
const loopPersonaCloneRoutePath = `${loopDetailRoutePath}/personas/clone/$personaId`;
const loopProvidersRoutePath = `${loopDetailRoutePath}/providers`;
const loopRunnersRoutePath = `${loopDetailRoutePath}/runners`;
const loopRunnerSessionsRoutePath = `${loopDetailRoutePath}/runners/$loopRunnerId`;
const loopRunnerRepositoriesRoutePath = `${loopDetailRoutePath}/runners/$loopRunnerId/repositories`;
const loopWorkgraphsRoutePath = `${loopDetailRoutePath}/workgraphs`;
const loopWorkgraphViewRoutePath = `${loopDetailRoutePath}/workgraphs/$workgraphViewWorkgraphId`;
const loopWorkgraphConfigRoutePath = `${loopDetailRoutePath}/workgraphs/$workgraphViewWorkgraphId/$workgraphConfigTab`;
const loopRepositoriesRoutePath = `${loopDetailRoutePath}/repositories`;
const personaDetailRoutePath = `$personaId`;
const providerListRoutePath = `list`;
const providerListCreateRoutePath = `list/create`;
const providerListEditRoutePath = `list/edit/$providerEditorId`;
const providerDetailRoutePath = `$providerId`;
const providerSettingsRoutePath = `$providerId/settings`;
const runnerListRoutePath = `list`;
const runnerListCreateRoutePath = `list/create`;
const runnerListEditRoutePath = `list/edit/$runnerEditorId`;
const runnerDetailRoutePath = `$runnerId`;
const connectionWorkgraphsRoutePath = `workgraphs`;
const connectionWorkgraphCreateRoutePath = `workgraphs/create`;
const connectionWorkgraphEditRoutePath = `workgraphs/edit/$workgraphId`;
const connectionRepositoriesRoutePath = `repositories`;
const connectionRepositoryCreateRoutePath = `repositories/create`;
const connectionRepositoryEditRoutePath = `repositories/edit/$repositoryId`;
const workgraphListRoutePath = `list`;
const workgraphListCreateRoutePath = `list/create`;
const workgraphListEditRoutePath = `list/edit/$workgraphEditorId`;
const workgraphDetailRoutePath = `$workgraphId`;

const LazyAuthenticationView = lazy(async () => {
  const module = await import("@components/authentication/Authentication.js");

  return { default: module.AuthenticationView };
});

const LazyAuthenticationSignOutView = lazy(async () => {
  const module = await import("@components/authentication/Authentication.js");

  return { default: module.AuthenticationSignOutView };
});

const LazyLoopLayout = lazy(async () => {
  const module = await import("@components/loop/LoopLayout.js");

  return { default: module.LoopLayout };
});

const LazyTaskList = lazy(async () => {
  const module = await import("@components/task/TaskList.js");

  return { default: module.TaskList };
});

const LazyLoopDetails = lazy(async () => {
  const module = await import("@components/loop/LoopDetails.js");

  return { default: module.LoopDetails };
});

const LazyLoopTools = lazy(async () => {
  const module = await import("@components/tool/LoopTools.js");

  return { default: module.LoopTools };
});

const LazyLoopPersonas = lazy(async () => {
  const module = await import("@components/loop/LoopPersonas.js");

  return { default: module.LoopPersonas };
});

const LazyLoopMembers = lazy(async () => {
  const module = await import("@components/loop/LoopMembers.js");

  return { default: module.LoopMembers };
});

const LazyLoopProviders = lazy(async () => {
  const module = await import("@components/loop/LoopProviders.js");

  return { default: module.LoopProviders };
});

const LazyLoopRunners = lazy(async () => {
  const module = await import("@components/loop/LoopRunners.js");

  return { default: module.LoopRunners };
});

const LazyLoopWorkgraphs = lazy(async () => {
  const module = await import("@components/loop/LoopWorkgraphs.js");

  return { default: module.LoopWorkgraphs };
});

const LazyLoopRepositories = lazy(async () => {
  const module = await import("@components/loop/LoopRepositories.js");

  return { default: module.LoopRepositories };
});

const LazyLoopSteps = lazy(async () => {
  const module = await import("@components/loop/LoopSteps.js");

  return { default: module.LoopSteps };
});

const LazyLoopStepSequences = lazy(async () => {
  const module = await import("@components/loop/LoopStepSequences.js");

  return { default: module.LoopStepSequences };
});

const LazyLoopStepDefinitions = lazy(async () => {
  const module = await import("@components/loop/LoopStepDefinitions.js");

  return { default: module.LoopStepDefinitions };
});

const LazyLoopList = lazy(async () => {
  const module = await import("@components/loop/LoopList.js");

  return { default: module.LoopList };
});

const LazyNotFoundView = lazy(async () => {
  const module = await import("./NotFoundView.js");

  return { default: module.NotFoundView };
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

const LazyLoopRunnerSessions = lazy(async () => {
  const module = await import("@components/loop/LoopRunnerSessions.js");

  return { default: module.LoopRunnerSessions };
});

const LazyLoopRunnerRepositories = lazy(async () => {
  const module = await import("@components/loop/LoopRunnerRepositories.js");

  return { default: module.LoopRunnerRepositories };
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

const LazyTaskDetails = lazy(async () => {
  const module = await import("@components/task/TaskDetails.js");

  return { default: module.TaskDetails };
});

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const loopTabLabels: Partial<Record<(typeof loopTabs)[number], string>> = {
  "step-sequences": `Step Sequences`,
  "step-definitions": `Step Definitions`,
};

function LoopSidebarLink({ href, className, ...props }: ComponentPropsWithoutRef<"a"> & { activePrefix?: string }) {
  const location = useRouterState({ select: (state) => state.location });

  if (!href) {
    return <a className={className} {...props} />;
  }

  const currentPath = location.pathname;
  const normalizedCurrent = currentPath.endsWith(`/`) ? currentPath.slice(0, -1) : currentPath;
  const activePrefix = (props as { activePrefix?: string }).activePrefix;
  const normalizedTarget = href.endsWith(`/`) ? href.slice(0, -1) : href;
  const isActive = activePrefix ? normalizedCurrent.startsWith(activePrefix) : normalizedCurrent === normalizedTarget || normalizedCurrent.startsWith(`${normalizedTarget}/`);

  // strip internal prop before spreading onto the router link
  const { activePrefix: _activePrefix, ...anchorProps } = props as ComponentPropsWithoutRef<"a"> & { activePrefix?: string };

  let linkClassName = className;
  if (isActive) {
    linkClassName = [className, `is-active`].filter(Boolean).join(` `).trim();
  }

  return <Link aria-current={isActive ? `page` : undefined} className={linkClassName} to={href as LinkProps["to"]} {...anchorProps} />;
}

function buildLoopSideNavigationItems(loopId: string) {
  return [
    {
      items: [
        ...loopTabs.map((tab) => {
          if (tab === `tasks`) {
            return {
              component: LoopSidebarLink,
              label: `Tasks`,
              href: `/loop/${loopId}/task/list`,
              // match all task sub-routes (/task/list, /task/:id)
              activePrefix: `/loop/${loopId}/task/`,
            };
          }

          return {
            component: LoopSidebarLink,
            label: loopTabLabels[tab] ?? capitalize(tab),
            href: `/loop/${loopId}/${tab}`,
          };
        }),
      ],
    },
  ];
}

function ShellLayout() {
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const isAuthenticationRoute = location.pathname.startsWith(authenticationPath);
  const { state: loopListState } = useLoopList({ enabled: !isAuthenticationRoute });
  const accountSideNavigationItems = useAccountSideNavigationItems();
  const activeLoopId = location.pathname.startsWith(`/loop/`) ? (location.pathname.split(`/`)[2] ?? ``) : ``;
  const loopOptions = loopListState.status === `success` ? loopListState.loops.map((loop) => ({ value: loop.id, label: loop.name })) : [];

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
          {activeLoopId ? (
            <div className="athena-side-navigation-shell__separator" aria-hidden="true">
              <hr />
            </div>
          ) : null}
          {activeLoopId ? (
            <>
              <div className="athena-side-navigation-shell__selector">
                <Select
                  className="athena-side-navigation-shell__loop-switcher"
                  disabled={loopListState.status !== `success`}
                  id="loop-switcher"
                  name="loop-switcher"
                  onChange={(event) => {
                    const nextLoopId = event.target.value;

                    if (!nextLoopId || nextLoopId === activeLoopId) {
                      return;
                    }

                    void navigate({ to: `/loop/$loopId/task/list`, params: { loopId: nextLoopId } });
                  }}
                  options={[{ value: ``, label: loopListState.status === `loading` ? `Loading loops...` : `Select a loop` }, ...loopOptions]}
                  value={activeLoopId}
                />
              </div>
              <SideNavigation dark={true} items={buildLoopSideNavigationItems(activeLoopId)} linkComponent={SideNavigationLink} />
            </>
          ) : null}
          <div className="athena-side-navigation-shell__account">
            <hr />
            <SideNavigation dark={true} hasIcons={true} items={accountSideNavigationItems} linkComponent={SideNavigationLink} />
          </div>
        </div>
      }
    >
      <div style={{ height: `100vh`, border: `0`, padding: `1rem`, margin: `0` }}>
        <Outlet />
      </div>
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

type LoopWorkgraphConfigTab = `jql` | `labels` | `item-type-playbooks` | `webhook-definitions` | `synced-items`;

function LoopTaskListRouteView() {
  const { loopId } = loopTaskListRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyTaskList loopId={loopId} />
    </Suspense>
  );
}

function LoopTaskDetailRouteView() {
  const { loopId, taskId } = loopTaskDetailRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyTaskDetails loopId={loopId} taskId={taskId} />
    </Suspense>
  );
}

function LoopDetailsRouteView() {
  const { loopId } = loopDetailsRoute.useParams();
  const { loop, onFeedback, reloadLoop } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopDetails loopId={loopId} loopName={loop.name} loopDescription={loop.description ?? ``} loopIterationCostLimitUsd={loop.iterationCostLimitUsd} onFeedback={onFeedback} onSaved={reloadLoop} />
    </Suspense>
  );
}

function LoopStepSequencesRouteView() {
  const { loopId } = loopStepSequencesRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopStepSequences loopId={loopId} onFeedback={onFeedback} />
    </Suspense>
  );
}

function LoopStepSequenceDetailRouteView() {
  const { loopId, stepSequenceId } = loopStepSequenceDetailRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopSteps loopId={loopId} onFeedback={onFeedback} stepSequenceId={stepSequenceId} />
    </Suspense>
  );
}

function LoopStepDefinitionsRouteView() {
  const { loopId } = loopStepDefinitionsRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopStepDefinitions loopId={loopId} onFeedback={onFeedback} />
    </Suspense>
  );
}

function LoopToolsRouteView() {
  const { loopId } = loopToolsRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopTools loopId={loopId} onFeedback={onFeedback} />
    </Suspense>
  );
}

function LoopMembersRouteView() {
  const { loopId } = loopMembersRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopMembers loopId={loopId} onFeedback={onFeedback} />
    </Suspense>
  );
}

function LoopPersonasRouteView() {
  const { loopId } = loopPersonasRoute.useParams();
  const { onFeedback, personaListState, reloadPersonaList } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopPersonas loopId={loopId} onFeedback={onFeedback} personaListState={personaListState} reloadPersonaList={reloadPersonaList} />
    </Suspense>
  );
}

function LoopPersonaCreateRouteView() {
  const { loopId } = loopPersonaCreateRoute.useParams();
  const { onFeedback, personaListState, reloadPersonaList } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopPersonas editor="create" loopId={loopId} onFeedback={onFeedback} personaListState={personaListState} reloadPersonaList={reloadPersonaList} />
    </Suspense>
  );
}

function LoopPersonaEditRouteView() {
  const { loopId, personaId } = loopPersonaEditRoute.useParams();
  const { onFeedback, personaListState, reloadPersonaList } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopPersonas editor="edit" loopId={loopId} onFeedback={onFeedback} personaId={personaId} personaListState={personaListState} reloadPersonaList={reloadPersonaList} />
    </Suspense>
  );
}

function LoopPersonaCloneRouteView() {
  const { loopId, personaId } = loopPersonaCloneRoute.useParams();
  const { onFeedback, personaListState, reloadPersonaList } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopPersonas editor="clone" loopId={loopId} onFeedback={onFeedback} personaId={personaId} personaListState={personaListState} reloadPersonaList={reloadPersonaList} />
    </Suspense>
  );
}

function LoopProvidersRouteView() {
  const { loopId } = loopProvidersRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopProviders loopId={loopId} onFeedback={onFeedback} />
    </Suspense>
  );
}

function LoopRunnersRouteView() {
  const { loopId } = loopRunnersRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopRunners loopId={loopId} onFeedback={onFeedback} />
    </Suspense>
  );
}

function LoopRunnerSessionsRouteView() {
  const { loopId, loopRunnerId } = loopRunnerSessionsRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopRunnerSessions loopId={loopId} runnerId={loopRunnerId} />
    </Suspense>
  );
}

function LoopRunnerRepositoriesRouteView() {
  const { loopId, loopRunnerId } = loopRunnerRepositoriesRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopRunnerRepositories loopId={loopId} runnerId={loopRunnerId} />
    </Suspense>
  );
}

function LoopWorkgraphsRouteView() {
  const { loopId } = loopWorkgraphsRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopWorkgraphs loopId={loopId} onFeedback={onFeedback} />
    </Suspense>
  );
}

function LoopWorkgraphViewRouteView() {
  const { loopId, workgraphViewWorkgraphId } = loopWorkgraphViewRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopWorkgraphs loopId={loopId} onFeedback={onFeedback} workgraphViewWorkgraphId={workgraphViewWorkgraphId} workgraphConfigTab="jql" />
    </Suspense>
  );
}

function LoopWorkgraphConfigRouteView() {
  const { loopId, workgraphViewWorkgraphId, workgraphConfigTab } = loopWorkgraphConfigRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopWorkgraphs loopId={loopId} onFeedback={onFeedback} workgraphViewWorkgraphId={workgraphViewWorkgraphId} workgraphConfigTab={workgraphConfigTab as LoopWorkgraphConfigTab} />
    </Suspense>
  );
}

function LoopRepositoriesRouteView() {
  const { loopId } = loopRepositoriesRoute.useParams();
  const { onFeedback } = useLoopLayoutContext();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopRepositories loopId={loopId} onFeedback={onFeedback} />
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
      <LazyProvider providerId={providerId} tab="details" />
    </Suspense>
  );
}

function ProviderSettingsView() {
  const { providerId } = providerSettingsRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyProvider providerId={providerId} tab="settings" />
    </Suspense>
  );
}

function LoopListRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopList />
    </Suspense>
  );
}

function LoopListCreateRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopList editor="create" />
    </Suspense>
  );
}

function LoopListEditRouteView() {
  const { loopEditorId } = loopListEditRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopList editor="edit" loopId={loopEditorId} />
    </Suspense>
  );
}

function PersonaListRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyPersonaList tab="my-personas" />
    </Suspense>
  );
}

function PersonaCatalogRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyPersonaList tab="catalog" />
    </Suspense>
  );
}

function PersonaListCreateRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyPersonaList editor="create" tab="my-personas" />
    </Suspense>
  );
}

function PersonaListEditRouteView() {
  const { personaId } = personaListEditRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyPersonaList editor="edit" personaId={personaId} tab="my-personas" />
    </Suspense>
  );
}

function PersonaListCloneRouteView() {
  const { personaId } = personaListCloneRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyPersonaList editor="clone" personaId={personaId} tab="my-personas" />
    </Suspense>
  );
}

function ProviderListRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyProviderList />
    </Suspense>
  );
}

function ProviderListCreateRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyProviderList editor="create" />
    </Suspense>
  );
}

function ProviderListEditRouteView() {
  const { providerEditorId } = providerListEditRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyProviderList editor="edit" providerId={providerEditorId} />
    </Suspense>
  );
}

function RunnerListRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyRunnerList />
    </Suspense>
  );
}

function RunnerListCreateRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyRunnerList editor="create" />
    </Suspense>
  );
}

function RunnerListEditRouteView() {
  const { runnerEditorId } = runnerListEditRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyRunnerList editor="edit" runnerId={runnerEditorId} />
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
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyConnections tab="workgraphs" />
    </Suspense>
  );
}

function ConnectionRepositoriesRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyConnections tab="repositories" />
    </Suspense>
  );
}

function ConnectionWorkgraphCreateRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyConnections create={true} tab="workgraphs" />
    </Suspense>
  );
}

function ConnectionWorkgraphEditRouteView() {
  const { workgraphId } = connectionWorkgraphEditRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyConnections edit={workgraphId} tab="workgraphs" />
    </Suspense>
  );
}

function ConnectionRepositoryCreateRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyConnections create={true} tab="repositories" />
    </Suspense>
  );
}

function ConnectionRepositoryEditRouteView() {
  const { repositoryId } = connectionRepositoryEditRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyConnections edit={repositoryId} tab="repositories" />
    </Suspense>
  );
}

function WorkgraphListRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyWorkgraphList />
    </Suspense>
  );
}

function WorkgraphListCreateRouteView() {
  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyWorkgraphList editor="create" />
    </Suspense>
  );
}

function WorkgraphListEditRouteView() {
  const { workgraphEditorId } = workgraphListEditRoute.useParams();

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyWorkgraphList editor="edit" workgraphId={workgraphEditorId} />
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
  const { loopId } = useParams({ strict: false }) as { loopId?: unknown };

  if (typeof loopId !== `string`) {
    return <RouteLoadingView />;
  }

  return (
    <Suspense fallback={<RouteLoadingView />}>
      <LazyLoopLayout loopId={loopId} />
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

const homeRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: rootPath,
  component: LoopListRouteView,
});

const loopListCreateRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: loopListCreateRoutePath,
  component: LoopListCreateRouteView,
});

const loopListEditRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: loopListEditRoutePath,
  component: LoopListEditRouteView,
});

const authenticationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: authenticationPath,
  validateSearch: (search: Record<string, unknown>) => ({
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

const loopDetailRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopDetailRoutePath,
  beforeLoad: ({ params }) => {
    throw redirect({ to: `/loop/$loopId/task/list`, params: { loopId: params.loopId } });
  },
  component: RouteLoadingView,
});

const loopTaskListRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopTaskListRoutePath,
  component: LoopTaskListRouteView,
});

const loopTaskDetailRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopTaskDetailRoutePath,
  component: LoopTaskDetailRouteView,
});

const loopDetailsRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopDetailsRoutePath,
  component: LoopDetailsRouteView,
});

const loopStepSequencesRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopStepSequencesRoutePath,
  component: LoopStepSequencesRouteView,
});

const loopStepSequenceDetailRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopStepSequenceDetailRoutePath,
  component: LoopStepSequenceDetailRouteView,
});

const loopStepDefinitionsRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopStepDefinitionsRoutePath,
  component: LoopStepDefinitionsRouteView,
});

const loopLegacyStepsRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopLegacyStepsRoutePath,
  beforeLoad: ({ params }) => {
    throw redirect({ to: `/loop/$loopId/step-sequences`, params: { loopId: params.loopId } });
  },
  component: RouteLoadingView,
});

const loopToolsRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopToolsRoutePath,
  component: LoopToolsRouteView,
});

const loopMembersRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopMembersRoutePath,
  component: LoopMembersRouteView,
});

const loopPersonasRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopPersonasRoutePath,
  component: LoopPersonasRouteView,
});

const loopPersonaCreateRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopPersonaCreateRoutePath,
  component: LoopPersonaCreateRouteView,
});

const loopPersonaEditRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopPersonaEditRoutePath,
  component: LoopPersonaEditRouteView,
});

const loopPersonaCloneRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopPersonaCloneRoutePath,
  component: LoopPersonaCloneRouteView,
});

const loopProvidersRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopProvidersRoutePath,
  component: LoopProvidersRouteView,
});

const loopRunnersRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopRunnersRoutePath,
  component: LoopRunnersRouteView,
});

const loopRunnerSessionsRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopRunnerSessionsRoutePath,
  component: LoopRunnerSessionsRouteView,
});

const loopRunnerRepositoriesRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopRunnerRepositoriesRoutePath,
  component: LoopRunnerRepositoriesRouteView,
});

const loopWorkgraphsRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopWorkgraphsRoutePath,
  component: LoopWorkgraphsRouteView,
});

const loopWorkgraphViewRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopWorkgraphViewRoutePath,
  component: LoopWorkgraphViewRouteView,
});

const loopWorkgraphConfigRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopWorkgraphConfigRoutePath,
  component: LoopWorkgraphConfigRouteView,
});

const loopRepositoriesRoute = createRoute({
  getParentRoute: () => loopLayoutRoute,
  path: loopRepositoriesRoutePath,
  component: LoopRepositoriesRouteView,
});

const connectionRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: connectionBasePath,
  beforeLoad: () => {
    throw redirect({ to: `/connection/workgraphs` });
  },
  component: ConnectionRouteView,
});

const connectionWorkgraphsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: `${connectionBasePath}/${connectionWorkgraphsRoutePath}`,
  component: ConnectionRouteView,
});

const connectionWorkgraphCreateRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: `${connectionBasePath}/${connectionWorkgraphCreateRoutePath}`,
  component: ConnectionWorkgraphCreateRouteView,
});

const connectionWorkgraphEditRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: `${connectionBasePath}/${connectionWorkgraphEditRoutePath}`,
  component: ConnectionWorkgraphEditRouteView,
});

const connectionRepositoriesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: `${connectionBasePath}/${connectionRepositoriesRoutePath}`,
  component: ConnectionRepositoriesRouteView,
});

const connectionRepositoryCreateRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: `${connectionBasePath}/${connectionRepositoryCreateRoutePath}`,
  component: ConnectionRepositoryCreateRouteView,
});

const connectionRepositoryEditRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: `${connectionBasePath}/${connectionRepositoryEditRoutePath}`,
  component: ConnectionRepositoryEditRouteView,
});

const personaLayoutRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: personaBasePath,
  component: PersonaLayoutRouteView,
});

const personaRoute = createRoute({
  getParentRoute: () => personaLayoutRoute,
  path: personaListRoutePath,
  component: PersonaListRouteView,
});

const personaCatalogRoute = createRoute({
  getParentRoute: () => personaLayoutRoute,
  path: `${personaListRoutePath}/catalog`,
  component: PersonaCatalogRouteView,
});

const personaListCreateRoute = createRoute({
  getParentRoute: () => personaLayoutRoute,
  path: `${personaListRoutePath}/create`,
  component: PersonaListCreateRouteView,
});

const personaListEditRoute = createRoute({
  getParentRoute: () => personaLayoutRoute,
  path: `${personaListRoutePath}/edit/$personaId`,
  component: PersonaListEditRouteView,
});

const personaListCloneRoute = createRoute({
  getParentRoute: () => personaLayoutRoute,
  path: `${personaListRoutePath}/clone/$personaId`,
  component: PersonaListCloneRouteView,
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
  component: ProviderListRouteView,
});

const providerListCreateRoute = createRoute({
  getParentRoute: () => providerLayoutRoute,
  path: providerListCreateRoutePath,
  component: ProviderListCreateRouteView,
});

const providerListEditRoute = createRoute({
  getParentRoute: () => providerLayoutRoute,
  path: providerListEditRoutePath,
  component: ProviderListEditRouteView,
});

const providerDetailRoute = createRoute({
  getParentRoute: () => providerLayoutRoute,
  path: providerDetailRoutePath,
  component: ProviderDetailView,
});

const providerSettingsRoute = createRoute({
  getParentRoute: () => providerLayoutRoute,
  path: providerSettingsRoutePath,
  component: ProviderSettingsView,
});

const runnerLayoutRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: runnerBasePath,
  component: RunnerLayoutRouteView,
});

const runnerRoute = createRoute({
  getParentRoute: () => runnerLayoutRoute,
  path: runnerListRoutePath,
  component: RunnerListRouteView,
});

const runnerListCreateRoute = createRoute({
  getParentRoute: () => runnerLayoutRoute,
  path: runnerListCreateRoutePath,
  component: RunnerListCreateRouteView,
});

const runnerListEditRoute = createRoute({
  getParentRoute: () => runnerLayoutRoute,
  path: runnerListEditRoutePath,
  component: RunnerListEditRouteView,
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
  component: WorkgraphListRouteView,
});

const workgraphListCreateRoute = createRoute({
  getParentRoute: () => workgraphLayoutRoute,
  path: workgraphListCreateRoutePath,
  component: WorkgraphListCreateRouteView,
});

const workgraphListEditRoute = createRoute({
  getParentRoute: () => workgraphLayoutRoute,
  path: workgraphListEditRoutePath,
  component: WorkgraphListEditRouteView,
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
    homeRoute,
    loopListCreateRoute,
    loopListEditRoute,
    connectionRoute,
    connectionWorkgraphsRoute,
    connectionWorkgraphCreateRoute,
    connectionWorkgraphEditRoute,
    connectionRepositoriesRoute,
    connectionRepositoryCreateRoute,
    connectionRepositoryEditRoute,
    loopLayoutRoute.addChildren([
      loopDetailRoute,
      loopTaskListRoute,
      loopTaskDetailRoute,
      loopDetailsRoute,
      loopStepSequencesRoute,
      loopStepSequenceDetailRoute,
      loopStepDefinitionsRoute,
      loopLegacyStepsRoute,
      loopToolsRoute,
      loopMembersRoute,
      loopPersonasRoute,
      loopPersonaCreateRoute,
      loopPersonaEditRoute,
      loopPersonaCloneRoute,
      loopProvidersRoute,
      loopRunnersRoute,
      loopRunnerSessionsRoute,
      loopRunnerRepositoriesRoute,
      loopWorkgraphsRoute,
      loopWorkgraphViewRoute,
      loopWorkgraphConfigRoute,
      loopRepositoriesRoute,
    ]),
    personaLayoutRoute.addChildren([personaRoute, personaCatalogRoute, personaListCreateRoute, personaListEditRoute, personaListCloneRoute, personaDetailRoute]),
    providerLayoutRoute.addChildren([providerRoute, providerListCreateRoute, providerListEditRoute, providerDetailRoute, providerSettingsRoute]),
    runnerLayoutRoute.addChildren([runnerRoute, runnerListCreateRoute, runnerListEditRoute, runnerDetailRoute]),
    workgraphLayoutRoute.addChildren([workgraphRoute, workgraphListCreateRoute, workgraphListEditRoute, workgraphDetailRoute]),
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
