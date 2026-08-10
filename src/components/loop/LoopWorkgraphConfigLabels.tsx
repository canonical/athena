import { Button, Icon } from "@canonical/react-components";
import { defaultWorkDoneLabel, defaultWorkInProgressLabel, defaultWorkOnLabel } from "@components/workgraph/workgraph.assignment-config.js";
import type { FormikProps } from "formik";

type LoopWorkgraphConfigLabelsProps = {
  formik: FormikProps<{ jql: string; workOnLabel: string; workInProgressLabel: string; workDoneLabel: string; typeInstructions: Record<string, string> }>;
};

export function LoopWorkgraphConfigLabels({ formik }: LoopWorkgraphConfigLabelsProps) {
  return (
    <form onSubmit={formik.handleSubmit}>
      <label htmlFor="workgraph-work-on-label">Work on label</label>
      <input id="workgraph-work-on-label" name="workOnLabel" onChange={formik.handleChange} placeholder={defaultWorkOnLabel} required type="text" value={formik.values.workOnLabel} />
      <p className="p-text--small">If this Jira label is present on a ticket, Athena can start working on it.</p>

      <label htmlFor="workgraph-work-done-label">Work done label</label>
      <input id="workgraph-work-done-label" name="workDoneLabel" onChange={formik.handleChange} placeholder={defaultWorkDoneLabel} required type="text" value={formik.values.workDoneLabel} />
      <p className="p-text--small">Athena adds this label when work is completed. If this label is already present, Athena skips the ticket even when the work-on label is present.</p>

      <label htmlFor="workgraph-work-in-progress-label">Work in progress label</label>
      <input id="workgraph-work-in-progress-label" name="workInProgressLabel" onChange={formik.handleChange} placeholder={defaultWorkInProgressLabel} required type="text" value={formik.values.workInProgressLabel} />
      <p className="p-text--small">Athena adds this label when it starts working on a ticket.</p>

      <div className="u-align--right">
        <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
          {formik.isSubmitting ? (
            `Saving...`
          ) : (
            <>
              <Icon aria-hidden="true" light name="success" /> Save
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
