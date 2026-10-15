import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <main className="legal">
      <p className="yd-kicker">SATARANGA</p>
      <h1>Terms</h1>
      <p>Placeholder for [Company legal name]. Contact [Contact email]. A sensible address is hello@yuddha.pro.</p>
      <h2>The game</h2>
      <p>SATARANGA is Old Ceylon Chess. Blitz is 3+2. Rapid is 5+10. Rated games update the shared sataranga rating. Casual games do not.</p>
      <h2>Fair play</h2>
      <p>Clocks and results for online games are kept with the game, not on the phone. Resign, draw, abort, and time are part of the game.</p>
      <h2>The account</h2>
      <p>One sign-in is shared with YUDDHA.PRO. YUDDHA.PRO is a separate product and only links here. You can delete the SATARANGA data from Profile.</p>
      <p><Link to="/">Back to SATARANGA</Link></p>
    </main>
  );
}
