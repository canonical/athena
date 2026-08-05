import { Button } from "@canonical/react-components";
import type { FormikProps } from "formik";

type LoopWorkgraphConfigJqlProps = {
  formik: FormikProps<{ jql: string; workOnLabel: string; workInProgressLabel: string; workDoneLabel: string; typeInstructions: Record<string, string> }>;
};

export function LoopWorkgraphConfigJql({ formik }: LoopWorkgraphConfigJqlProps) {
  return (
    <div className="p-card p-strip is-shallow">
      <form onSubmit={formik.handleSubmit}>
        <textarea
          id="workgraph-jql-input"
          name="jql"
          onChange={formik.handleChange}
          placeholder="project = PRTL AND statusCategory != Done ORDER BY priority DESC"
          rows={5}
          value={formik.values.jql}
        />
        <p className="p-text--small">Provide a Jira query directly. Use JQL clauses for status, label, item type, or any other filter.</p>
        <div className="u-align--right">
          <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
            {formik.isSubmitting ? `Saving...` : `Save JQL`}
          </Button>
        </div>
      </form>
    </div>
  );
}
