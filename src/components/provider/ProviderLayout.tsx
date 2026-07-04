import { Outlet } from "@tanstack/react-router";

export function ProviderLayout() {
  return (
    <div className="u-no-max-width">
      <Outlet />
    </div>
  );
}
