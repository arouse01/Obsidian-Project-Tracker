import {
	TableColumn,
	ColSort
} from './tableFunctions'
import {
	ProjectInfo,
	TodoItem,
	IssueItem,
	RawTimeSession,
	NoteItem
} from "./types"

// PROJECTS
export const PROJ_COLS = {
	"collapse": {
		label: "",
		sortable: false,
		groupable: false,
		width: "25px",
		tableGroup: "Project",
		centered: true
	},
	"sessionStatus": {
		label: "Status",
		sortable: true,
		groupable: false,
		width: "50px",
		tableGroup: "Project",
		centered: true
	},
	"project": {
		label: "Project",
		sortable: true,
		groupable: false,
		tableGroup: "Project",
		width: "250px",
		maxWidth: "300px"
	},
	"primary": {
		label: "Client",
		sortable: true,
		groupable: true,
		tableGroup: "Project",
		width: "250px",
		maxWidth: "300px"
	},
	"progress": {
		label: "Progress",
		sortable: false,
		centered: true,
		groupable: false,
		width: "80px",
		tableGroup: "Project"
	},
	"hoursToday": {
		label: "Today",
		sortable: false,
		groupable: false,
		width: "55px",
		tableGroup: "Hours worked",
		centered: true
	},
	"hoursWeek": {
		label: "Week",
		sortable: false,
		groupable: false,
		width: "55px",
		tableGroup: "Hours worked",
		centered: true
	},
	"hoursMonth": {
		label: "Month",
		sortable: false,
		groupable: false,
		width: "55px",
		tableGroup: "Hours worked",
		centered: true
	},
	"sessionStart": {
		label: "",
		sortable: false,
		groupable: false,
		width: "50px",
		tableGroup: "Session",
		centered: true
	},
	"sessionAt": {
		label: "",
		sortable: false,
		groupable: false,
		width: "55px",
		tableGroup: "Session",
		centered: true
	},
	"sessionAdd": {
		label: "",
		sortable: false,
		groupable: false,
		width: "50px",
		centered: true,
		tableGroup: "Session"
	},
	"action": {
		label: "",
		sortable: false,
		groupable: false,
		width: "60px",
		tableGroup: "Actions",
		centered: true
	},
	"goto": {
		label: "",
		sortable: false,
		groupable: false,
		width: "60px",
		tableGroup: "Actions",
		centered: true
	},
	// "newTodo": {
	// 	label: "",
	// 	sortable: false,
	// 	groupable: false,
	// 	width: "100px",
	// 	tableGroup: "Actions"
	// }
} satisfies Record<string, TableColumn>;

export type ProjectColumnField = keyof typeof PROJ_COLS;

// type of ProjectColumnField here instead of SortField because it can now let any field be sorted, and that is defined by the master column list above
export type ProjectSort = ColSort<ProjectColumnField>

export type ProjectGroupField =
	| "none"
	| {
		[K in keyof typeof PROJ_COLS]:
		typeof PROJ_COLS[K]["groupable"] extends true
		? K
		: never
	}[keyof typeof PROJ_COLS];

export interface ProjectGroup {
	key: string;
	label: string;
	projects: ProjectInfo[];
}

// TODOS
export const TODO_COLS = {
	"collapse": {
		label: "",
		sortable: false,
		groupable: false,
		width: "25px",
		tableGroup: "",
		centered: true
	},
	"priority": {
		label: "Priority",
		sortable: true,
		groupable: true,
		width: "75px"
	},
	"name": {
		label: "Name",
		sortable: true,
		groupable: false,
		width: "30%",
		minWidth: "250px",
		centered: false
	},
	"notes": {
		label: "Notes",
		sortable: false,
		groupable: false,
		width: "40%",
		centered: false
	},
	"status": {
		label: "",
		sortable: false,
		groupable: false,
		centered: true,
		width: "30px"
	},
	"project": {
		label: "Project",
		sortable: true,
		groupable: true,
		centered: false,
		width: "20%"
	},
	"dueDate": {
		label: "Due",
		sortable: true,
		groupable: false,
		centered: true,
		width: "75px"
	},
	"startDate": {
		label: "Added",
		sortable: false,
		groupable: false,
		centered: true,
		width: "75px"
	},
	"action": {
		label: "Action",
		sortable: false,
		groupable: false,
		centered: true,
		width: "55px"
	}
} satisfies Record<string, TableColumn>;

export type TodoColumnField = keyof typeof TODO_COLS;

// type of ProjectColumnField here instead of SortField because it can now let any field be sorted, and that is defined by the master column list above
export type TodoSort = ColSort<TodoColumnField>

export type TodoGroupField =
	| "none"
	| {
		[K in keyof typeof TODO_COLS]:
		typeof TODO_COLS[K]["groupable"] extends true
		? K
		: never
	}[keyof typeof TODO_COLS];

export interface TodoGroup {
	key: string;
	label: string;
	todos: TodoItem[];
}

// Time 
export const TIME_COLS = {
	"sessionStatus": {
		label: "Status",
		sortable: true,
		groupable: true,
		width: "45px",
		centered: true,
		// tableGroup: "status"
	},
	"primary": {
		label: "",
		sortable: true,
		centered: false,
		groupable: true,
		width: "170px",
		tableGroup: "project"
	},
	"project": {
		label: "Project",
		sortable: true,
		centered: false,
		groupable: false,
		minWidth: "220px",
		tableGroup: "project"
	},
	"progress": {
		label: "",
		sortable: false,
		centered: true,
		groupable: false,
		width: "50px",
		tableGroup: "project"
	},
	"hoursToday": {
		label: "Today",
		sortable: false,
		groupable: false,
		width: "50px",
		centered: true,
		tableGroup: "hours"
	},
	"hoursWeek": {
		label: "Week",
		sortable: false,
		groupable: false,
		width: "50px",
		centered: true,
		tableGroup: "hours"
	},
	"hoursMonth": {
		label: "Month",
		sortable: false,
		groupable: false,
		width: "50px",
		centered: true,
		tableGroup: "hours"
	},
	"sessionStart": {
		label: "",
		sortable: false,
		groupable: false,
		width: "40px",
		centered: true,
		tableGroup: "session"
	},
	"sessionAt": {
		label: "",
		sortable: false,
		groupable: false,
		width: "50px",
		centered: true,
		tableGroup: "session"
	},
	"sessionAdd": {
		label: "",
		sortable: false,
		groupable: false,
		width: "50px",
		centered: true,
		tableGroup: "session"
	}

} satisfies Record<string, TableColumn>;

export type TimeColumnField = keyof typeof TIME_COLS;
export type TimeSort = ColSort<TimeColumnField>

export type TimeGroupField =
	| "none"
	| {
		[K in keyof typeof TIME_COLS]:
		typeof TIME_COLS[K]["groupable"] extends true
		? K
		: never
	}[keyof typeof TIME_COLS];
export interface TimeGroup {
	key: string;
	label: string;
	sessions: RawTimeSession[];
}

// ISSUES
export const ISSUE_COLS = {
	"collapse": {
		label: "",
		sortable: false,
		groupable: false,
		width: "25px",
		tableGroup: "",
		centered: true
	},
	"priority": {
		label: "Priority",
		sortable: true,
		groupable: true,
		width: "75px"
	},
	"name": {
		label: "Name",
		sortable: true,
		groupable: false,
		width: "30%",
		minWidth: "250px",
		centered: false
	},
	"status": {
		label: "Status",
		sortable: false,
		groupable: false,
		centered: true,
		width: "60px"
	},
	"project": {
		label: "Project",
		sortable: true,
		groupable: true,
		centered: false,
		width: "20%"
	},
	"origin": {
		label: "Origin",
		sortable: false,
		groupable: false,
		width: "20%",
		centered: false
	},
	"startDate": {
		label: "Added",
		sortable: false,
		groupable: false,
		centered: true,
		width: "120px"
	},
	"action": {
		label: "Action",
		sortable: false,
		groupable: false,
		centered: true,
		width: "55px"
	}
} satisfies Record<string, TableColumn>;

export type IssueColumnField = keyof typeof ISSUE_COLS;

// type of ProjectColumnField here instead of SortField because it can now let any field be sorted, and that is defined by the master column list above
export type IssueSort = ColSort<IssueColumnField>

export type IssueGroupField =
	| "none"
	| {
		[K in keyof typeof ISSUE_COLS]:
		typeof ISSUE_COLS[K]["groupable"] extends true
		? K
		: never
	}[keyof typeof ISSUE_COLS];

export interface IssueGroup {
	key: string;
	label: string;
	issues: IssueItem[];
}


// NOTES
export const NOTE_COLS = {
	"collapse": {
		label: "",
		sortable: false,
		groupable: false,
		width: "25px",
		tableGroup: "",
		centered: true
	},
	"title": {
		label: "Title",
		sortable: true,
		groupable: false,
		width: "30%",
		minWidth: "250px",
		centered: false
	},
	"filename": {
		label: "Filename",
		sortable: true,
		groupable: false,
		width: "30%",
		minWidth: "250px",
		centered: false
	},
	"date": {
		label: "Date",
		sortable: true,
		groupable: false,
		centered: true,
		width: "75px"
	},
	"dateModified": {
		label: "Last Modified",
		sortable: true,
		groupable: false,
		centered: true,
		width: "75px"
	},
	"project": {
		label: "Project",
		sortable: true,
		groupable: true,
		centered: false,
		width: "20%"
	},
	"people": {
		label: "People",
		sortable: true,
		groupable: false,
		width: "75px"
	},
	"topic": {
		label: "Topic",
		sortable: false,
		groupable: false,
		centered: true,
		width: "75px"
	},
	"tags": {
		label: "Tags",
		sortable: false,
		groupable: false,
		centered: true,
		width: "85px"
	},
	"action": {
		label: "Action",
		sortable: false,
		groupable: false,
		centered: true,
		width: "55px"
	}
} satisfies Record<string, TableColumn>;

export type NoteColumnField = keyof typeof NOTE_COLS;

// type of ProjectColumnField here instead of SortField because it can now let any field be sorted, and that is defined by the master column list above
export type NoteSort = ColSort<NoteColumnField>

export type NoteGroupField =
	| "none"
	| {
		[K in keyof typeof NOTE_COLS]:
		typeof NOTE_COLS[K]["groupable"] extends true
		? K
		: never
	}[keyof typeof NOTE_COLS];

export interface NoteGroup {
	key: string;
	label: string;
	notes: NoteItem[];
}
