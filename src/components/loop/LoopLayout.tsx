import type { ReactNode } from "react";

type LoopLayoutProps = {
  loopName?: string;
  children: ReactNode;
};

export function LoopLayout({ loopName, children }: LoopLayoutProps) {
  return (
    <section className="athena-home">
      <p className="p-heading--5">Loops</p>
      {loopName ? <h1 className="p-heading--2">{loopName}</h1> : null}
      {children}
    </section>
  );
}
