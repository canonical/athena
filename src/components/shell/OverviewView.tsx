import { Notification, NotificationSeverity } from "@canonical/react-components";

export function OverviewView() {
  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">Hello from Athena</h1>
      <p className="p-text--default">Athena is live. This is the first React homepage, wired with Canonical React Components and a sidebar application layout.</p>
      <Notification severity={NotificationSeverity.INFORMATION} title="Status">
        Frontend shell is active.
      </Notification>
    </section>
  );
}
