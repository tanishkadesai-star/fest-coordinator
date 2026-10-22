export type Task = { title: string; day: number };
export type PlanDepartment = { name: string; tasks: Task[] };
export type Plan = { departments: PlanDepartment[] };

export type FestRequest = {
  id: string;
  fest_code: string;
  department: string;
  text: string;
  created_by: string;
  claimed_by: string | null;
  created_at: string;
};

// Who you are on this phone once you have started or joined a fest.
export type Session = {
  festCode: string;
  name: string;
  department: string;
  isOrganiser: boolean;
};
