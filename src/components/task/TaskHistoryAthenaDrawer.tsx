import { EntityDrawer } from "@components/base/EntityDrawer.js";

type TaskHistoryAthenaDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function TaskHistoryAthenaDrawer({ isOpen, onClose }: TaskHistoryAthenaDrawerProps) {
  return (
    <EntityDrawer isOpen={isOpen} onClose={onClose} title="Athena">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <p className="p-text--small" style={{ margin: 0 }}>
          Athena is the system itself: a high-performance orchestration platform that coordinates planning, execution, tools, data, and feedback loops with strong operational discipline.
        </p>
        <p className="p-text--small" style={{ margin: 0 }}>
          It excels at turning ambiguous goals into concrete task flows, preserving context over long-running threads, invoking the right tools at the right time, and producing precise, auditable outcomes.
        </p>
      </div>
    </EntityDrawer>
  );
}
