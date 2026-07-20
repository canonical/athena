import { fetchHarnessById } from "@components/harness/harness.client.js";
import { fetchLoop } from "@components/loop/loop.client.js";
import { fetchPersonaById } from "@components/persona/persona.client.js";
import { fetchProviderById } from "@components/provider/provider.client.js";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

type BreadcrumbItem = {
  label: string;
  to?: string;
};

type RouteBreadcrumbsProps = {
  items?: BreadcrumbItem[];
};

const entityLabels: Record<string, { list: string; detail: string }> = {
  authentication: { list: `Authentication`, detail: `Authentication` },
  event: { list: `Events`, detail: `Event` },
  harness: { list: `Harnesses`, detail: `Harness` },
  loop: { list: `Loops`, detail: `Loop` },
  persona: { list: `Personas`, detail: `Persona` },
  provider: { list: `Providers`, detail: `Provider` },
};

const detailLabelResolvers: Partial<Record<string, (id: string) => Promise<string>>> = {
  harness: async (id) => (await fetchHarnessById(id)).displayName,
  loop: async (id) => (await fetchLoop(id)).name,
  persona: async (id) => (await fetchPersonaById(id)).displayName,
  provider: async (id) => (await fetchProviderById(id)).displayName,
};

const defaultLabel = (segment: string): string => {
  if (segment.length === 0) {
    return `Overview`;
  }

  const clean = segment.replace(/[-_]/g, ` `);

  return `${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
};

const buildBreadcrumbsFromPath = (pathname: string, detailLabelOverride?: string): BreadcrumbItem[] => {
  const segments = pathname.split(`/`).filter(Boolean);

  if (segments.length === 0) {
    return [{ label: `Overview` }];
  }

  const first = segments[0];
  const second = segments[1];
  const labels = entityLabels[first];

  if (!labels) {
    return [{ label: defaultLabel(first) }];
  }

  if (first === `authentication`) {
    if (second === `sign-out`) {
      return [{ label: labels.list, to: `/authentication` }, { label: `Sign out` }];
    }

    return [{ label: labels.list }];
  }

  if (!second || second === `list`) {
    return [{ label: labels.list }];
  }

  return [{ label: labels.list, to: `/${first}/list` }, { label: detailLabelOverride ?? labels.detail }];
};

export function RouteBreadcrumbs({ items }: RouteBreadcrumbsProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [detailLabelOverride, setDetailLabelOverride] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (items) {
      setDetailLabelOverride(undefined);
      return;
    }

    const segments = pathname.split(`/`).filter(Boolean);
    const first = segments[0];
    const second = segments[1];

    if (!first || !second || second === `list`) {
      setDetailLabelOverride(undefined);
      return;
    }

    const resolveLabel = detailLabelResolvers[first];

    if (!resolveLabel) {
      setDetailLabelOverride(undefined);
      return;
    }

    let active = true;

    void resolveLabel(second)
      .then((label) => {
        if (active) {
          setDetailLabelOverride(label);
        }
      })
      .catch(() => {
        if (active) {
          setDetailLabelOverride(undefined);
        }
      });

    return () => {
      active = false;
    };
  }, [items, pathname]);

  const resolvedItems = useMemo(() => items ?? buildBreadcrumbsFromPath(pathname, detailLabelOverride), [detailLabelOverride, items, pathname]);

  return (
    <nav aria-label="Breadcrumb" className="p-breadcrumbs">
      <ol className="p-breadcrumbs__items">
        {resolvedItems.map((item, index) => {
          const isLast = index === resolvedItems.length - 1;

          return (
            <li className="p-breadcrumbs__item" key={`${item.to ?? `current`}-${item.label}`}>
              {item.to && !isLast ? <Link to={item.to}>{item.label}</Link> : <span aria-current={isLast ? "page" : undefined}>{item.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
