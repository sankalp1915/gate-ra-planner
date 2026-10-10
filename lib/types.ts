export type Track = 'math' | 'core';
export type LogType = 'study' | 'pyq' | 'revision' | 'mock';
export type Mode = 'uniform' | 'proportional';

export interface Topic {
  id: string;
  section: string;
  subject: string;
  topic: string;
  track: Track;
  est: number;
  order: number;
  active: boolean;
  doneOn: string; // YYYY-MM-DD or ''
  notes: string;
}

export interface Log {
  id: string;
  date: string;
  topicId: string;
  hours: number;
  type: LogType;
  note: string;
  createdAt: string;
}

export interface Override {
  date: string;
  hours: number;
  reason: string;
}

export interface Mock {
  id: string;
  date: string;
  name: string;
  score: number;
  max: number;
  hours: number;
  notes: string;
}

export interface Settings {
  startDate: string;
  syllabusEnd: string;
  revisionStart: string;
  revisionEnd: string;
  examDate: string;
  /** index 0 = Sunday ... 6 = Saturday */
  hours: number[];
  mode: Mode;
  /** 'auto' balances maths+aptitude vs core so both finish together; otherwise 0..1 */
  mathShare: 'auto' | number;
  /** fraction of January capacity planned for revision (the rest is buffer) */
  revisionLoad: number;
  /** hours blocked on a revision weekend day for a full mock + analysis */
  mockHours: number;
}

export interface Store {
  topics: Topic[];
  logs: Log[];
  settings: Settings;
  overrides: Override[];
  mocks: Mock[];
}

export const LOG_TYPES: { value: LogType; label: string }[] = [
  { value: 'study', label: 'Study (theory + examples)' },
  { value: 'pyq', label: 'PYQs / practice problems' },
  { value: 'revision', label: 'Revision' },
];
