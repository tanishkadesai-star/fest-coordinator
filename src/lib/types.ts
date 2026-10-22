export type Task = { title: string; day: number };
export type PlanDepartment = { name: string; tasks: Task[] };
export type Plan = { departments: PlanDepartment[] };

export type FestRequest = {
  id: string;
  fest_code: string;
  department: string;
  text: string;
  location: string | null;
  created_by: string;
  claimed_by: string | null;
  created_at: string;
};

// What the overview screen shows, worked out on the server from the plan and who did what.
export type OverviewTask = { key: string; title: string; day: number; claimedBy: string | null; done: boolean };
export type RosterEntry = { title: string; day: number | null; kind: "plan" | "request"; done: boolean };
export type RosterMember = { name: string; isOrganiser: boolean; tasks: RosterEntry[] };
export type OverviewDept = {
  name: string;
  total: number;
  done: number;
  inProgress: number;
  percent: number | null; // null when the fest has no saved plan
  tasks: OverviewTask[];
  members: RosterMember[];
};
export type Overview = {
  hasPlan: boolean;
  organisers: string[]; // the organiser belongs to no department

  days: number | null;
  phase: number;
  phaseLabel: string;
  phases: string[];
  totalDone: number;
  totalTasks: number;
  percent: number | null;
  departments: OverviewDept[];
};

// The AI's written team report. The numbers it talks about are computed in plain code.
export type TeamReport = {
  summary: string;
  departments: { name: string; note: string }[];
  caveats: string[];
  generatedAt: string;
  phaseLabel: string;
};

// Who you are on this phone once you have started or joined a fest.
export type Session = {
  festCode: string;
  name: string;
  department: string;
  isOrganiser: boolean;
};
