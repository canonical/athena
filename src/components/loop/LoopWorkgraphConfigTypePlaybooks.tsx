import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import type { LoopWorkgraphIssueTypeState } from "@components/workgraph/workgraph.query.js";
import type { FormikProps } from "formik";

type LoopWorkgraphConfigTypePlaybooksProps = {
  formik: FormikProps<{ jql: string; workOnLabel: string; workInProgressLabel: string; workDoneLabel: string; typeInstructions: Record<string, string> }>;
  issueTypeState: LoopWorkgraphIssueTypeState;
};

const formatHierarchyLevel = (value: number | null | undefined): string => {
  if (typeof value !== `number` || !Number.isFinite(value)) {
    return `Level unknown`;
  }

  return `Level ${value}`;
};

export function LoopWorkgraphConfigTypePlaybooks({ formik, issueTypeState }: LoopWorkgraphConfigTypePlaybooksProps) {
  return (
    <div className="p-card p-strip is-shallow">
      <form onSubmit={formik.handleSubmit}>
        {issueTypeState.status === `loading` ? <p className="p-text--small">Loading Jira ticket types...</p> : null}
        {issueTypeState.status === `error` ? (
          <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load Jira ticket types">
            {issueTypeState.message}
          </Notification>
        ) : null}
        {issueTypeState.status === `success` && issueTypeState.issueTypes.length === 0 ? <p className="p-text--small">No ticket types found for this workgraph.</p> : null}
        {issueTypeState.status === `success`
          ? issueTypeState.issueTypes.map((issueType) => (
              <div key={issueType.id}>
                <label htmlFor={`workgraph-type-instruction-${issueType.id}`}>{`${issueType.name} (${formatHierarchyLevel(issueType.hierarchyLevel)})`}</label>
                <textarea
                  id={`workgraph-type-instruction-${issueType.id}`}
                  name={`typeInstructions.${issueType.id}`}
                  onChange={(event) => {
                    formik.setFieldValue(`typeInstructions`, {
                      ...formik.values.typeInstructions,
                      [issueType.id]: event.target.value,
                    });
                  }}
                  placeholder={`What should Athena do with ${issueType.name} tickets?`}
                  rows={6}
                  value={formik.values.typeInstructions[issueType.id] ?? ``}
                />
              </div>
            ))
          : null}

        <div className="u-align--right">
          <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
            {formik.isSubmitting ? `Saving...` : `Save Item Type Playbooks`}
          </Button>
        </div>
      </form>
    </div>
  );
}
