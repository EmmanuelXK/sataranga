import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({ component: About });

function About() {
  return (
    <main className="legal">
      <p className="yd-kicker">SATARANGA</p>
      <h1>About</h1>
      <p>Chess pieces are original SATARANGA artwork by WOW LIFESTYLES.</p>
      <p>
        <Link to="/">Back to SATARANGA</Link>
      </p>
    </main>
  );
}
