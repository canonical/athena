import { Outlet } from "@tanstack/react-router";

export function LoopLayout() {
  return (
    <div className="u-no-max-width">
      <Outlet />
    </div>
  );
}
