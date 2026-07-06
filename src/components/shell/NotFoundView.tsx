import { Link } from "@tanstack/react-router";

export function NotFoundView() {
  return (
    <section className="p-strip is-shallow u-no-max-width">
      <h1 className="p-heading--2">Page not found</h1>
      <p className="p-text--default">The requested route does not exist.</p>
      <Link to="/">Go back to overview</Link>
    </section>
  );
}
