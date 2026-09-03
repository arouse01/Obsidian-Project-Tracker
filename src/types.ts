import {
	Editor,
	TFile
} from 'obsidian';
import {
	TimePeriod,
	TimeSummaryGroup
} from './constants'

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

export interface PriorityOption {
	value: number;
	label: string;
}

export type ProjectStatus = "Active" | "Archived"

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

export interface PeriodicTimeSummary {
	days: Date[];
	entries: Map<string, Map<string, number>>;
}

type TimeSummaryMaps = Record<
	TimeSummaryGroup,
	Map<string, number>
>;

export type TimeSummaryStore = Record<
	TimePeriod,
	TimeSummaryMaps
>;

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

