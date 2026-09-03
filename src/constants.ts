import {
	Editor,
	TFile
} from 'obsidian';
import { PriorityOption } from './types'

export const PROJECT_DASHBOARD_VIEW_TYPE = "project-dashboard";
export const PROJECT_SINGLE_VIEW_TYPE = "project-single";
export const TODO_DASHBOARD_VIEW_TYPE = "todo-dashboard";
export const TIME_DASHBOARD_VIEW_TYPE = "time-dashboard";
export const VIEW_TYPE_TRACKER = "project-tracker"


export interface IssueContext {
	tempTitle: string;
	selectedText: string;
	projectPaths: string[] | null;
	projectNames: string[] | null;
	sourceFile: TFile;
	line: number | null;
	editor?: Editor
}

export interface IssueData {
	project: ProjectInfo;
	priority: number;
	title: string;
	description: string;
	sourceFile: TFile;
}

export interface ProjectInfo {
	file: TFile;
	name: string;
	status: string;
	id?: string;
	client: string;
}

export interface CreateIssueRequest {
	issue: IssueData;
	context: IssueContext;
}

export interface IssueModalOptions {
	context: IssueContext;
	projects: ProjectInfo[];
	priorities: PriorityOption[];
	onSubmit: (request: CreateIssueRequest) => Promise<void>;
}

export const PRIORITIES: PriorityOption[] = [
	{ value: 0, label: "Unassigned" },
	{ value: 1, label: "Optional" },
	{ value: 2, label: "Low" },
	{ value: 3, label: "Medium" },
	{ value: 4, label: "High" },
	{ value: 5, label: "Urgent" },
]

export const PriorityOrder = new Map(
	PRIORITIES.map(priority => [
		priority.label,
		priority.value
	])
);



export interface TimeSession {
	id: string;
	projectPath: string;
	start: string;
	end: string | null;  // null while session is active
}

export interface ActiveSessionDisplay {
	projectName: string,
	startTime: string
}

export interface TimeSummary {
	key: string;
	totalMinutes: number;
}

export interface ClientTimeSummary {
	client: string;
	totalMinutes: number;
}

// export interface PeriodicTimeSummary {
// 	days: Date[];
// 	entries: Map<string, Map<string, number>>;
// }

export type TimePeriod = "day" | "week" | "month";
export type TimeSummaryGroup = "project" | "client"

export type SessionContext = {
	mode: "start";
	projectPath: string;
	onSubmit: (timestamp: Date) => Promise<void>;
}
	| {
	mode: "stop";
	sessions: ActiveSessionDisplay[];
	onSubmit: (timestamp: Date) => Promise<void>;
}

export type SessionAction = "start" | "stop";

export interface TodoItem {
	id: number;
	name: string;
	notes?: string;
	dateAdded: string;
	priority: number;
	dueDate?: string;
	projectPath?: string;
	status: boolean;
	completedTS?: string;
}

export interface TodoData {
	name: string;
	notes?: string;
	priority: number;
	dueDate?: string;
	project: ProjectInfo | null;
}

export interface TodoContext {
	project?: ProjectInfo;
	tempTitle: string;
	projectPaths: string[] | null;
	projectNames: string[] | null;
	sourceFile?: TFile;
	line: number | null;
	editor?: Editor
}

export interface TodoModalOptions {
	context: TodoContext;
	projects: ProjectInfo[];
	priorities: PriorityOption[];
	onSubmit: (request: CreateTodoRequest) => Promise<void>;
}

export interface CreateTodoRequest {
	todoInfo: TodoData;
	context: TodoContext;
}

export type TodoStatus = "open" | "complete";




export type SortDirection = "asc" | "desc";

export interface TodoGroup {
	key: string;
	label: string;
	todos: TodoItem[];
}

