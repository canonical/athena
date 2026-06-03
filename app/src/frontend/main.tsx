import { ApplicationLayout, Chip, Notification, NotificationSeverity, type SideNavigationProps } from "@canonical/react-components";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/app.scss";

const navItems: SideNavigationProps["items"] = [
  {
    className: "athena-nav-primary",
    items: [
      {
        icon: "status-online",
        label: "Overview",
        href: "/",
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

function App() {
  return (
    <ApplicationLayout
      dark={true}
      logo={{
        href: "/",
        icon: "/favicon.png",
        iconAlt: "Athena",
        name: "/athena-logo.svg",
        nameAlt: "Athena",
      }}
      mainId="main-content"
      navItems={navItems}
      status={<Chip appearance="information" isReadOnly value="beta" />}
    >
      <section className="athena-home" id="main-content">
        <p className="p-heading--5">Athena</p>
        <h1 className="p-heading--2">Hello from Athena</h1>
        <p className="p-text--default">Athena is live. This is the first React homepage, wired with Canonical React Components and a sidebar application layout.</p>
        <div className="athena-callout">
          <Notification severity={NotificationSeverity.INFORMATION} title="Status">
            Frontend shell is active. API health is available at
            <a href="/_status/check"> /_status/check</a>.
          </Notification>
        </div>
      </section>
    </ApplicationLayout>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
