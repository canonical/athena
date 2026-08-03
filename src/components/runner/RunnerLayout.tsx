import { Outlet } from "@tanstack/react-router";

export function RunnerLayout() {
  return (
    <div className="u-no-max-width">
      <Outlet />
    </div>
  );
}
