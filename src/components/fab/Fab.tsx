import { Button } from "@canonical/react-components";
import type { ReactNode } from "react";

type FabProps = {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  position?: "bottomRight" | "topRight";
};

export function Fab({ title, onClick, disabled = false, icon, position = "bottomRight" }: FabProps) {
  const placementStyle =
    position === "topRight"
      ? {
          top: "1rem",
          right: "1rem",
        }
      : {
          bottom: "1rem",
          right: "1rem",
        };

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 10,
        ...placementStyle,
      }}
    >
      <Button
        aria-label={title}
        appearance="positive"
        disabled={disabled}
        onClick={onClick}
        style={{
          margin: 0,
          width: "3rem",
          height: "3rem",
          minWidth: "3rem",
          minHeight: "3rem",
          borderRadius: "9999px",
          padding: 0,
        }}
        title={title}
        type="button"
      >
        <span
          style={{
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
          }}
        >
          {icon ?? (
            <span aria-hidden="true" style={{ fontSize: "1.5rem", lineHeight: 1 }}>
              +
            </span>
          )}
        </span>
      </Button>
    </div>
  );
}
