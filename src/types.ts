import {
	Editor,
	TFile
} from 'obsidian';


// General
export interface PriorityOption {
	value: number;
	label: string;
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


// Projects
export type ProjectStatus = "Active" | "Archived"


export interface ProjectContext {
	clients: string[] | null;
	collaborators: string[] | null;
}

export interface ProjectInfo {
	file: TFile;
	name: string;
	status: string;
	id?: string;
	client: string;
}

export interface CreateProjectRequest {
	name: string;
	client: string;
	collaborators: string[];
}

export interface ProjectModalOptions {
	context: ProjectContext;
	onSubmit: (request: CreateProjectRequest) => Promise<void>;
}

// Issues
export interface IssueContext {
	tempTitle: string;
	selectedText: string;
	projectPaths: string[] | null;
	projectNames: string[] | null;
	sourceFile: TFile | null;
	line: number | null;
	editor?: Editor
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

export interface IssueData {
	// data required for creating an issue
	project: ProjectInfo;
	priority: number;
	title: string;
	description: string;
	sourceFile: TFile | null;
}

export interface IssueItem {
	// full data for an existing issue
	projectPath: string;
	priority: number;
	title: string;
	sourceFile: TFile | null;
	id: number;
	file: TFile;
	status: string;
	startDate: string;
}

export interface ProjectOption {
	path: string;
	name: string;
}



export type SortDirection = "asc" | "desc";


// export interface IssueData {
// 	project: ProjectInfo;
// 	priority: number;
// 	title: string;
// 	description: string;
// 	sourceFile: TFile;
// }

// export interface ProjectInfo {
// 	file: TFile;
// 	name: string;
// 	status: string;
// 	id?: string;
// 	client: string;
// }



// Time session 
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


export type SessionAction = "start" | "stop";

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

// Todo
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
	// projectNames: string[] | null;
	sourceFile?: TFile;
	line: number | null;
	editor?: Editor
}
export type TodoModalOptions = CreateTodoModalOptions | EditTodoModalOptions
// export interface TodoModalOptions {
// 	context: TodoContext;
// 	projects: ProjectInfo[];
// 	priorities: PriorityOption[];
// 	onSubmit: (request: CreateTodoRequest) => Promise<void>;
// }

export interface CreateTodoRequest {
	todoInfo: TodoData;
	context: TodoContext;
}

export type TodoStatus = "open" | "complete";

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
	projectPaths: string[] | null;  // projectPaths is an array because a note can have multiple projects, so when creating a todo from selection we want to list all related projects as options
	// projectNames: string[] | null;
	sourceFile?: TFile;
	line: number | null;
	editor?: Editor
}

export interface CreateTodoModalOptions {
	mode: "create";
	context: TodoContext;
	projects: ProjectInfo[];
	priorities: PriorityOption[];
	onSubmit: (request: CreateTodoRequest) => Promise<void>;
}

export interface EditTodoModalOptions {
	mode: "edit";
	todo: TodoItem;
	projects: ProjectInfo[];
	priorities: PriorityOption[];
	onSubmit: (request: TodoItem) => Promise<void>;
}



export interface CreateTodoRequest {
	todoInfo: TodoData;
	context: TodoContext;
}

export interface EditTodoRequest {
	todo: TodoItem;
	context: TodoContext;
}

// export type TodoStatus = "open" | "complete";
export interface TodoGroup {
	key: string;
	label: string;
	todos: TodoItem[];
}
