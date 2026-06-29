import { Outlet } from "@tanstack/react-router";

export function LoopLayout() {
  return (
    <section className="athena-home">
      <p className="p-heading--5">Loops</p>
      <Outlet />
    </section>
  );
}
