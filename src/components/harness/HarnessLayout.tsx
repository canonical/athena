import { Outlet } from "@tanstack/react-router";

export function HarnessLayout() {
  return (
    <div className="u-no-max-width">
      <Outlet />
    </div>
  );
}
