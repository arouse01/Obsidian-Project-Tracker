import {
	App,
	Menu,
	Component,
	ButtonComponent,
	TFile
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
    PeriodicTimeSummary,
	ProjectInfo,
	// ProjectStatus,
	TimeSession,
	TimeSummaryStore
} from "./types";
import {
	formatMinutesToDuration,
	formatDate,
	normalizeWikiLink
} from './utils';
import { TimeTracker } from './timeTracker';
import { TimeModal } from './timeModal';
import IssueTracker from './issueTracker';
import { TodoManager } from './todoTracker';
import {
	SummaryPeriod,
	getSummaryPeriod,
	SummaryGroup,
	sortItems,
	ColSort,
	TableColumn,
	SummaryColumn,
	updateSortButtons,
	getGroupOptions,
	getSortOptions
} from './tableFunctions';
import {
	PROJECT_DASHBOARD_VIEW_TYPE,
} from "./constants"


const PROJ_COLS = {
	"collapse": {
		label: "",
		sortable: false,
		groupable: false,
		width: "20px",
		tableGroup: "",
		centered: true
	},
	"sessionStatus": {
		label: "Status",
		sortable: true,
		groupable: false,
		width: "55px",
		tableGroup: ""
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


type ProjectColumnField = keyof typeof PROJ_COLS;

// type of ProjectColumnField here instead of SortField because it can now let any field be sorted, and that is defined by the master column list above
type ProjectSort = ColSort<ProjectColumnField>

type ProjectGroupField =
	| "none"
	| {
		[K in keyof typeof PROJ_COLS]:
		typeof PROJ_COLS[K]["groupable"] extends true
		? K
		: never
	}[keyof typeof PROJ_COLS];

interface ProjectGroup {
	key: string;
	label: string;
	projects: ProjectInfo[];
}

const PROJECT_STATUS_FILTERS = ["Active", "All", "Archived"] as const;
type ProjectStatusFilter = typeof PROJECT_STATUS_FILTERS[number];


export class ProjectDashboardView extends Component{
	// private container: HTMLElement;

	private summaryPeriod: SummaryPeriod = "week";  // to drive the summary period selection
	private periodOffset = 0;  // to drive the summary period selection, how far in the past to go
	private summaryGroup: SummaryGroup = "client";

	// private projectMap = new Map<string, string>();

	private projectTableEl!: HTMLTableElement;
	private projectTableBodyEl!: HTMLTableSectionElement;
	private summaryTableEl!: HTMLTableElement;
	private summaryTableBodyEl!: HTMLTableSectionElement;
	private rangeText!: HTMLElement;

	private filterBy: ProjectStatusFilter = "Active";  // to drive which projects are visible
	private groupBy: ProjectGroupField = "primary";
	private sortBy: ProjectSort[] = [
		{ field: "project", dir: "asc" }
	];

	private colOrder: ProjectColumnField[] = [
		"project",
		"sessionStatus",
		"primary",
		"hoursToday",
		"hoursWeek",
		"hoursMonth",
		"sessionStart",
		"sessionAt",
		"action"
	]

	private sortButtons = new Map<ProjectColumnField, ButtonComponent>();

	// private groupButtons = new Map<ProjectGroupField, ButtonComponent>();

	// private filterOptions = new Map<ProjectStatusFilter, ButtonComponent>();

	private activeSessionMap = new Map<string, TimeSession>();

	private refreshInterval: number | null = null;

	// private dayTimeSumByPath = new Map<string, TimeSummary>
	// private dayTimeSumByClient = new Map<string, TimeSummary>
	// private weekTimeSumByPath = new Map<string, TimeSummary>

	private timeSummaries: TimeSummaryStore = {
		day: {
			project: new Map(),
			client: new Map()
		},
		week: {
			project: new Map(),
			client: new Map()
		},
		month: {
			project: new Map(),
			client: new Map()
		}
	};
	// private dayTimeByPath = new Map<string, number>
	// private dayTimeByClient = new Map<string, number>
	// private weekTimeByPath = new Map<string, number> 
	// private weekTimeByClient = new Map<string, number>
	// private monthTimeByPath = new Map<string, number>
	// private monthTimeByClient = new Map<string, number> 
	
	// private dayStart = window.moment()
	// 	.startOf("day")
	// 	.toDate();
	// private dayEnd = window.moment()
	// 	.endOf("day")
	// 	.toDate();
	// private daySummaryTotals!: TimeSummary[];
	

	private collapsedGroups = new Set<string>();  // which groups are collapsed in the table

	constructor(
		private container: HTMLElement,
		private app: App,
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager,
		private issueTracker: IssueTracker,
		private todoManager: TodoManager
	) {
		super();
		this.container = container
	}

	getViewType(): string {
		return PROJECT_DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Project dashboard";
	}

	getIcon(): string {
		return 'folder-open-dot';
	}

	onload(): void {
		this.registerEvent(
			this.timeTracker.on("time-tracker-updated", () => {
				void this.updateProjectTableRows()
			})
		);
		void this.initialize()

		this.refreshInterval = window.setInterval(() => {
			void this.updateProjectTableRows();
		}, 60000);
		

		// const projects = this.projectManager.getProjects();
		// this.projectMap = new Map(
		// 	projects.map(project => [project.file.path, project.name])
		// );
	}

	private async initialize(): Promise<void> {
		await this.updateSummaryVars();
		await this.buildDashboard();
		await this.updateProjectTableRows();
	}

	async onClose(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	private async buildDashboard() {

		const dashboardContainer = this.container.createDiv({ cls: "project-section" })
		dashboardContainer.addClass('project-dashboard')
		const projectSection = dashboardContainer.createDiv({ cls: "project-section" });
		// projectSection.addClass("project-section")
		// projectSection.createEl("h3", {
		// 	text: "Projects"
		// });

		const controlSection = projectSection.createDiv({ cls: 'project-controls' });
		controlSection.addClass("control-col")

		const controlRow1 = controlSection.createDiv({ cls: 'project-controls' });
		controlRow1.addClass("control-row")
		// filter buttons
		const filterSection = controlRow1.createDiv({ cls: 'project-controls' });
		// filterSection.addClass("control-row")
		filterSection.createEl("label", { text: 'Show only:' })
		const filterSelect = filterSection.createEl('select', {
			cls: 'project-filter-select'
		});
		for (const filter of PROJECT_STATUS_FILTERS) {
			filterSelect.createEl('option', {
				value: filter, //'project',
				text: filter
			});
		}
		filterSelect.value = this.filterBy;
		filterSelect.addEventListener("change", () => {
			const value = filterSelect.value;
			// if ((PROJECT_STATUS_FILTERS as readonly string[]).includes(value)) {
				this.filterBy = value as ProjectStatusFilter;
				void this.rebuildProjectTable();
			// }
			
		});
	

		// To add more group options, update Project_Group_Fields in types.ts and add the grouping logic to getGroupKey and getGroupLabel
		const groupingSection = controlRow1.createDiv({ cls: 'project-controls' });
		groupingSection.addClass("new-project-button")
		// groupingSection.addClass("control-row")
		groupingSection.createEl("label", { text: 'Group by:' })
		const groupSelect = groupingSection.createEl('select', {
			cls: 'project-filter-select'
		});
		for (const group of getGroupOptions(PROJ_COLS)) {
			groupSelect.createEl('option', {
				value: group.value, //'project',
				text: group.label
			});
		}
		groupSelect.value = this.groupBy;
		groupSelect.addEventListener("change", () => {
			this.groupBy = groupSelect.value as ProjectGroupField;
			this.collapsedGroups.clear();
			void this.rebuildProjectTable();

		});
		// for (const group of getGroupOptions(PROJ_COLS)) {
		// 	const button = new ButtonComponent(groupingSection)
		// 		.setButtonText(group.label)
		// 		.onClick(async () => {
		// 			this.groupBy = group.value;
		// 			this.collapsedGroups.clear();
		// 			await this.rebuildProjectTable();
		// 		});

		// 	this.groupButtons.set(group.value, button);
		// }

/*
		// Create grouping buttons
		const controlRow2 = controlSection.createDiv({ cls: 'project-controls' });
		controlRow2.addClass("control-row")
		
		const sortingSection = controlRow2.createDiv({ cls: 'project-controls' });
		sortingSection.addClass("new-project-button")
		// sortingSection.addClass("control-row")
		sortingSection.createEl("label", { text: 'Sort by:' })
		for (const group of getSortOptions(PROJ_COLS)) {

			const button = new ButtonComponent(sortingSection)
					// .setButtonText(column.label)
					.setClass("project-dashboard-button")
					.onClick(async () => {
						// group is collapsed, uncollapse it
						this.updateSort(group.value);
						await this.updateProjectTableRows();
					});
			this.sortButtons.set(group.value, button);
			
		}
*/
		const projectTableSection = projectSection.createDiv({ cls: 'project-section' });
		projectTableSection.addClass('project-dashboard');

		this.projectTableEl = projectTableSection.createEl('table');
		this.projectTableEl.addClass("project-table")
		const columns = this.getVisibleCols();
		this.createProjectTableColGroup(this.projectTableEl, columns);
		this.createProjectTableHeaders(this.projectTableEl, columns);

		this.projectTableBodyEl = this.projectTableEl.createEl('tbody')

		// const controlBottomSection = projectSection.createDiv({ cls: 'project-controls' });
		// controlBottomSection.addClass("control-col")
		// new ButtonComponent(controlBottomSection)
		// 	.setButtonText("New project...")
		// 	.setClass("new-project-button")
		// 	.onClick(async () => {
		// 		await this.addProject();
		// 		await this.updateProjectTableRows();
		// 	});


		// Summary table below the main one
		const summarySection = dashboardContainer.createDiv({ cls: "project-section" });
		summarySection.createEl("h3", {
			text: "Statistics"
		});

		summarySection.addClass('project-dashboard')

		const summaryControlsTop = summarySection.createDiv();
		summaryControlsTop.addClass('summary-controls')
		
		summaryControlsTop.createEl('label', {
			text: 'Summarize by:',
			attr: { for: 'period-selector' }
		});
		const periodSelect = summaryControlsTop.createEl('select', {
			cls: 'summary-period-select',
			attr: { id: 'period-selector' }
		});
		periodSelect.createEl('option', {
			value: 'week',
			text: "Week"
		});
		periodSelect.createEl('option', {
			value: 'month',
			text: "Month"
		});
		periodSelect.value = this.summaryPeriod;

		periodSelect.addEventListener("change", () => {
			const value = periodSelect.value;

			if (value === "week" || value === "month") {
				this.summaryPeriod = value;
				void this.rebuildSummaryTable();
			}
		});

		
		const summaryControlsBottom = summarySection.createDiv();
		summaryControlsBottom.addClass('summary-controls')
		new ButtonComponent(summaryControlsBottom)
			.setButtonText("⏴")
			.setClass("arrow-button")
			.onClick(async () => {
				this.periodOffset--;
				await this.rebuildSummaryTable();
			});
		const { start, end } = getSummaryPeriod(this.periodOffset, this.summaryPeriod);

		let dateRangeText: string;
		if (this.summaryPeriod === "week") {
			dateRangeText = `${window.moment(start).format("MMM DD")} - ${window.moment(end).format("MMM DD")}`
		} else {
			dateRangeText = window.moment(start).format("MMMM YYYY")
		}
		this.rangeText = summaryControlsBottom.createSpan({
			text: dateRangeText,
			cls: "fixed-width-date-range"
		})

		new ButtonComponent(summaryControlsBottom)
			.setButtonText("⏵")
			.setClass("arrow-button")
			.onClick(async () => {
				this.periodOffset++;
				await this.rebuildSummaryTable();
			})

		new ButtonComponent(summaryControlsBottom)
			.setButtonText("Now")
			.onClick(async () => {
				this.periodOffset = 0;
				await this.rebuildSummaryTable();
			})

		// select.style.width = "100%";

		
		const sectionSummaryTableEl = summarySection.createEl('section');
		sectionSummaryTableEl.addClass('project-dashboard');

		this.summaryTableEl = sectionSummaryTableEl.createEl('table');
		this.summaryTableEl.addClass('project-table')
		const summaryData = await this.getSummaryData()
		const summaryCols = this.getSummaryColumns(summaryData);
		this.createSummaryTableColGroup(this.summaryTableEl, summaryCols);
		this.createSummaryHeaders(this.summaryTableEl, summaryData);

		// this.summaryTableBodyEl = this.summaryTableEl.createEl('tbody');
	}

	async updateProjectTableRows(): Promise<void> {
		// specifically for updating the rows without touching the headers
		await this.updateSummaryRows();
		await this.updateSummaryVars();

		const newBody = createEl('tbody');
		await this.buildProjectTableBody(newBody);
		this.projectTableBodyEl?.replaceWith(newBody);
		this.projectTableBodyEl = newBody;

		
	}

	async rebuildProjectTable(): Promise<void> {
		const newTable = createEl('table')
		newTable.addClass("project-table")
		const columns = this.getVisibleCols();
		this.createProjectTableColGroup(newTable, columns);
		this.createProjectTableHeaders(newTable, columns);
		const newBody = newTable.createEl('tbody')
		await this.buildProjectTableBody(newBody);

		this.projectTableEl.replaceWith(newTable);
		this.projectTableEl = newTable;
		this.projectTableBodyEl = newBody;
	}

	private createProjectTableColGroup(
		table: HTMLTableElement,
		columns: Array<[ProjectColumnField, TableColumn]>
	): void {
		const colGroup = table.createEl('colgroup');

		for (const [, column] of columns) {
			const col = colGroup.createEl("col")
			if (column.width) {
				col.style.width = column.width;
			}
			if (column.minWidth) {
				col.style.minWidth = column.minWidth;
			}
			if (column.maxWidth) {
				col.style.maxWidth = column.maxWidth;
			}
		}
	}

	private createProjectTableHeaders(
		table: HTMLTableElement,
		columns: Array<[ProjectColumnField, TableColumn]>
	): void {
		const thead = table.createEl('thead');
		const headerRow1 = thead.createEl('tr');

		const colGroups = new Map<string, TableColumn[]>();

		for (const [, column] of this.getVisibleCols()) {
			const colGroup = column.tableGroup ?? "";

			if (!colGroups.has(colGroup)) {
				colGroups.set(colGroup, []);
			}

			colGroups.get(colGroup)!.push(column);
		}
		for (const [colGroupName, colGroupColumns] of colGroups) {
			const cell = headerRow1.createEl("th");
			cell.colSpan = colGroupColumns.length;
			cell.setText(colGroupName);
			
		}
		

		const row = thead.createEl('tr');

		for (const [field, column] of columns) {
			const header = row.createEl('th');

			// header.setText(column.label)
			if (!column.centered) {
				header.addClass("group-button")
			}


			if (column.sortable) {
				const button = new ButtonComponent(header)
					.setClass("project-dashboard-button")
					.onClick(async () => {
						// group is collapsed, uncollapse it
						this.updateSort(field);
						await this.updateProjectTableRows();
					});
				this.sortButtons.set(field, button);
			} else {
				header.setText(column.label)
			}
		}

		this.projectTableBodyEl = this.projectTableEl.createEl('tbody');

		updateSortButtons(this.sortButtons, this.sortBy, PROJ_COLS);
	}

	async buildProjectTableBody(tbody: HTMLTableSectionElement): Promise<void> {
		// update the body of the table only and return the updated table for actual loading into the ui
		// this.updateGroupByButtons(this.groupButtons);
		// this.updateFilterButtons(this.filterOptions)
		
		let projects: ProjectInfo[];
		if (this.filterBy === "Active") {
			projects = this.projectManager.getActiveProjects();
		} else if (this.filterBy === "Archived") {
			projects = this.projectManager.getArchivedProjects();
		} else {
			projects = this.projectManager.getProjects();
		} 

		

		// this.projectMap = new Map(
		// 	projects.map(project => [project.file.path, project.name])
		// );

		projects = sortItems(
			projects,
			this.sortBy,
			(a, b, field) => this.compareProjects(a, b, field)
		)

		const groups = this.groupProjects(projects)

		// const newTable = createEl('table')
		// this.createTodoTableHeaders(targetTable);

		for (const group of groups) {

			if (this.groupBy !== 'none') {

				if (this.collapsedGroups.has(group.key)) {
					this.renderGroupHeader(tbody, group);
					continue;  // skip adding rows if the group is collapsed
				}
			}

			for (const [index, project] of group.projects.entries()) {
				this.createProjectRow(
					tbody,
					project,
					this.groupBy !== 'none' && index === 0
				);
			}
		}
		this.createNewProjectRow(tbody)

		const activeSessions = await this.timeTracker.getActiveSessions();
		if (activeSessions.length > 0) {
			this.createStopRow(tbody)
		}
	}

	private createNewProjectRow(target: HTMLTableSectionElement) {
		const row = target.createEl('tr');

		for (const [field,] of this.getVisibleCols()) {
			const cell = row.createEl("td");
			cell.addClass('group-row')
			this.renderAddProjectRowCell(cell, field);
		}
		
	}
	// private updateGroupByButtons(groupButtonMap: Map<ProjectGroupField, ButtonComponent>): void {
	// 	for (const [field, button] of groupButtonMap) {
	// 		button.buttonEl.toggleClass(
	// 			"button-selected",
	// 			this.groupBy === field
	// 		)
	// 	}
	// }

	// private updateFilterButtons(filterButtonMap: Map<ProjectStatusFilter, ButtonComponent>): void {
	// 	for (const [filter, button] of filterButtonMap) {
	// 		button.buttonEl.toggleClass(
	// 			"button-selected",
	// 			this.filterBy === filter
	// 		)
	// 	}
	// }

	private updateSort(field: ProjectColumnField) {
		const index = this.sortBy.findIndex(sort => sort.field === field);

		if (index === -1) {
			// index of -1 means it's not in the list at all, add it
			this.sortBy.unshift({
				field,
				dir: "asc"
			});
		} else {
			const sort = this.sortBy[index];
			if (sort!.dir === "asc") {
				// currently ascending, change to descending
				sort!.dir = "desc";

				// move to front of array
				this.sortBy.splice(index, 1);
				this.sortBy.unshift(sort!);
			} else {
				// dir can only be asc, desc, or none (not present)
				this.sortBy.splice(index, 1);
			}
		}


		updateSortButtons(this.sortButtons, this.sortBy, PROJ_COLS);

	}

	private compareProjects(
		a: ProjectInfo,
		b: ProjectInfo,
		field: ProjectColumnField
	): number {
		switch (field) {
			case "sessionStatus": {
				const statusA = this.activeSessionMap.get(a.file.path)?.projectPath ?? "";
				const statusB = this.activeSessionMap.get(b.file.path)?.projectPath ?? "";
				return statusA.localeCompare(statusB);
			}

			case "project": {
				const projectA = a.name ?? "";
				const projectB = b.name ?? "";
				return projectA.localeCompare(projectB);
			}

			case "primary": {
				const clientA = normalizeWikiLink(a.client);
				const clientB = normalizeWikiLink(b.client);
				return clientA.localeCompare(clientB);
			}

			default:
				// we list all the sortable fields here, and if the field isn't sortable return 0 which means the values are equivalent (for this comparison)
				return 0;
			
		}
	}

	private groupProjects(
		projects: ProjectInfo[]
	): ProjectGroup[] {
		if (this.groupBy === "none") {
			return [{
				key: "all",
				label: "",
				projects
			}];
		}
		const groups = new Map<string, ProjectInfo[]>();

		for (const project of projects) {
			const key = this.getGroupKey(project);

			if (!groups.has(key)) {
				groups.set(key, []);
			}

			groups.get(key)!.push(project);
		}

		// Get the group labels after the groups are assembled so you only have to get each group label once instead of per item
		return Array.from(groups.entries()).map(
			([key, projects]) => ({
				key,
				label: this.getGroupLabel(key),
				projects
			})
		);
	}

	private getGroupKey(
		project: ProjectInfo,
	): string {
		// Needs a case statement for each item in types.Todo_Group_Fields to handle returning the group's key, based on the selected grouping
		switch (this.groupBy) {
			case "primary":
				return normalizeWikiLink(String(project.client))

			// case "project":
			// 	return String(project.file.path)

			default:
				return "";
		}
	}

	private getGroupLabel(
		key: string
	): string {
		// Needs a case statement for each item in types.Todo_Group_Fields to handle returning the individual group name, based on the selected grouping
		switch (this.groupBy) {
			case "primary":
				return key;

			// case "project":
			// 	return key ? this.projectMap.get(key) ?? "Unknown" : "None";

			default:
				return "";
		}
	}

	private renderGroupHeader(target: HTMLTableSectionElement, group: ProjectGroup) {
		const groupRow = target.createEl('tr');
		groupRow.addClass("group-row")
		for (const [field,] of this.getVisibleCols()) {

			const cell = groupRow.createEl("td");
			
			this.renderGroupHeaderCell(cell, field, group);
		}
	}

	private createProjectRow(
		target: HTMLTableSectionElement,
		project: ProjectInfo,
		firstInGroup: boolean = false
	) {
		const row = target.createEl('tr');

		for (const [field, ] of this.getVisibleCols()) {

			const cell = row.createEl("td");

			this.renderCell(cell, field, project, firstInGroup);
		}
		
	}

	private createStopRow(target: HTMLTableSectionElement) {
		const row = target.createEl('tr');

		for (const [field, ] of this.getVisibleCols()) {
			const cell = row.createEl("td");
			cell.addClass('summary-row')
			this.renderProjectSummaryCell(cell, field);
		}
		
	}

	private getVisibleCols(): Array<
		[ProjectColumnField, TableColumn]
	> {
		switch (this.groupBy) {
			// case 'project':
			// 	this.colOrder = [
			// 		"sessionStatus",
			// 		"project",
			// 		"primary",
			// 		"hoursToday",
			// 		"hoursWeek",
			// 		"sessionStart",
			// 		"sessionAt",
			// 		"action",
			// 	]
			// 	break;
			case 'primary':
				this.colOrder = [
					"collapse",
					"primary",

					"project",
					"sessionStatus",
					"hoursToday",
					"hoursWeek",
					"hoursMonth",
					"sessionStart",
					"sessionAt",
					"action",
					// "newMeeting",
					// "newIssue",
					// "newTodo"
				]
				break;
			case 'none':
				this.colOrder = [
					
					"project",
					"primary",
					"sessionStatus",
					"hoursToday",
					"hoursWeek",
					"hoursMonth",
					"sessionStart",
					"sessionAt",
					// "newMeeting",
					// "newIssue",
					// "newTodo"
					"action"
				]
				break;
		}
		return this.colOrder.map(field => [
			field,
			PROJ_COLS[field]
		])

	}

	// async updateDashboard(): Promise<void> {
	// 	await this.updateProjects();
	// 	await this.updateSummary();
	// }

	private async updateSummaryVars() {
		const activeSessions = await this.timeTracker.getActiveSessions();
		this.activeSessionMap = new Map(
			activeSessions.map(session => [session.projectPath, session])
		);

		const weekStart = window.moment()
			.startOf("week")
			.toDate();
		const weekEnd = window.moment()
			.endOf("week")
			.toDate();
		const weekSummaryTotals = await this.timeTracker.getTimeSummary(weekStart, weekEnd);
		// this.weekTimeByPath = new Map(
		// 	weekSummaryTotals.map(summary => [summary.key, summary.totalMinutes])
		// )
		const weekClientSummaryTotals = await this.timeTracker.getTimeSummaryByClient(weekStart, weekEnd);
		// this.weekTimeByClient = new Map(
		// 	weekClientSummaryTotals.map(summary => [summary.key, summary.totalMinutes])
		// )

		const dayStart = window.moment()
			.startOf("day")
			.toDate();
		const dayEnd = window.moment()
			.endOf("day")
			.toDate();
		const daySummaryTotals = await this.timeTracker.getTimeSummary(dayStart, dayEnd);
		// this.dayTimeByPath = new Map(
		// 	daySummaryTotals.map(summary => [summary.key, summary.totalMinutes])
		// )

		const dayClientSummaryTotals = await this.timeTracker.getTimeSummaryByClient(dayStart, dayEnd);
		// this.dayTimeByClient = new Map(
		// 	dayClientSummaryTotals.map(summary => [summary.key, summary.totalMinutes])
		// )

		const monthStart = window.moment()
			.startOf("month")
			.toDate();
		const monthEnd = window.moment()
			.endOf("month")
			.toDate();
		const monthSummaryTotals = await this.timeTracker.getTimeSummary(monthStart, monthEnd);

		// this.monthTimeByPath = new Map(
		// 	monthSummaryTotals.map(summary => [summary.key, summary.totalMinutes])
		// )

		const monthClientSummaryTotals = await this.timeTracker.getTimeSummaryByClient(monthStart, monthEnd);
		// this.monthTimeByClient = new Map(
		// 	monthClientSummaryTotals.map(summary => [summary.key, summary.totalMinutes])
		// )

		this.timeSummaries.day.project = new Map(
			daySummaryTotals.map(summary => [
				summary.key,
				summary.totalMinutes
			])
		);
		this.timeSummaries.day.client = new Map(
			dayClientSummaryTotals.map(summary => [
				summary.key,
				summary.totalMinutes
			])
		);
		this.timeSummaries.week.project = new Map(
			weekSummaryTotals.map(summary => [
				summary.key,
				summary.totalMinutes
			])
		);
		this.timeSummaries.week.client = new Map(
			weekClientSummaryTotals.map(summary => [
				summary.key,
				summary.totalMinutes
			])
		);
		this.timeSummaries.month.project = new Map(
			monthSummaryTotals.map(summary => [
				summary.key,
				summary.totalMinutes
			])
		);
		this.timeSummaries.month.client = new Map(
			monthClientSummaryTotals.map(summary => [
				summary.key,
				summary.totalMinutes
			])
		);

	}
	
	async getSummaryData(): Promise<PeriodicTimeSummary> {
		const { start, } = getSummaryPeriod(this.periodOffset, this.summaryPeriod);

		let summaryTotals: PeriodicTimeSummary;

		if (this.summaryPeriod === "month") {
			summaryTotals = await this.timeTracker.getMonthlySummary(start, this.summaryGroup);
		} else {
			summaryTotals = await this.timeTracker.getWeeklySummary(start, this.summaryGroup);
		}
		return summaryTotals;
	}

	async rebuildSummaryTable(): Promise<void> {
		// Get summary data first, then use it to build the summary table. Works different from the project table because the columns that appear are much more dependent on app state, which also affects how the calculations work
		const summaryTotals = await this.getSummaryData();
		const { start, end } = getSummaryPeriod(this.periodOffset, this.summaryPeriod);

		let dateRangeText: string;
		// let summaryTotals: PeriodicTimeSummary;

		const newTable = createEl('table');

		if (this.summaryPeriod === "month") {
			dateRangeText = window.moment(start).format("MMMM YYYY")
		} else {
			dateRangeText = `${window.moment(start).format("MMM DD")} - ${window.moment(end).format("MMM DD")}`
		}
			
		this.rangeText.setText(dateRangeText);
		const summaryCols = this.getSummaryColumns(summaryTotals);
		this.createSummaryTableColGroup(newTable, summaryCols);
		this.createSummaryHeaders(newTable, summaryTotals);
		const newBody = newTable.createEl('tbody')
		await this.buildSummaryTableBody(newBody, summaryTotals);

		this.summaryTableEl.replaceWith(newTable);
		this.summaryTableEl = newTable;
		this.summaryTableBodyEl = newBody;
	}

	private getSummaryColumns(
		summaryTotals: PeriodicTimeSummary
	): SummaryColumn[] {
		let summaryCols: SummaryColumn[];
		if (this.summaryPeriod === "week") {
			summaryCols = [
				{
					key: "group",
					label: "",
					minWidth: "120px",
					width: "250px",
					maxWidth: "500px"
				},
				...summaryTotals.days.map(day => ({
					key: formatDate(day),
					label: day.toLocaleDateString("en-US", {
						weekday: "short",
						day: "2-digit"
					}),
					width: "80px"
				})),

				{
					key: "weekTotal",
					label: "Week Total",
					width: "120px"
				}
			]
		}
		else {
			summaryCols = [
				{
					key: "group",
					label: "",
					minWidth: "120px",
					maxWidth: "500px"
				},
				...summaryTotals.days.map(day => ({
					key: formatDate(day),
					label: day.toLocaleDateString("en-US", {
						month: "short"
					}),
					width: "80px"
				})),

				{
					key: "yearTotal",
					label: "Yearly Total",
					width: "120px"
				}
			]
		}
		
		return summaryCols;
	}

	private createSummaryTableColGroup(
		table: HTMLTableElement,
		columns: SummaryColumn[]
	): void {
		const colGroup = table.createEl('colgroup');

		for (const column of columns) {
			const col = colGroup.createEl("col")
			if (column.width) {
				col.style.width = column.width;
			}
			if (column.minWidth) {
				col.style.minWidth = column.minWidth;
			}
			if (column.maxWidth) {
				col.style.maxWidth = column.maxWidth;
			}
		}

	}

	createSummaryHeaders(
		table: HTMLTableElement,
		summaryData: PeriodicTimeSummary
	) {

		table.addClass('project-table')
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');

		// create group column (grouping by project or client)
		const groupCell = headerRow.createEl('th');
		
		const groupSelect = groupCell.createEl('select', {
			cls: 'summary-group-select'
		});
		groupSelect.createEl('option', {
			value: 'project',
			text: "Project"
		});
		groupSelect.createEl('option', {
			value: 'client',
			text: "Client"
		});
		groupSelect.value = this.summaryGroup;

		groupSelect.addEventListener("change", () => {
			const value = groupSelect.value;

			if (value === "project" || value === "client") {
				this.summaryGroup = value;
				void this.updateSummaryRows();
			}
		});

		// rest of columns
		
		if (this.summaryPeriod === "month") {
			for (const day of summaryData.days) {
				const headerCell = headerRow.createEl('th');
				headerCell.createDiv({
					text: day.toLocaleDateString("en-US", { month: 'short' }),
					cls: "summary-col-header"
				})
				headerCell.createDiv({
					text: day.toLocaleDateString("en-US", { year: 'numeric' }),
					cls: "summary-col-subheader"
				})
			}

		} else {
			for (const day of summaryData.days) {
				const headerCell = headerRow.createEl('th');
				headerCell.createDiv({
					text: day.toLocaleDateString("en-US", { weekday: 'short' }),
					cls: "summary-col-header"
				})
				headerCell.createDiv({
					text: day.toLocaleDateString("en-US", { day: '2-digit' }),
					cls: "summary-col-subheader"
				})
			}

			const totalCell = headerRow.createEl('th', { text: 'Total' });
			totalCell.addClass("total-col")
			
		}

		this.summaryTableBodyEl = this.summaryTableEl.createEl('tbody');
	}

	async updateSummaryRows(): Promise<void> {
		// function for updating the rows without touching the headers
		
		// create temporary body for table, then fill it and swap for the current one instead of clearing the whole thing
		const newBody = createEl('tbody')
		const summaryData = await this.getSummaryData()
		await this.buildSummaryTableBody(newBody, summaryData);
		
		this.summaryTableBodyEl.replaceWith(newBody);
		this.summaryTableBodyEl = newBody;
	}

	async buildSummaryTableBody(
		tbody: HTMLTableSectionElement,
		summaryData: PeriodicTimeSummary
	): Promise<void> {
		// build a separate updated summary table body into the provided HTMLTableSectionElement
		for (const [key, dailyMinutes] of summaryData.entries) {
			const row = tbody.createEl('tr');

			// Project
			const groupCell = row.createEl("td")

			let groupName = "";
			if (this.summaryGroup === "client") {
				groupName = key;
			}
			else if (this.summaryGroup === "project") {
				groupName = this.projectManager.getProjectInfoByPath(key)?.name ?? "unknown";
			} else {
				groupName = "unknown"
			}
			groupCell.setText(groupName);

			let runningTotal = 0;
			for (const day of summaryData.days) {
				const dateStr = formatDate(day);
				const minutes = dailyMinutes.get(dateStr) ?? 0;
				runningTotal += minutes;
				const cell = row.createEl("td");
				cell.setText(formatMinutesToDuration(minutes, true))
			}
			// Total column
			const cell = row.createEl("td");
			cell.addClass("total-col")
			cell.setText(formatMinutesToDuration(runningTotal, true))
			
		}
	}

	async toggleGroupCollapse(open: boolean) {
		if (open) {
			this.collapsedGroups.clear();
		} else {
			let projects: ProjectInfo[];
			if (this.filterBy === "Active") {
				projects = this.projectManager.getActiveProjects();
			} else if (this.filterBy === "Archived") {
				projects = this.projectManager.getArchivedProjects();
			} else {
				projects = this.projectManager.getProjects();
			}
			const groups = this.groupProjects(projects)
			for (const group of groups) {
				this.collapsedGroups.add(group.key);
			}
		}
	}

	async createMeeting(
		project: ProjectInfo
	): Promise<void> {
		let newFile: TFile;

		const currDate = formatDate();
		const projectName = project.name;
		const meetingTitle = `${currDate} ${projectName} Meeting`

		const filename = `${meetingTitle}`
		const path = `Meeting Notes/${filename}.md`
		const creationTS = formatDate(undefined, "datetime_long");
		const content =
			`---
project: "[[${projectName}]]"
topic: 
date: "${creationTS}"
people:
- 
tags:
- meeting
---
# ${filename}

`;

		newFile = await this.app.vault.create(path, content);

		await this.app.workspace.getLeaf(false).openFile(newFile);

	}

	async addProject(): Promise<void> {


	}

	/*
	Responsible for setting a given cell with its appropriate value given the record it's on and the column
	*/
	private renderCell(
		cell: HTMLTableCellElement,
		field: ProjectColumnField,
		project: ProjectInfo,
		firstInGroup: boolean
	): void {
		const activeSession = this.activeSessionMap.get(project.file.path);

		switch (field) {
			case "collapse":
				{
					if (firstInGroup) {
						new ButtonComponent(cell)
							.setIcon(`list-chevrons-down-up`)
							// .setClass("group-button")
							.onClick(async () => {
								// group isn't collapsed, collapse it
								const groupKey = this.getGroupKey(project)
								this.collapsedGroups.add(groupKey);
								await this.updateProjectTableRows();
							});
					
					}
					break;
				}

			case "sessionStatus":
				{
					
					// const isActive = activePaths.has(project.file.path);
					if (activeSession) {
						const indicator = cell.createDiv({ cls: "active-indicator" });
						indicator.createDiv({ cls: "blinky-circle-green" })
						const span = indicator.createSpan();  //⏲
						span.setText("🟢")
						
					} else {
						cell.setText("");
					}
					break;
				}

			case "project":
				{  // curly braces needed to avoid warning about "unexpected lexical declaration" because we're defining a const
					cell.addClass("group-button")
					const projectLink = cell.createEl("a", { text: project.name });
					projectLink.addClass("group-button")
					projectLink.addEventListener("click", (event) => {
						event.preventDefault();
						const existingLeaf = this.app.workspace.getLeavesOfType(
							"markdown"
						).find(leaf => {
							const view = leaf.view;
							return view.getState().file === project.file.path;
						});

						if (existingLeaf) {
							void this.app.workspace.revealLeaf(existingLeaf);
						} else {
							void this.app.workspace.getLeaf(false).openFile(project.file);
						}
					});
					
					break;
				}

			case "primary":
				{
					if (firstInGroup) {
						cell.addClass("group-button")
						const groupKey = this.getGroupKey(project)
						new ButtonComponent(cell)
							.setButtonText(`${this.getGroupLabel(groupKey)}`)
							.setClass("group-button")
							.onClick(async () => {
								// group isn't collapsed, collapse it
								
								this.collapsedGroups.add(groupKey);
								await this.updateProjectTableRows();
							});

					}
					if (this.groupBy !== field) {
						const file = this.app.vault.getAbstractFileByPath(project.file.path);
						let client: string = '';
						if (file instanceof TFile) {
							client = this.projectManager.getFrontmatterString(file, "Primary").replace(/^\[\[|\]\]$/g, "")
						 }
						cell.setText(client);
					}
					break;
				}

			case "hoursToday":
				{
					const dailyTimeSum = this.timeSummaries.day.project.get(project.file.path) ?? 0;
					const dailyTimeText = formatMinutesToDuration(dailyTimeSum);
					cell.setText(dailyTimeText);
					break;
				}

			case 'hoursWeek':
				{
					const weekTimeSum = this.timeSummaries.week.project.get(project.file.path) ?? 0;
					const weekTimeText = formatMinutesToDuration(weekTimeSum);
					cell.setText(weekTimeText);
					break;
				}

			case 'hoursMonth':
				{
					const weekTimeSum = this.timeSummaries.month.project.get(project.file.path) ?? 0;
					const weekTimeText = formatMinutesToDuration(weekTimeSum);
					cell.setText(weekTimeText);
					break;
				}

			case 'sessionStart':
				new ButtonComponent(cell)
						.setButtonText(activeSession ? "Stop" : "Start")
						.setClass("project-dashboard-button")
						.onClick(async () => {
							if (activeSession) {
								await this.timeTracker.stopProjectSession(project)
							} else {
								await this.timeTracker.startProjectSession(project)
							}
							void this.updateProjectTableRows()
						})

				break;

			case 'sessionAt':
				new ButtonComponent(cell)
					.setButtonText(activeSession ? "Stop at" : "Start at")
					.setClass("project-dashboard-button")
					.onClick(async () => {
						if (activeSession) {
							new TimeModal(this.app, {
								mode: 'stop',
								sessions: [{
									projectName: project.name,
									startTime: activeSession.start
								}],
								onSubmit: async (timestamp: Date) => {
									await this.timeTracker.stopProjectSession(
										project,
										timestamp
									);
									void this.updateProjectTableRows()
								}
							}).open();
						} else {
							new TimeModal(this.app, {
								mode: 'start',
								projectPath: project.file.path,
								onSubmit: async (timestamp: Date) => {
									await this.timeTracker.startProjectSession(
										project,
										timestamp
									);
									void this.updateProjectTableRows()
								}
							}).open();
						}


					})

				break;

			case "action":
				{
					new ButtonComponent(cell)
						.setIcon("plus-circle")
						// .setButtonText("Action")
						.setClass("project-dashboard-button")
						.onClick(async (event: MouseEvent) => {

							const menu = new Menu();

							menu.addItem((item) => {
								item.setTitle("New meeting")
									.onClick(async () => {
										await this.createMeeting(project)
									});
							});

							menu.addItem((item) => {
								item.setTitle("New issue")
									.onClick(async () => {
										await this.issueTracker.createProjectIssue(project);
									});
							});

							menu.addItem((item) => {
								item.setTitle("New todo")
									.onClick(async () => {
										await this.todoManager.startProjectTodoItem(project);
									});
							});
							menu.showAtMouseEvent(event);
						})

					break;
				}
			case "goto":
				{
					new ButtonComponent(cell)
						.setIcon("square-arrow-up-right")
						// .setButtonText("Action")
						.setClass("project-dashboard-button")
						.onClick(async (event: MouseEvent) => {

							const menu = new Menu();

							menu.addItem((item) => {
								item.setTitle("View todos")
									.onClick(async () => {
										// await this.createMeeting(project)
									});
							});

							menu.addItem((item) => {
								item.setTitle("View issues")
									.onClick(async () => {
										// await this.issueTracker.createProjectIssue(project);
									});
							});

							
							menu.showAtMouseEvent(event);
						})

					break;
				}
			/*case 'newMeeting':
				new ButtonComponent(cell)
					.setButtonText("New meeting")
					.setClass("project-dashboard-button")
					.onClick(async () => {
						await this.createMeeting(project)
					})

				break;

			case 'newIssue':
				new ButtonComponent(cell)
					.setButtonText("New issue")
					.setClass("project-dashboard-button")
					.onClick(async () => {
						await this.issueTracker.createProjectIssue(project);
					})

				break;

			case 'newTodo':
				new ButtonComponent(cell)
					.setButtonText("New todo")
					.setClass("project-dashboard-button")
					.onClick(async () => {
						await this.todoManager.startProjectTodoItem(project);

					})

				break;*/

		}
	}

	private renderGroupHeaderCell(
		cell: HTMLTableCellElement,
		field: ProjectColumnField,
		group: ProjectGroup
	): void {

		const activeCount = group.projects.filter(
			project => this.activeSessionMap.has(project.file.path)).length;

		switch (field) {
			case "collapse":
				{
					// cell.addClass("group-button")
					new ButtonComponent(cell)
						.setIcon(`list-chevrons-up-down`)
						.onClick(async () => {
							// group is collapsed, uncollapse it
							this.collapsedGroups.delete(group.key);
							await this.updateProjectTableRows();
						});
					break
				}
			case "sessionStatus":
				{
					

					if (activeCount === 0) {
						cell.setText("");
						cell.removeClass("small-icon")
					} else if (activeCount === group.projects.length) {
						const indicator = cell.createDiv({ cls: "active-indicator" });
						indicator.createDiv({ cls: "blinky-circle-green" })
						const span = indicator.createSpan();  //⏲
						span.setText("🟢")
						cell.removeClass("small-icon")
					} else {
						// some but not all projects active
						const indicator = cell.createDiv({ cls: "active-indicator" });
						indicator.createDiv({ cls: "blinky-circle-green" })
						const span = indicator.createSpan();  //⏲
						span.setText("🟢")
						cell.addClass("small-icon")
					}
					break;
				}

			// case "project":  // stacking like this means both cases resolve to the code below
			case "primary":
				{
					/*
						Client is being displayed in the Project column because when grouping by client, the client column
						is not included. For the client value to be displayed, it has to get put in a column that IS present, 
						and we're not summarizing the project names so that column is empty anyway
					*/
					// cell.setText(group.label)
					cell.addClass("group-button")
					new ButtonComponent(cell)
						.setButtonText(`${group.label}`)
						.setClass("group-button")
						.onClick(async () => {
							// group is collapsed, uncollapse it
							this.collapsedGroups.delete(group.key);
							await this.updateProjectTableRows();
						});
					break
/*
					cell.addClass("group-button")

					if (this.collapsedGroups.has(group.key)) {
						new ButtonComponent(cell)
							.setButtonText(`[+] ${group.label}`)
							.setClass("group-button")
							.onClick(async () => {
								// group is collapsed, uncollapse it
								this.collapsedGroups.delete(group.key);
								await this.updateProjectTableRows();
							});
					} else {
						new ButtonComponent(cell)
							.setButtonText(`[-] ${group.label}`)
							.setClass("group-button")
							.onClick(async () => {
								// group isn't collapsed, collapse it
								this.collapsedGroups.add(group.key);
								await this.updateProjectTableRows();
							});
					}
					break;
*/

				}

			case "hoursToday":
				{
					const dailyTimeSum = this.timeSummaries.day.client.get(group.key) ?? 0;
					const dailyTimeText = formatMinutesToDuration(dailyTimeSum);
					cell.setText(dailyTimeText);
					cell.addClass("underline")

					break;
				}

			case 'hoursWeek':
				{
					const weekTimeSum = this.timeSummaries.week.client.get(group.key) ?? 0;
					const weekTimeText = formatMinutesToDuration(weekTimeSum);
					cell.setText(weekTimeText);
					cell.addClass("underline")
					break;
				}

			case 'hoursMonth':
				{
					const weekTimeSum = this.timeSummaries.month.client.get(group.key) ?? 0;
					const weekTimeText = formatMinutesToDuration(weekTimeSum);
					cell.setText(weekTimeText);
					cell.addClass("underline")
					break;
				}

			case 'sessionStart':
				break;

			case 'sessionAt':
				break;

			case "action":
				break;

			

		}
	}

	private renderProjectSummaryCell(
		cell: HTMLTableCellElement,
		field: ProjectColumnField,
	): void {
		
		cell.addClass('summary-row')

		switch (field) {
			case "project":
				{  // curly braces needed to avoid warning about "unexpected lexical declaration" because we're defining a const
					cell.setText("All active projects")

					break;
				}

			// case "hoursToday":
			// 	{
			// 		const dailyTimeSum = this.dayTimeSumByPath.get(project.file.path);
			// 		const dailyTimeText = formatMinutesToDuration(dailyTimeSum?.totalMinutes ?? 0);
			// 		cell.setText(dailyTimeText);


			// 		break;
			// 	}

			// case 'hoursWeek':
			// 	{
			// 		const weekTimeSum = this.weekTimeSumByPath.get(project.file.path);
			// 		const weekTimeText = formatMinutesToDuration(weekTimeSum?.totalMinutes ?? 0);
			// 		cell.setText(weekTimeText);

			// 		break;
			// 	}

			case 'sessionStart':
				new ButtonComponent(cell)
					.setButtonText("Stop")
					// .setClass("")
					.onClick(async () => {
						await this.timeTracker.stopAllSessions()
					})

				
				break;

			case 'sessionAt':
				new ButtonComponent(cell)
					.setButtonText("Stop at")
					.onClick(async () => {
						const activeSessions = await this.timeTracker.getActiveSessions()
						const sessionDisplayInfo = activeSessions.map(session => {
							const project = this.projectManager.getProjectInfoByPath(session.projectPath);
							return {
								projectName: project?.name ?? "missing",
								startTime: session.start
							}
						})
						new TimeModal(this.app, {
							mode: 'stop',
							sessions: sessionDisplayInfo,
							onSubmit: async (timestamp: Date) => {

								await this.timeTracker.stopAllSessions(
									timestamp
								);
							}
						}).open();


					})

				break;

			default:
				
				break;

			

		}
	}

	private renderAddProjectRowCell(
		cell: HTMLTableCellElement,
		field: ProjectColumnField,
	): void {

		cell.addClass('summary-row')

		switch (field) {
			case "project":
				{  // curly braces needed to avoid warning about "unexpected lexical declaration" because we're defining a const
					new ButtonComponent(cell)
						.setButtonText("New project...")
						.setClass("new-project-button")
						.onClick(async () => {
							// TODO
							await this.addProject();
							await this.updateProjectTableRows();
						});

					break;
				}

			

			default:

				break;



		}
	}
}

