import { Outlet } from "@tanstack/react-router";

export function EventLayout() {
  return (
    <div className="u-no-max-width">
      <Outlet />
    </div>
  );
}
