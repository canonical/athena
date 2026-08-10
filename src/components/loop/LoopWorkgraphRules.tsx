import { Button, Notification, NotificationSeverity } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import type { LoopWorkgraphIssueTypeState } from "@components/workgraph/workgraph.query.js";
import type { LoopWorkgraph } from "@components/workgraph/workgraph.schema.js";
import type { FormikProps } from "formik";

type WorkgraphRulesFormValues = {
  jql: string;
  typeInstructions: Record<string, string>;
};

type LoopWorkgraphRulesProps = {
  isOpen: boolean;
  editingWorkgraph?: LoopWorkgraph;
  formik: FormikProps<WorkgraphRulesFormValues>;
  issueTypeState: LoopWorkgraphIssueTypeState;
  onTypeInstructionChange: (issueTypeId: string, instruction: string) => void;
  onCancel: () => void;
};

const formatHierarchyLevel = (value: number | null | undefined): string => {
  if (typeof value !== `number` || !Number.isFinite(value)) {
    return `Level unknown`;
  }

  return `Level ${value}`;
};

export function LoopWorkgraphRules({ isOpen, editingWorkgraph, formik, issueTypeState, onTypeInstructionChange, onCancel }: LoopWorkgraphRulesProps) {
  return (
    <EntityDrawer isOpen={isOpen} onClose={onCancel} size="xl" title={editingWorkgraph ? `Workgraph rules: ${editingWorkgraph.name}` : `Workgraph rules`}>
      {!editingWorkgraph ? <p className="p-text--default">Select an assigned workgraph and click Edit workgraph rules to configure ingestion.</p> : null}
      {editingWorkgraph ? (
        <form onSubmit={formik.handleSubmit}>
          <label htmlFor="workgraph-jql-input">JQL</label>
          <textarea id="workgraph-jql-input" name="jql" onChange={formik.handleChange} placeholder="project = PRTL AND statusCategory != Done ORDER BY priority DESC" rows={5} value={formik.values.jql} />
          <p className="p-text--small">Provide a Jira query directly. Use JQL clauses for status, label, item type, or any other filter.</p>

          <h3 className="p-heading--5">Instructions per ticket type</h3>
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
                      onTypeInstructionChange(issueType.id, event.target.value);
                    }}
                    placeholder={`What should Athena do with ${issueType.name} tickets?`}
                    rows={3}
                    value={formik.values.typeInstructions[issueType.id] ?? ``}
                  />
                </div>
              ))
            : null}

          <div className="u-align--right">
            <Button appearance="base" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
              {formik.isSubmitting ? `Saving...` : `Save JQL rules`}
            </Button>
          </div>
        </form>
      ) : null}
    </EntityDrawer>
  );
}
