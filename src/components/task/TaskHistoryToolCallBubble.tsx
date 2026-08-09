import { Icon } from "@canonical/react-components";

type TaskHistoryToolCallBubbleProps = {
  label: string;
  onShowDetails: () => void;
};

export function TaskHistoryToolCallBubble({ label, onShowDetails }: TaskHistoryToolCallBubbleProps) {
  return (
    <div
      style={{
        background: `rgba(0,0,0,0.12)`,
        borderRadius: "0.5rem",
        padding: "0.4rem 0.6rem",
        fontSize: "0.75rem",
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <button
          aria-label="Show tool call details"
          onClick={onShowDetails}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.4rem",
            height: "1.4rem",
            borderRadius: "0.25rem",
            background: "rgba(255,255,255,0.18)",
          }}
          title="Show tool call details"
          type="button"
        >
          <Icon aria-hidden="true" name="show" />
        </button>
      </div>
    </div>
  );
}
