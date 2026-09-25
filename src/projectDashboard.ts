import {
	App,
	Menu,
	Component,
	ButtonComponent,
	TFile
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	ProjectInfo,
	// ProjectStatus,
	// RawTimeSession,
	SessionData,
	TimeSummaryStore
} from "./types";
import {
	formatMinutesToDuration,
	formatDate,
	normalizeWikiLink,
	getFrontmatterString
} from './utils';
import { TimeTracker } from './timeTracker';
import { TimeModal } from './timeModal';
import { IssueTracker } from './issueTracker';
import { TodoManager } from './todoTracker';
import {
	GroupPosition,
	sortItems,
	// ColSort,
	TableColumn,
	updateSortButtons,
	getGroupOptions,
	createTableColGroup
} from './tableFunctions';
import {
	PROJ_COLS,
	ProjectColumnField,
	ProjectGroup,
	ProjectGroupField,
	ProjectSort
} from './tableConstants'
import {
	PROJECT_DASHBOARD_VIEW_TYPE,
} from "./constants"
import { TimeSummaryTable } from './timeSummaryTable'


const PROJECT_STATUS_FILTERS = ["Active", "All", "Archived"] as const;
type ProjectStatusFilter = typeof PROJECT_STATUS_FILTERS[number];

export class ProjectDashboardView extends Component {
	// private container: HTMLElement;

	private summaryTable!: TimeSummaryTable;
	// private projectMap = new Map<string, string>();

	private projectTableEl!: HTMLTableElement;
	private projectTableBodyEl!: HTMLTableSectionElement;

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
		// "sessionAt",
		"action"
	]

	private sortButtons = new Map<ProjectColumnField, ButtonComponent>();

	// private groupButtons = new Map<ProjectGroupField, ButtonComponent>();

	// private filterOptions = new Map<ProjectStatusFilter, ButtonComponent>();

	private activeSessionMap = new Map<string, SessionData>();

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
			cls: 'dropdown-new'
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
		groupingSection.addClass("right-align")
		// groupingSection.addClass("control-row")
		groupingSection.createEl("label", { text: 'Group by:' })
		const groupSelect = groupingSection.createEl('select', {
			cls: 'dropdown-new'
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
		
		const projectTableSection = projectSection.createDiv({ cls: 'project-section' });
		projectTableSection.addClass('project-dashboard');
		projectTableSection.addClass('dashboard');

		this.projectTableEl = projectTableSection.createEl('table');
		this.projectTableEl.addClass("dashboard-table")
		const columns = this.getVisibleCols();
		createTableColGroup(this.projectTableEl, columns);
		this.createProjectTableHeaders(this.projectTableEl, columns);

		this.projectTableBodyEl = this.projectTableEl.createEl('tbody')

		// Summary table below the main one
		const summarySection = dashboardContainer.createDiv({ cls: "project-section" });
		summarySection.createEl("h1", {
			text: "Statistics"
		});

		summarySection.addClass('project-dashboard')
		this.summaryTable = new TimeSummaryTable(
			this.timeTracker,
			this.projectManager,
			summarySection,
			{
				period: "week",
				offset: 0,
				summaryFormat: "full"
			}
		)
		// this.summaryTable = new TimeSummaryTable(this.timeTracker, this.projectManager, summarySection, "week", 0)
	}

	async updateProjectTableRows(): Promise<void> {
		// specifically for updating the rows without touching the headers
		await this.summaryTable.updateSummaryRows();
		await this.updateSummaryVars();

		const newBody = createEl('tbody');
		await this.buildProjectTableBody(newBody);
		this.projectTableBodyEl?.replaceWith(newBody);
		this.projectTableBodyEl = newBody;

		
	}

	async rebuildProjectTable(): Promise<void> {
		const newTable = createEl('table')
		newTable.addClass("dashboard-table")
		const columns = this.getVisibleCols();
		createTableColGroup(newTable, columns);
		this.createProjectTableHeaders(newTable, columns);
		const newBody = newTable.createEl('tbody')
		await this.buildProjectTableBody(newBody);

		this.projectTableEl.replaceWith(newTable);
		this.projectTableEl = newTable;
		this.projectTableBodyEl = newBody;
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
				header.addClass("left-align")
			}


			if (column.sortable) {
				const button = new ButtonComponent(header)
					.setClass("dashboard")
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
					this.renderCollapsedGroupRow(tbody, group);
					continue;  // skip adding rows if the group is collapsed
				}
			}

			for (const [index, project] of group.projects.entries()) {
				let groupPos: GroupPosition = null;
				if (this.groupBy !== 'none') {
					if (index === 0) {
						groupPos = "first";
					} else if (index === group.projects.length - 1) {
						groupPos = "last"
					} else {
						groupPos = "middle"
					}
				}
				
				this.createProjectRow(
					tbody,
					project,
					groupPos
				);
			}
		}
		

		const activeSessions = await this.timeTracker.getActiveSessions();
		if (activeSessions.length > 0) {
			this.createStopRow(tbody)
		}
		this.createNewProjectRow(tbody)
	}

	private createNewProjectRow(target: HTMLTableSectionElement) {
		const row = target.createEl('tr');
		row.addClass('summary-row')
		for (const [field,] of this.getVisibleCols()) {
			const cell = row.createEl("td");
			cell.addClass('group-row')
			cell.addClass('summary-row')
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

	private renderCollapsedGroupRow(target: HTMLTableSectionElement, group: ProjectGroup) {
		const groupRow = target.createEl('tr');
		groupRow.addClass("first")
		groupRow.addClass("group-row")
		for (const [field,] of this.getVisibleCols()) {

			const cell = groupRow.createEl("td");
			
			this.renderCollapsedGroupCell(cell, field, group);
		}
	}

	private createProjectRow(
		target: HTMLTableSectionElement,
		project: ProjectInfo,
		groupPos: GroupPosition = null,
	) {
		const row = target.createEl('tr');
		if (groupPos === "first") {
			row.addClass("first")
		}
		for (const [field, ] of this.getVisibleCols()) {

			const cell = row.createEl("td");

			this.renderCell(cell, field, project, groupPos);
		}
		
	}

	private createStopRow(target: HTMLTableSectionElement) {
		const row = target.createEl('tr');
		row.addClass('summary-row')
		for (const [field, ] of this.getVisibleCols()) {
			const cell = row.createEl("td");
			cell.addClass('group-row')
			// cell.addClass('summary-row')
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
					// "sessionAt",
					// "sessionAdd",
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
					// "sessionAt",
					// "sessionAdd",
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

	private async updateSummaryVars() {
		const activeSessions = await this.timeTracker.getActiveSessions();
		this.activeSessionMap = new Map(
			activeSessions.map(session => [session.projectPath, session])
		);

		// const start = window.moment()
		// 	.startOf("month")
		// 	.toDate();
		// const end = window.moment()
		// 	.endOf("month")
		// 	.toDate();
		this.timeSummaries = await this.timeTracker.getCurrentTimeSummaries();
		/*// this.weekTimeByPath = new Map(
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
*/
		// this.timeSummaries.day.project = new Map(
		// 	summaryTotals.map(summary => [
		// 		summary.key,
		// 		summary.totalMinutes
		// 	])
		// );
		// this.timeSummaries.day.client = new Map(
		// 	dayClientSummaryTotals.map(summary => [
		// 		summary.key,
		// 		summary.totalMinutes
		// 	])
		// );
		// this.timeSummaries.week.project = new Map(
		// 	weekSummaryTotals.map(summary => [
		// 		summary.key,
		// 		summary.totalMinutes
		// 	])
		// );
		// this.timeSummaries.week.client = new Map(
		// 	weekClientSummaryTotals.map(summary => [
		// 		summary.key,
		// 		summary.totalMinutes
		// 	])
		// );
		// this.timeSummaries.month.project = new Map(
		// 	monthSummaryTotals.map(summary => [
		// 		summary.key,
		// 		summary.totalMinutes
		// 	])
		// );
		// this.timeSummaries.month.client = new Map(
		// 	monthClientSummaryTotals.map(summary => [
		// 		summary.key,
		// 		summary.totalMinutes
		// 	])
		// );

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
		await this.projectManager.addNewProject()

	}

	/*
	Responsible for setting a given cell with its appropriate value given the record it's on and the column
	*/
	private renderCell(
		cell: HTMLTableCellElement,
		field: ProjectColumnField,
		project: ProjectInfo,
		groupPos: GroupPosition
	): void {
		const activeSession = this.activeSessionMap.get(project.file.path);

		switch (field) {
			case "collapse":
				{
					cell.addClass("group-member")
					switch (groupPos) {
						case "first":
							{
								cell.addClass("first")
								new ButtonComponent(cell)
									// .setIcon(`list-chevrons-down-up`)
									.setButtonText("⊟")
									// .setClass("first")
									.onClick(async () => {
										// group isn't collapsed, collapse it
										const groupKey = this.getGroupKey(project)
										this.collapsedGroups.add(groupKey);
										await this.updateProjectTableRows();
									});
								// const wrapper = cell.createDiv({ cls: "group-tree-wrapper" })
								// wrapper.createSpan({ cls: "group-tree-line-first" })
								break;
							}
						case "middle":
							{
								const wrapper = cell.createDiv({ cls: "group-tree-wrapper" })
								wrapper.createSpan({ cls: "group-tree-line" })
								wrapper.createSpan({ cls: "group-tree-branch" })
								// cell.createDiv({ cls: "group-tree-line" })
								// 	.setText("├")
								// cell.addClass("group-tree-line")
								// cell.setText("|");
								// cell.addClass("group-member");
								break;
							}
						case "last":
							{
								const wrapper = cell.createDiv({ cls: "group-tree-wrapper" })
								wrapper.createSpan({ cls: "group-tree-line-last" })
								wrapper.createSpan({ cls: "group-tree-branch" })
								// wrapper.createDiv({ cls: "group-tree-line" })
									// .setText("└");
								// cell.addClass("group-member");
								break;
							}
						default:
							break;
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
					cell.addClass("left-align")
					new ButtonComponent(cell)
						.setButtonText(project.name)
						.setClass("left-align")
						.onClick(async (event) => {
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
					// if (groupPos === "first") {
						cell.addClass("left-align")
						const groupKey = this.getGroupKey(project)
						new ButtonComponent(cell)
							.setButtonText(`${this.getGroupLabel(groupKey)}`)
							.setClass("left-align")
							.onClick(async () => {
								// group isn't collapsed, collapse it
								
								this.collapsedGroups.add(groupKey);
								await this.updateProjectTableRows();
							});

					// }
					if (this.groupBy !== field) {
						const file = this.app.vault.getAbstractFileByPath(project.file.path);
						let client: string = '';
						if (file instanceof TFile) {
							client = getFrontmatterString(this.app.metadataCache, file, "Primary").replace(/^\[\[|\]\]$/g, "")
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
					const monthTimeSum = this.timeSummaries.month.project.get(project.file.path) ?? 0;
					const monthTimeText = formatMinutesToDuration(monthTimeSum);
					cell.setText(monthTimeText);
					break;
				}

			case 'sessionStart': {
				const button = new ButtonComponent(cell)
					.setButtonText(activeSession ? "Stop" : "Start")
					.setClass("dashboard")
					.onClick(async () => {
						if (activeSession) {
							await this.timeTracker.stopSessions(undefined, project )
						} else {
							await this.timeTracker.startProjectSession(project)
						}
						void this.updateProjectTableRows()
					})
				button.buttonEl.addEventListener("contextmenu", (event) => {
					event.preventDefault();

					// right-click menu
					const menu = new Menu();

					menu.addItem((item) => {
						item.setTitle(activeSession ? "Stop at" : "Start at")
							.onClick(async () => {
								if (activeSession) {
									new TimeModal(this.app, {
										mode: 'stop',
										session: {
											projectName: project.name,
											startTime: activeSession.start
										},
										onSubmit: async (timestamp: Date) => {
											await this.timeTracker.stopSessions(
												timestamp,
												project
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
							});
					});

					menu.addItem((item) => {
						item.setTitle("Add session")
							.onClick(async () => {
								new TimeModal(this.app, {
									mode: 'add',
									projectPath: project.file.path,
									onSubmit: async (startTimestamp: Date, stopTimestamp: Date) => {
										await this.timeTracker.addCompleteSession(
											project,
											startTimestamp,
											stopTimestamp
										);
										void this.updateProjectTableRows()
									}
								}).open();
							});
					});

					menu.showAtMouseEvent(event);
				})
				break;
			}

			case 'sessionAt':
				new ButtonComponent(cell)
					.setButtonText(activeSession ? "Stop at" : "Start at")
					.setClass("dashboard")
					.onClick(async () => {
						if (activeSession) {
							new TimeModal(this.app, {
								mode: 'stop',
								session: {
									projectName: project.name,
									startTime: activeSession.start
								},
								onSubmit: async (timestamp: Date) => {
									await this.timeTracker.stopSessions(
										timestamp,
										project
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

			case 'sessionAdd':
				new ButtonComponent(cell)
					.setButtonText("Add session")
					.setClass("button")
					.onClick(async () => {

						new TimeModal(this.app, {
							mode: 'add',
							projectPath: project.file.path,
							onSubmit: async (startTimestamp: Date, stopTimestamp: Date) => {
								await this.timeTracker.addCompleteSession(
									project,
									startTimestamp,
									stopTimestamp
								);
								void this.updateProjectTableRows()
							}
						}).open();
					})

				break;
			case "action":
				{
					new ButtonComponent(cell)
						.setIcon("plus-circle")
						// .setButtonText("Action")
						.setClass("dashboard")
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
										await this.issueTracker.createNewIssue(project);
									});
							});

							menu.addItem((item) => {
								item.setTitle("New todo")
									.onClick(async () => {
										await this.todoManager.startTodoItem(project);
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
						.setClass("dashboard")
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
					.setClass("dashboard")
					.onClick(async () => {
						await this.createMeeting(project)
					})

				break;

			case 'newIssue':
				new ButtonComponent(cell)
					.setButtonText("New issue")
					.setClass("dashboard")
					.onClick(async () => {
						await this.issueTracker.createProjectIssue(project);
					})

				break;

			case 'newTodo':
				new ButtonComponent(cell)
					.setButtonText("New todo")
					.setClass("dashboard")
					.onClick(async () => {
						await this.todoManager.startProjectTodoItem(project);

					})

				break;*/

		}
	}

	private renderCollapsedGroupCell(
		cell: HTMLTableCellElement,
		field: ProjectColumnField,
		group: ProjectGroup
	): void {

		const activeCount = group.projects.filter(
			project => this.activeSessionMap.has(project.file.path)).length;

		switch (field) {
			case "collapse":
				{
					cell.addClass("group-member")
					cell.addClass("first")
					new ButtonComponent(cell)
						// .setIcon(`list-chevrons-down-up`)
						.setButtonText('⊞')
						// .setClass("first")
						.onClick(async () => {
							// group is collapsed, uncollapse it
							this.collapsedGroups.delete(group.key);
							await this.updateProjectTableRows();
						});
					break;
					
					/*new ButtonComponent(cell)
						// .setIcon(`list-chevrons-up-down`)
						
						.onClick(async () => {
							
						});
					break*/
				}
			case "sessionStatus":
				{
					

					if (activeCount === 0) {
						cell.setText("");
					/*} else if (activeCount === group.projects.length) {
						const indicator = cell.createDiv({ cls: "active-indicator" });
						indicator.createDiv({ cls: "blinky-circle-green" })
						const span = indicator.createSpan();  //⏲
						span.setText("🟢")*/
					} else {
						// some but not all projects active
						const indicator = cell.createDiv({ cls: "active-indicator" });
						indicator.createDiv({ cls: "blinky-circle-green" })
						const span = indicator.createSpan();  //⏲
						span.setText("🟢")
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
					cell.addClass("left-align")
					new ButtonComponent(cell)
						.setButtonText(`${group.label}`)
						.setClass("left-align")
						.onClick(async () => {
							// group is collapsed, uncollapse it
							this.collapsedGroups.delete(group.key);
							await this.updateProjectTableRows();
						});
					break
/*
					cell.addClass("left-align")

					if (this.collapsedGroups.has(group.key)) {
						new ButtonComponent(cell)
							.setButtonText(`[+] ${group.label}`)
							.setClass("left-align")
							.onClick(async () => {
								// group is collapsed, uncollapse it
								this.collapsedGroups.delete(group.key);
								await this.updateProjectTableRows();
							});
					} else {
						new ButtonComponent(cell)
							.setButtonText(`[-] ${group.label}`)
							.setClass("left-align")
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

			case 'sessionStart': {
				const button = new ButtonComponent(cell)
					.setButtonText("Stop")
					// .setClass("")
					.onClick(async () => {
						await this.timeTracker.stopSessions()
					})

				button.buttonEl.addEventListener("contextmenu", (event) => {
					event.preventDefault();

					// right-click menu
					const menu = new Menu();

					menu.addItem((item) => {
						item.setTitle("Stop at")
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
									mode: 'stopAll',
									sessions: sessionDisplayInfo,
									onSubmit: async (timestamp: Date) => {

										await this.timeTracker.stopSessions(timestamp);
									}
								}).open();

							});
						menu.showAtMouseEvent(event);
					});
				})

				break;
			}

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
							session: sessionDisplayInfo[0]!,
							onSubmit: async (timestamp: Date) => {

								await this.timeTracker.stopSessions(timestamp);
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
						.setClass("right-align")
						.onClick(async () => {
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

