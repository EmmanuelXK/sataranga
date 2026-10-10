import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
  return (
    <main className="legal">
      <p className="yd-kicker">SATARANGA</p>
      <h1>Privacy Policy</h1>
      <p>This is a placeholder until [Company legal name] publishes the final text. Questions: [Contact email]. A sensible address is hello@yuddha.pro.</p>
      <h2>What the game stores</h2>
      <p>An account uses the shared YUDDHA sign-in. SATARANGA stores your games, moves, and the sataranga family rating on that account. Guest play stays on this phone.</p>
      <h2>What we do not sell</h2>
      <p>Game records are used to run play, ratings, and the leaderboard. They are not sold.</p>
      <h2>Deleting an account</h2>
      <p>Profile has Delete account. It removes SATARANGA games and asks the sign-in service to delete the login. If the login remains, write to [Contact email].</p>
      <p><Link to="/">Back to SATARANGA</Link></p>
    </main>
  );
}
