import { Button, CodeSnippet, Icon, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { createLoopWorkgraphWebhook, deleteLoopWorkgraphWebhook, updateLoopWorkgraphWebhook, webhookApiPaths } from "@components/webhook/webhook.client.js";
import { useLoopWorkgraphWebhooks } from "@components/webhook/webhook.query.js";
import { useFormik } from "formik";
import { useMemo, useState } from "react";

type WebhookDefinitionsProps = {
  loopId: string;
  workgraphId: string;
  onFeedback: (feedback: { severity: (typeof NotificationSeverity)[keyof typeof NotificationSeverity]; title: string; message: string } | null) => void;
};

export function WebhookDefinitions({ loopId, workgraphId, onFeedback }: WebhookDefinitionsProps) {
  const { state: webhookListState, reload } = useLoopWorkgraphWebhooks(loopId, workgraphId);
  const [busyWebhookId, setBusyWebhookId] = useState<string | null>(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [createdWebhookDetails, setCreatedWebhookDetails] = useState<{ endpointUrl: string; headerName: string; secret: string } | null>(null);

  const createWebhookFormik = useFormik<{ label: string; authHeaderName: string }>({
    initialValues: {
      label: `Jira webhook`,
      authHeaderName: `X-Athena-Webhook-Key`,
    },
    onSubmit: async (values, helpers) => {
      onFeedback(null);

      try {
        const created = await createLoopWorkgraphWebhook(loopId, workgraphId, {
          label: values.label.trim(),
          authHeaderName: values.authHeaderName.trim(),
        });

        setCreatedWebhookDetails({
          endpointUrl: webhookApiPaths.inboundWebhookByReceiver(created.receiverId),
          headerName: created.authHeaderName,
          secret: created.secret,
        });

        helpers.resetForm();
        setIsCreateDrawerOpen(false);
        reload();
        onFeedback({
          severity: NotificationSeverity.INFORMATION,
          title: `Webhook created`,
          message: `Webhook created successfully. Save the secret now; it is shown only once.`,
        });
      } catch (error) {
        onFeedback({
          severity: NotificationSeverity.NEGATIVE,
          title: `Webhook creation failed`,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });

  const rows = useMemo(() => {
    if (webhookListState.status !== `success`) {
      return [];
    }

    return webhookListState.webhooks.map((webhook) => ({
      key: webhook.id,
      columns: [
        { content: webhook.label },
        { content: webhook.authHeaderName },
        { content: webhookApiPaths.inboundWebhookByReceiver(webhook.receiverId) },
        { content: webhook.active ? `Active` : `Disabled` },
        {
          content: (
            <div className="u-align--right">
              <Button
                appearance="base"
                disabled={busyWebhookId === webhook.id}
                onClick={() => {
                  setBusyWebhookId(webhook.id);
                  onFeedback(null);
                  void updateLoopWorkgraphWebhook(loopId, workgraphId, webhook.id, { active: !webhook.active })
                    .then(() => {
                      reload();
                      onFeedback({
                        severity: NotificationSeverity.INFORMATION,
                        title: `Webhook updated`,
                        message: `${webhook.label} is now ${webhook.active ? `disabled` : `active`}.`,
                      });
                    })
                    .catch((error) => {
                      onFeedback({
                        severity: NotificationSeverity.NEGATIVE,
                        title: `Webhook update failed`,
                        message: error instanceof Error ? error.message : String(error),
                      });
                    })
                    .finally(() => {
                      setBusyWebhookId(null);
                    });
                }}
                type="button"
              >
                {webhook.active ? `Disable` : `Enable`}
              </Button>
              <Button
                appearance="base"
                aria-label={`Delete ${webhook.label}`}
                disabled={busyWebhookId === webhook.id}
                onClick={() => {
                  setBusyWebhookId(webhook.id);
                  onFeedback(null);
                  void deleteLoopWorkgraphWebhook(loopId, workgraphId, webhook.id)
                    .then(() => {
                      reload();
                      onFeedback({
                        severity: NotificationSeverity.INFORMATION,
                        title: `Webhook deleted`,
                        message: `${webhook.label} has been deleted.`,
                      });
                    })
                    .catch((error) => {
                      onFeedback({
                        severity: NotificationSeverity.NEGATIVE,
                        title: `Webhook deletion failed`,
                        message: error instanceof Error ? error.message : String(error),
                      });
                    })
                    .finally(() => {
                      setBusyWebhookId(null);
                    });
                }}
                title={`Delete ${webhook.label}`}
                type="button"
              >
                <Icon aria-hidden="true" className="text-negative" name="delete" />
              </Button>
            </div>
          ),
        },
      ],
    }));
  }, [busyWebhookId, loopId, onFeedback, reload, webhookListState, workgraphId]);

  return (
    <>
      <div>
        <div className="u-clearfix">
          <div className="u-float-right">
            <Button appearance="positive" onClick={() => setIsCreateDrawerOpen(true)} type="button">
              Create webhook
            </Button>
          </div>
        </div>
        <hr />

        {webhookListState.status === `loading` ? <p className="p-text--default">Loading webhooks...</p> : null}
        {webhookListState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load webhooks">
            {webhookListState.message}
          </Notification>
        ) : null}
        {webhookListState.status === `success` && webhookListState.webhooks.length === 0 ? <p className="p-text--default">No webhooks configured yet.</p> : null}
        {webhookListState.status === `success` && webhookListState.webhooks.length > 0 ? (
          <MainTable className="u-table-layout--auto" headers={[{ content: `Label` }, { content: `Auth header` }, { content: `Endpoint URL` }, { content: `Status` }, { content: `Actions`, className: `u-align--right` }]} rows={rows} />
        ) : null}
      </div>

      <EntityDrawer isOpen={isCreateDrawerOpen} onClose={() => setIsCreateDrawerOpen(false)} title="Create webhook">
        <form onSubmit={createWebhookFormik.handleSubmit}>
          <label htmlFor="workgraph-webhook-label">Label</label>
          <input id="workgraph-webhook-label" name="label" onChange={createWebhookFormik.handleChange} required type="text" value={createWebhookFormik.values.label} />
          <label htmlFor="workgraph-webhook-auth-header">Authentication header</label>
          <input id="workgraph-webhook-auth-header" name="authHeaderName" onChange={createWebhookFormik.handleChange} required type="text" value={createWebhookFormik.values.authHeaderName} />
          <div className="u-align--right">
            <Button appearance="base" onClick={() => setIsCreateDrawerOpen(false)} type="button">
              Cancel
            </Button>
            <Button appearance="positive" disabled={createWebhookFormik.isSubmitting} type="submit">
              {createWebhookFormik.isSubmitting ? (
                `Creating...`
              ) : (
                <>
                  <Icon aria-hidden="true" light name="success" /> Save
                </>
              )}
            </Button>
          </div>
        </form>
      </EntityDrawer>

      {createdWebhookDetails ? (
        <div className="p-card p-strip is-shallow">
          <Notification severity={NotificationSeverity.INFORMATION} title="Store this secret now">
            The secret is shown only once.
          </Notification>
          <p className="p-text--small">Endpoint URL</p>
          <CodeSnippet blocks={[{ code: createdWebhookDetails.endpointUrl, wrapLines: true }]} />
          <p className="p-text--small">Header name</p>
          <CodeSnippet blocks={[{ code: createdWebhookDetails.headerName, wrapLines: true }]} />
          <p className="p-text--small">Header value (secret)</p>
          <CodeSnippet blocks={[{ code: createdWebhookDetails.secret, wrapLines: true }]} />
        </div>
      ) : null}

      <div className="p-card p-strip is-shallow">
        <h3 className="p-heading--4">Jira webhook setup</h3>
        <ol>
          <li>Create or choose an active webhook definition above for this workgraph.</li>
          <li>In Jira, go to Project settings, then Automation, and create a new rule.</li>
          <li>
            Choose trigger <strong>Multiple work item events</strong>, then select: <strong>Work item created</strong>, <strong>Work item updated</strong>, <strong>Work item assigned</strong>, <strong>Work item transitioned</strong>,{" "}
            <strong>Work item moved</strong>, and <strong>Work item deleted</strong>.
          </li>
          <li>Add a JQL filter condition in the rule and use the same JQL configured in this workgraph to reduce unnecessary webhook traffic.</li>
          <li>Add the Send web request action.</li>
          <li>Use the Endpoint URL from Athena as the request URL and set method to POST.</li>
          <li>Add one header where name is Auth header from Athena and value is the secret shown at creation time.</li>
          <li>
            Set Web request body to <strong>Issue data (Jira format)</strong>.
          </li>
          <li>Publish and test the rule in Jira, then use Synced Items in Athena to verify ingestion.</li>
        </ol>
        <p className="p-text--small">Tip: if the secret was not saved when created, delete that webhook and create a new one to generate a new secret.</p>
      </div>
    </>
  );
}
