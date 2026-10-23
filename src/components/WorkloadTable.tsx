import type { DeptStats } from "@/lib/report";

// Who in a department has done what, counted by the app. Compared only within the department.
export default function WorkloadTable({ dept }: { dept: DeptStats }) {
  if (dept.members.length === 0) {
    return <span className="req-meta">Nobody has joined this department yet.</span>;
  }
  return (
    <div className="table">
      <div className="person-row head">
        <span>Person</span>
        <span>Done</span>
        <span>Doing</span>
        <span>Req.</span>
      </div>
      {dept.members.map((m) => (
        <div key={m.name}>
          <div className="person-row">
            <span className="person-name">{m.name}</span>
            <span>{m.planDone}</span>
            <span>{m.planInProgress}</span>
            <span>{m.requestsTaken}</span>
          </div>
          {m.belowTeammates && <span className="flag">BELOW TEAMMATES</span>}
          {!m.belowTeammates && m.completed === 0 && m.planInProgress === 0 && (
            <span className="flag">NO WORK RECORDED YET</span>
          )}
        </div>
      ))}
    </div>
  );
}
