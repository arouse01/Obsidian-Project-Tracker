import {
	ItemView,
	WorkspaceLeaf,
	ButtonComponent,
	TFile
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	ProjectInfo,
	TimeSession,
	TimeSummary
} from "./types";
import {
	formatTimestamp,
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
	sortItems,
	GroupDefs,
	ColSort,
	TableColumn,
	updateSortButtons,
	getGroupOptions
} from './tableFunctions';


const PROJ_COLS = {
	"status": {
		label: "Status",
		sortable: true,
		groupable: false
	},
	"project": {
		label: "Project",
		sortable: true,
		groupable: true
	},
	"primary": {
		label: "Client",
		sortable: true,
		groupable: true
	},
	"hoursToday": {
		label: "Today",
		sortable: false,
		groupable: false
	},
	"hoursWeek": {
		label: "This week",
		sortable: false,
		groupable: false
	},
	"sessionStart": {
		label: "",
		sortable: false,
		groupable: false
	},
	"sessionAt": {
		label: "",
		sortable: false,
		groupable: false
	},
	"newMeeting": {
		label: "",
		sortable: false,
		groupable: false
	},
	"newIssue": {
		label: "",
		sortable: false,
		groupable: false
	},
	"newTodo": {
		label: "",
		sortable: false,
		groupable: false
	}
} satisfies Record<string, TableColumn>;

// type ProjectColumn = TableColumn

// type ProjectColumnField =
// 	"status" |
// 	"project" |
// 	"primary" |
// 	"hoursToday" |
// 	"hoursWeek" |
// 	"sessionStart" |
// 	"sessionAt" |
// 	"newMeeting" |
// 	"newIssue" |
// 	"newTodo"

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

// const Project_Group_Fields = [
// 	{ value: "none", label: "None" },

// 	...Object.entries(PROJ_COLS)
// 		.filter(([, column]) => column.groupable)
// 		.map(([field, column]) => ({
// 			value: field as ProjectGroupField,
// 			label: column.label
// 		}))
// ] satisfies { value: ProjectGroupField; label: string }[];
// export const Project_Group_Fields = [
// 	{ value: "none", label: "None" },
// 	{ value: "project", label: "Project" },
// 	{ value: "primary", label: "Client" }
// ] as const;


// type ProjectGroup = GroupDefs<ProjectInfo>
interface ProjectGroup {
	key: string;
	label: string;
	projects: ProjectInfo[];
}




// interface ProjectColumn {
// 	field: ProjectColumnField;
// 	label: string;
// 	sortField?: ProjectSortField;
// 	width?: string;
// }


export class ProjectDashboardView extends ItemView {
	private summaryPeriod: SummaryPeriod = "week";  // to drive the summary period selection
	private periodOffset = 0;  // to drive the summary period selection, how far in the past to go

	private projectStatusFilter: "Active" | "All" | "Archived" = "Active";  // to drive which projects are visible

	private projectMap = new Map<string, string>();

	private projectTableEl!: HTMLTableElement;
	private projectTableBodyEl!: HTMLTableSectionElement;
	private summaryTableEl!: HTMLTableElement;
	private summaryTableBodyEl!: HTMLTableSectionElement;
	private rangeText!: HTMLElement;

	private groupBy: ProjectGroupField = "none";
	private sortBy: ProjectSort[] = [
		{ field: "project", dir: "asc" }
	];

	private colOrder: ProjectColumnField[] = [
		"status",
		"project",
		"primary",
		"hoursToday",
		"hoursWeek",
		"sessionStart",
		"sessionAt",
		"newMeeting",
		"newIssue",
		"newTodo"
	]

	private sortButtons = new Map<ProjectColumnField, ButtonComponent>();

	private groupButtons = new Map<ProjectGroupField, ButtonComponent>();

	private activeSessionMap = new Map<string, TimeSession>();

	private activeProjectFilterButton!: ButtonComponent;
	private allProjectFilterButton!: ButtonComponent;
	private archivedProjectFilterButton!: ButtonComponent;

	private refreshInterval: number | null = null;

	private weekStart: Date = window.moment()
		.startOf("week")
		.toDate();
	private weekEnd: Date = window.moment()
		.endOf("week")
		.toDate();
	private weekSummaryTotals!: TimeSummary[]
	private weekTimeSumByPath = new Map<string, TimeSummary> 
		
	
	private dayStart = window.moment()
		.startOf("day")
		.toDate();
	private dayEnd = window.moment()
		.endOf("day")
		.toDate();
	private daySummaryTotals!: TimeSummary[];
	private dayTimeSumByPath = new Map<string, TimeSummary>

	private collapsedGroups = new Set<string>();  // which groups are collapsed in the table

	constructor(
		leaf: WorkspaceLeaf,
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager,
		private issueTracker: IssueTracker,
		private todoManager: TodoManager
	) {
		super(leaf);
	}

	getViewType(): string {
		return "project-dashboard";
	}

	getDisplayText(): string {
		return "Project dashboard";
	}

	getIcon(): string {
		return 'folder-open-dot';
	}

	async onOpen(): Promise<void> {
		this.registerEvent(
			this.timeTracker.on("time-tracker-updated", () => {
				void this.updateProjectTableRows()
			})
		);
		await this.updateSummaryVars();
		this.buildDashboard();
		await this.updateProjectTableRows();

		this.refreshInterval = window.setInterval(() => {
			void this.updateProjectTableRows();
		}, 60000);
		

		const projects = this.projectManager.getProjects();
		this.projectMap = new Map(
			projects.map(project => [project.file.path, project.name])
		);
	}

	async onClose(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	private buildDashboard() {

		const projectSection = this.contentEl.createDiv({cls: "project-section" });
		// projectSection.addClass("project-section")
		projectSection.createEl("h3", {
			text: "Projects"
		});

		const controlSection = projectSection.createDiv({ cls: 'project-controls' });

		

		// Create grouping buttons
		// To add more group options, update Project_Group_Fields in types.ts and add the grouping logic to getGroupKey and getGroupLabel
		const filterSection = controlSection.createDiv({ cls: 'project-controls' });
		filterSection.createEl("label", { text: 'Group by:' })
		for (const group of getGroupOptions(PROJ_COLS)) {
			const button = new ButtonComponent(filterSection)
				.setButtonText(group.label)
				.onClick(async () => {
					this.groupBy = group.value;
					this.collapsedGroups.clear();
					await this.rebuildProjectTable();
				});

			this.groupButtons.set(group.value, button);
		}

		new ButtonComponent(controlSection)
			.setButtonText("New project...")
			.setClass("new-project-button")
			.onClick(async () => {
				// TODO
				await this.addProject();
				await this.updateProjectTableRows();
			});


		const projectTableSection = projectSection.createDiv({ cls: 'project-dashboard' });
		// projectTableSection.addClass('project-dashboard');

		this.projectTableEl = projectTableSection.createEl('table');
		this.projectTableEl.addClass("project-table")

		this.createProjectTableHeaders(this.projectTableEl);

		this.projectTableBodyEl = this.projectTableEl.createEl('tbody')

/*
		const tableProjectHeaderEl = this.projectTableEl.createEl('thead');
		const headerRow1 = tableProjectHeaderEl.createEl('tr');
		headerRow1.createEl('th', { text: '' })
		headerRow1.createEl('th', { text: 'Project',attr: { colspan: 2 } });
		headerRow1.createEl('th', { text: 'Hours worked', attr: { colspan: 2 } });
		headerRow1.createEl('th', { text: 'Session', attr: { colspan: 2 } }); 
		headerRow1.createEl('th', { text: 'Actions', attr: { colspan: 2 } }); 

		const headerRow2 = tableProjectHeaderEl.createEl('tr');
		headerRow2.createEl('th', { text: 'Status' });
		headerRow2.createEl('th', { text: 'Project' });
		headerRow2.createEl('th', { text: 'Client' });
		headerRow2.createEl('th', { text: 'Today' });
		headerRow2.createEl('th', { text: 'This week' });
		headerRow2.createEl('th', { text: '' }); // Start session
		headerRow2.createEl('th', { text: '' }); // Start at
		headerRow2.createEl('th', { text: '' }); // Meeting
		headerRow2.createEl('th', { text: '' }); // Issue
*/
		
		// this.projectTableBodyEl = this.projectTableEl.createEl('tbody');



		const summarySection = this.contentEl.createEl("section");
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
				void this.updateSummaryRows();
			}
		});

		const summaryControlsBottom = summarySection.createDiv();
		summaryControlsBottom.addClass('summary-controls')
		new ButtonComponent(summaryControlsBottom)
			.setButtonText("⏴")
			.setClass("arrow-button")
			.onClick(async () => {
				this.periodOffset--;
				await this.updateSummaryRows();
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
				await this.updateSummaryRows();
			})

		new ButtonComponent(summaryControlsBottom)
			.setButtonText("Now")
			.onClick(async () => {
				this.periodOffset = 0;
				await this.updateSummaryRows();
			})

		// select.style.width = "100%";

		
		const sectionSummaryTableEl = summarySection.createEl('section');
		sectionSummaryTableEl.addClass('project-dashboard');

		this.summaryTableEl = sectionSummaryTableEl.createEl('table');
		this.summaryTableEl.addClass('project-table')
		this.createSummaryHeaders(this.summaryTableEl);


		this.summaryTableBodyEl = this.summaryTableEl.createEl('tbody');
	}

	async updateProjectTableRows(): Promise<void> {
		// specifically for updating the rows without touching the headers
		const newBody = createEl('tbody');
		await this.buildProjectTableBody(newBody);
		this.projectTableBodyEl?.replaceWith(newBody);
		this.projectTableBodyEl = newBody;

		await this.updateSummaryRows();
		await this.updateSummaryVars();
	}

	async rebuildProjectTable(): Promise<void> {
		const newTable = createEl('table')
		this.createProjectTableHeaders(newTable);
		const newBody = newTable.createEl('tbody')
		await this.buildProjectTableBody(newBody);

		this.projectTableEl.replaceWith(newTable);
		this.projectTableEl = newTable;
		this.projectTableBodyEl = newBody;
	}

	private createProjectTableHeaders(table: HTMLTableElement): void {
		const thead = table.createEl('thead');
		const headerRow1 = thead.createEl('tr');
		headerRow1.createEl('th', { text: '' })
		headerRow1.createEl('th', { text: 'Project', attr: { colspan: 2 } });
		headerRow1.createEl('th', { text: 'Hours worked', attr: { colspan: 2 } });
		headerRow1.createEl('th', { text: 'Session', attr: { colspan: 2 } });
		headerRow1.createEl('th', { text: 'Actions', attr: { colspan: 3 } });


		

		const row = thead.createEl('tr');

		for (const [field, column] of this.getVisibleCols()) {
			const header = row.createEl('th');

			// if (column.centered) {
			// 	header.addClass("center-align")
			// }

			if (column.sortable) {
				const button = new ButtonComponent(header)
					// .setButtonText(column.label)
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
		this.updateGroupByButtons(this.groupButtons);
		
		let projects = this.projectManager.getProjects();

		this.projectMap = new Map(
			projects.map(project => [project.file.path, project.name])
		);

		projects = sortItems(
			projects,
			this.sortBy,
			(a, b, field) => this.compareProjects(a, b, field)
		)

		const groups = this.groupProjects(projects)

		// const newTable = createEl('table')
		// this.createTodoTableHeaders(targetTable);


		for (const group of groups) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			if (this.groupBy !== 'none') {
				this.renderGroupHeader(tbody, group);
				if (this.collapsedGroups.has(group.key)) {
					continue;  // skip adding rows if the group is collapsed
				}
			}

			for (const project of group.projects) {
				this.createProjectRow(tbody, project)
			}
		}
		const activeSessions = await this.timeTracker.getActiveSessions();
		if (activeSessions.length > 0) {
			this.createStopRow(tbody)
		}
	}

	// private getProjectGroupOptions(): {
	// 	value: ProjectGroupField;
	// 	label: string;
	// }[] {
	// 	return [
	// 		{ value: "none", label: "None" },
	// 		...Object.entries(PROJ_COLS)
	// 			.filter(([, column]) => column.groupable)
	// 			.map(([field, column]) => ({
	// 				value: field as ProjectGroupField,
	// 				label: column.label
	// 			}))
	// 	];
	// }

	private updateGroupByButtons(groupButtonMap: Map<ProjectGroupField, ButtonComponent>): void {
		for (const [field, button] of groupButtonMap) {
			button.buttonEl.toggleClass(
				"button-selected",
				this.groupBy === field
			)
		}
	}

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

	// private sortProjects(
	// 	projects: ProjectInfo[],
	// 	sorts: ProjectSort[]
	// ): ProjectInfo[] {
	// 	return [...projects].sort((a, b) => {
	// 		for (const sort of sorts) {
	// 			const compare = this.compareProjects(a, b, sort.field);
	// 			if (compare !== 0) {
	// 				return sort.dir === "asc"
	// 					? compare : -compare;

	// 			}
	// 		}
	// 		return 0;
	// 	});
	// }

	private compareProjects(
		a: ProjectInfo,
		b: ProjectInfo,
		field: ProjectColumnField
	): number {
		switch (field) {
			case "status": {
				const statusA = a.status;
				const statusB = b.status;
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

			case "project":
				return String(project.file.path)

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

			case "project":
				return key ? this.projectMap.get(key) ?? "Unknown" : "None";

			default:
				return "";
		}
	}

	private updateFilterButtons(): void {
		this.activeProjectFilterButton.buttonEl.toggleClass(
			"button-selected",
			this.projectStatusFilter === "Active"
		)
		this.allProjectFilterButton.buttonEl.toggleClass(
			"button-selected",
			this.projectStatusFilter === "All"
		)
		this.archivedProjectFilterButton.buttonEl.toggleClass(
			"button-selected",
			this.projectStatusFilter === "Archived"
		)
	}

	private renderGroupHeader(target: HTMLTableSectionElement, group: ProjectGroup) {
		const groupRow = target.createEl('tr');
		const groupCell = groupRow.createEl('td');
		groupCell.colSpan = this.colOrder.length;
		if (this.collapsedGroups.has(group.key)) {
			new ButtonComponent(groupCell)
				.setButtonText(`${group.label} ▶`)
				.setClass("project-dashboard-button")
				.onClick(async () => {
					// group is collapsed, uncollapse it
					this.collapsedGroups.delete(group.key);
					await this.updateProjectTableRows();
				});
		} else {
			new ButtonComponent(groupCell)
				.setButtonText(`${group.label} ▼`)
				.onClick(async () => {
					// group isn't collapsed, collapse it
					this.collapsedGroups.add(group.key);
					await this.updateProjectTableRows();
				});
		}

	}

	private createProjectRow(target: HTMLTableSectionElement, project: ProjectInfo) {
		const row = target.createEl('tr');

		for (const [field, ] of this.getVisibleCols()) {
			const cell = row.createEl("td");

			this.renderCell(cell, field, project);
		}
		
	}

	private createStopRow(target: HTMLTableSectionElement) {
		const row = target.createEl('tr');

		for (const [field, ] of this.getVisibleCols()) {
			const cell = row.createEl("td");
			cell.addClass('summary-row')
			this.renderSummaryCell(cell, field);
		}
		
	}

	private getVisibleCols(): Array<
		[ProjectColumnField, TableColumn]
	> {
		switch (this.groupBy) {
			case 'project':
				this.colOrder = [
					"status",
					"project",
					"primary",
					"hoursToday",
					"hoursWeek",
					"sessionStart",
					"sessionAt",
					"newMeeting",
					"newIssue",
					"newTodo"
				]
				break;
			case 'primary':
				this.colOrder = [
					"status",
					"project",
					"primary",
					"hoursToday",
					"hoursWeek",
					"sessionStart",
					"sessionAt",
					"newMeeting",
					"newIssue",
					"newTodo"
				]
				break;
			case 'none':
				this.colOrder = [
					"status",
					"project",
					"primary",
					"hoursToday",
					"hoursWeek",
					"sessionStart",
					"sessionAt",
					"newMeeting",
					"newIssue",
					"newTodo"
					//"action"
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

		this.weekStart = window.moment()
			.startOf("week")
			.toDate();
		this.weekEnd = window.moment()
			.endOf("week")
			.toDate();
		this.weekSummaryTotals = await this.timeTracker.getTimeSummary(this.weekStart, this.weekEnd);
		this.weekTimeSumByPath = new Map(
			this.weekSummaryTotals.map(summary => [summary.projectPath, summary])
		)
		this.dayStart = window.moment()
			.startOf("day")
			.toDate();
		this.dayEnd = window.moment()
			.endOf("day")
			.toDate();
		this.daySummaryTotals = await this.timeTracker.getTimeSummary(this.dayStart, this.dayEnd);
		this.dayTimeSumByPath = new Map(
			this.daySummaryTotals.map(summary => [summary.projectPath, summary])
		)


	}

	async rebuildSummaryTable(): Promise<void> {
		const newTable = createEl('table');
		this.createSummaryHeaders(newTable);
		const newBody = newTable.createEl('tbody')
		await this.buildSummaryTableBody(newBody);

		this.projectTableEl.replaceWith(newTable);
		this.projectTableEl = newTable;
		this.projectTableBodyEl = newBody;
	}

	createSummaryHeaders(table: HTMLTableElement) {
		
		table.addClass('project-table')
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');

		if (this.summaryPeriod === "month") {
			headerRow.createEl('th', { text: 'Project' });
			headerRow.createEl('th', { text: 'Time' });
		} else {
			headerRow.createEl('th', { text: 'Project' });

			headerRow.createEl('th', { text: 'Sunday' });
			headerRow.createEl('th', { text: 'Monday' });
			headerRow.createEl('th', { text: 'Tuesday' });
			headerRow.createEl('th', { text: 'Wednesday' });
			headerRow.createEl('th', { text: 'Thursday' });
			headerRow.createEl('th', { text: 'Friday' });
			headerRow.createEl('th', { text: 'Saturday' });

			headerRow.createEl('th', { text: 'Total' });
			
		}

		this.summaryTableBodyEl = this.summaryTableEl.createEl('tbody');
	}

	async updateSummaryRows(): Promise<void> {
		// function for updating the rows without touching the headers
		
		// create temporary body for table, then fill it and swap for the current one instead of clearing the whole thing
		const newBody = createEl('tbody')
		await this.buildSummaryTableBody(newBody);
		
		this.summaryTableBodyEl.replaceWith(newBody);
		this.summaryTableBodyEl = newBody;
	}

	async buildSummaryTableBody(tbody: HTMLTableSectionElement): Promise<void> {
		// update the body of the table only and return the updated table for actual loading into the ui
		const { start, end } = getSummaryPeriod(this.periodOffset, this.summaryPeriod);

		let dateRangeText: string;
		if (this.summaryPeriod === "week") {
			dateRangeText = `${window.moment(start).format("MMM DD")} - ${window.moment(end).format("MMM DD")}`
		} else {
			dateRangeText = window.moment(start).format("MMMM YYYY")
		}
		this.rangeText.setText(dateRangeText);

		if (this.summaryPeriod === "month") {
			const summaryTotals = await this.timeTracker.getTimeSummaryByClient(start, end);
			/*
				summaryTotals are returned as array of TimeSummary objects 
				which is projectPath (string) and totalMinutes (number), so 
				we have to loop through and assign to the table
			*/
			for (const timeSum of summaryTotals) {

				// create row skeleton, and assign values to objects after (for cleaner visual code organization)
				const row = tbody.createEl('tr');

				const clientCell = row.createEl('td');
				const totalCell = row.createEl('td');

				const clientName = timeSum.client;
				clientCell.setText(clientName);

				const durationText = formatMinutesToDuration(timeSum.totalMinutes);
				totalCell.setText(durationText)

			}
		} else {
			const weeklyTotals = await this.timeTracker.getWeeklySummary(start);
			
			for (const [projectPath, dailyMinutes] of weeklyTotals.projects) {
				const row = tbody.createEl('tr');

				// Project
				const projectCell = row.createEl("td")
				projectCell.setText(projectPath);

				for (const day of weeklyTotals.days) {
					const dateStr = formatDate(day);
					const minutes = dailyMinutes.get(dateStr) ?? 0;

					const cell = row.createEl("td");
					cell.setText(formatMinutesToDuration(minutes, true))
				}
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
		const creationTS = formatTimestamp();
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
		project: ProjectInfo
	): void {
		const activeSession = this.activeSessionMap.get(project.file.path);

		switch (field) {
			case "status":
				{
					
					// const isActive = activePaths.has(project.file.path);
					if (activeSession) {
						cell.setText("🟢");  //⏲
					} else {
						cell.setText("");
					}
					break;
				}

			case "project":
				{  // curly braces needed to avoid warning about "unexpected lexical declaration" because we're defining a const
					const projectLink = cell.createEl("a", { text: project.name });
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
					const file = this.app.vault.getAbstractFileByPath(project.file.path);
					let client: string = '';
					if (file instanceof TFile) {
						client = this.projectManager.getFrontmatterString(file, "Primary").replace(/^\[\[|\]\]$/g, "")
					}
					cell.setText(client);

					break;
				}

			case "hoursToday":
				{
					const dailyTimeSum = this.dayTimeSumByPath.get(project.file.path);
					const dailyTimeText = formatMinutesToDuration(dailyTimeSum?.totalMinutes ?? 0);
					cell.setText(dailyTimeText);

					
					break;
				}

			case 'hoursWeek':
				{
					const weekTimeSum = this.weekTimeSumByPath.get(project.file.path);
					const weekTimeText = formatMinutesToDuration(weekTimeSum?.totalMinutes ?? 0);
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

			case 'newMeeting':
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

				break;

		}
	}

	private renderSummaryCell(
		cell: HTMLTableCellElement,
		field: ProjectColumnField,
	): void {
		// const activeSession = this.activeSessionMap.get(project.file.path);
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
							const project = this.projectManager.findProjectByPath(session.projectPath);
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
/*
	private updateSortButtons(): void {

		for (const [col, button] of this.sortButtons) {
			const sort = this.sortBy.find(s => s.field === col.sortField);
			const sortIndex = this.sortBy.findIndex((sort) => sort.field === col.sortField);
			let text = col.label;
			if (sort?.dir === "asc") {
				text += " ▲"
			} else if (sort?.dir === "desc") {
				text += " ▼"
			}
			if (sort?.dir) {
				;
				text += (sortIndex + 1)
			}

			button.setButtonText(text);
		}
	}

	private getSummaryPeriod(periodOffset: number, summaryPeriod: SummaryPeriod): { start: Date; end: Date } {
		const start = window.moment()
			.add(periodOffset, summaryPeriod)
			.startOf(summaryPeriod)
			.toDate();

		const end = window.moment()
			.add(periodOffset, summaryPeriod)
			.endOf(summaryPeriod)
			.toDate();

		return { start, end };
	}
*/

	/*
	async updateProjects(): Promise<void> {
		this.updateFilterButtons();

		let projects: ProjectInfo[];
		if (this.projectStatusFilter === "Active") {
			projects = this.projectManager.getActiveProjects();
		} else if (this.projectStatusFilter === "Archived") {
			projects = this.projectManager.getArchivedProjects();
		} else {
			projects = this.projectManager.getProjects();
		}

		await this.updateSummaryVars();

		const activeSessions = await this.timeTracker.getActiveSessions();
		this.activeSessionMap = new Map(
			activeSessions.map(session => [session.projectPath, session])
		);
		const newBody = createEl('tbody'); // new object to store table before moving it entirely into the window so there's no flicker as the table is rebuilt

		

		for (const project of projects) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			const row = newBody.createEl('tr');

			const statusCell = row.createEl('td');
			const projectCell = row.createEl('td');
			const clientCell = row.createEl('td');
			const dailyHoursCell = row.createEl('td');
			const weeklyHoursCell = row.createEl('td');
			
			const startCell = row.createEl('td');
			const startAtCell = row.createEl('td');
			const meetingCell = row.createEl('td');
			const issueCell = row.createEl('td');

			statusCell.addClass("time-dashboard-centered");
			const activeSession = this.activeSessionMap.get(project.file.path);
			// const isActive = activePaths.has(project.file.path);
			if (activeSession) {
				statusCell.setText("🟢");  //⏲
			} else {
				statusCell.setText("");
			}

			// projectCell.setText(project.name);
			const projectLink = projectCell.createEl("a", { text: project.name });
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
			}
			)

			const file = this.app.vault.getAbstractFileByPath(project.file.path);
			let client: string = '';
			if (file instanceof TFile) {
				client = this.projectManager.getFrontmatterString(file, "Primary").replace(/^\[\[|\]\]$/g, "")
			}
			clientCell.setText(client);

			const dailyTimeSum = dayTimeSumByPath.get(project.file.path);
			const dailyTimeText = formatMinutesToDuration(dailyTimeSum?.totalMinutes ?? 0);
			dailyHoursCell.setText(dailyTimeText);

			const weekTimeSum = weekTimeSumByPath.get(project.file.path);
			const weekTimeText = formatMinutesToDuration(weekTimeSum?.totalMinutes ?? 0);
			weeklyHoursCell.setText(weekTimeText);
			

			startCell.addClass("time-dashboard-centered");
			new ButtonComponent(startCell)
				.setButtonText(activeSession ? "Stop" : "Start")
				.setClass("project-dashboard-button")
				.onClick(async () => {
					if (activeSession) {
						await this.timeTracker.stopProjectSession(project)
					} else {
						await this.timeTracker.startProjectSession(project)
					}
				})

			new ButtonComponent(startAtCell)
				.setButtonText(activeSession ? "Stop at" : "Start at")
				.setClass("project-dashboard-button")
				.onClick(async () => {
					if (activeSession) {
						new TimeModal(this.app, {
							mode: 'stop',
							projectPath: project.file.path,
							sessionStart: activeSession.start,
							onSubmit: async (timestamp: Date) => {
								await this.timeTracker.stopProjectSession(
									project,
									timestamp
								);
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
							}
						}).open();
					}

				})

			new ButtonComponent(meetingCell)
				.setButtonText("New meeting")
				.setClass("project-dashboard-button")
				.onClick(async () => {
					await this.createMeeting(project)
				})

			new ButtonComponent(issueCell)
				.setButtonText("New issue")
				.setClass("project-dashboard-button")
				.onClick(async () => {
					await this.issueTracker.createProjectIssue(project)
					
				})
		}
		// this.projectTableBodyEl.empty();


		this.projectTableBodyEl.replaceWith(newBody);
		this.projectTableBodyEl = newBody;

	}
	*/
}

