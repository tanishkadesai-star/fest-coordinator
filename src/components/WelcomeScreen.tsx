import Palette from "./Palette";

export default function WelcomeScreen({ onJoin, onCreate }: { onJoin: () => void; onCreate: () => void }) {
  return (
    <div className="screen" style={{ paddingTop: 72, paddingBottom: 32, gap: 28 }}>
      <Palette />
      <div className="stack" style={{ gap: 14 }}>
        <h1 className="display hero" style={{ margin: 0 }}>CueBoard</h1>
        <p className="lead">
          Someone needs something. One person takes it. Each department gets its own colour-coded board.
        </p>
      </div>
      <div className="btn-grid spacer">
        <button className="btn" onClick={onJoin}>Join with a code</button>
        <button className="btn ghost" onClick={onCreate}>Create a fest</button>
      </div>
    </div>
  );
}
