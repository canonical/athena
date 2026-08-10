import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { fetchLoopTools, updateLoopTools } from "@components/loop/loop.client.js";
import type { LoopToolsProps } from "@components/loop/loop.schema.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function LoopTools({ loopId, onFeedback }: LoopToolsProps) {
  const queryClient = useQueryClient();
  const [busyToolName, setBusyToolName] = useState<string | null>(null);

  const { isPending, isError, data, error } = useQuery({
    queryKey: [`loopTools`, loopId],
    queryFn: () => fetchLoopTools(loopId),
  });

  const handleToggleTool = async (toolName: string) => {
    if (!data) {
      return;
    }

    const currentTool = data.tools.find((tool) => tool.name === toolName);

    if (!currentTool) {
      return;
    }

    setBusyToolName(toolName);
    onFeedback(null);

    const enabledToolNames = data.tools.filter((tool) => tool.enabled).map((tool) => tool.name);
    const nextEnabledToolNames = currentTool.enabled ? enabledToolNames.filter((name) => name !== toolName) : [...enabledToolNames, toolName];

    try {
      await updateLoopTools(loopId, { enabledToolNames: nextEnabledToolNames });
      await queryClient.invalidateQueries({ queryKey: [`loopTools`, loopId] });
      onFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Tool settings updated`,
        message: `${toolName} has been ${currentTool.enabled ? `disabled` : `enabled`} for this loop.`,
      });
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : String(updateError);
      onFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to update tool settings`,
        message,
      });
    } finally {
      setBusyToolName(null);
    }
  };

  return (
    <>
      <div className="u-clearfix">
        <div className="u-float-left">
          <h2 className="p-heading--4">Tools</h2>
        </div>
      </div>
      <hr />

      {isPending ? <p className="p-text--default">Loading tools...</p> : null}

      {isError ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load tools">
          {error instanceof Error ? error.message : String(error)}
        </Notification>
      ) : null}

      {!isPending && !isError && data && data.tools.length === 0 ? <p className="p-text--default">No provider tools are registered.</p> : null}

      {!isPending && !isError && data && data.tools.length > 0 ? (
        <MainTable
          className="u-table-layout--auto"
          headers={[{ content: `Tool` }, { content: `Description` }, { content: `Enabled` }, { content: `Requires approval` }, { content: `Actions`, className: `u-align--right` }]}
          rows={data.tools.map((tool) => ({
            key: tool.name,
            columns: [
              { content: tool.name },
              { content: tool.description },
              { content: tool.enabled ? `Yes` : `No` },
              { content: tool.requiresApproval ? `Yes` : `No` },
              {
                content: (
                  <div className="u-align--right">
                    <Button appearance={tool.enabled ? `negative` : `positive`} disabled={busyToolName === tool.name} onClick={() => handleToggleTool(tool.name)} type="button">
                      {busyToolName === tool.name ? `Saving...` : tool.enabled ? `Disable` : `Enable`}
                    </Button>
                  </div>
                ),
              },
            ],
          }))}
        />
      ) : null}
    </>
  );
}
