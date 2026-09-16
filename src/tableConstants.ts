import {
	TableColumn,
	ColSort
} from './tableFunctions'
import {
	ProjectInfo,
	TodoItem
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
		width: "55px",
		tableGroup: "Project"
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
	"status": {
		label: "Status",
		sortable: true,
		width: "45px",
		centered: true
	},
	"project": {
		label: "Project",
		sortable: true,
		centered: true,
		minWidth: "170px",
		tableGroup: "project"
	},
	"hoursToday": {
		label: "Today",
		sortable: false,
		width: "50px",
		centered: true,
		tableGroup: "hours"
	},
	"hoursWeek": {
		label: "Week",
		sortable: false,
		width: "50px",
		centered: true,
		tableGroup: "hours"
	},
	"hoursMonth": {
		label: "Month",
		sortable: false,
		width: "50px",
		centered: true,
		tableGroup: "hours"
	},
	"sessionStart": {
		label: "",
		sortable: false,
		width: "40px",
		centered: true,
		tableGroup: "session"
	},
	"sessionAt": {
		label: "",
		sortable: false,
		width: "50px",
		centered: true,
		tableGroup: "session"
	},
	"sessionAdd": {
		label: "",
		sortable: false,
		width: "50px",
		centered: true,
		tableGroup: "session"
	}

} satisfies Record<string, TableColumn>;

export type TimeColumnField = keyof typeof TIME_COLS;
export type TimeSort = ColSort<TimeColumnField>
