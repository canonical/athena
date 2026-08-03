import { Outlet } from "@tanstack/react-router";

export function WorkgraphLayout() {
  return (
    <div className="u-no-max-width">
      <Outlet />
    </div>
  );
}
