import {
	ItemView,
	WorkspaceLeaf,
	ButtonComponent,
	TFile,
	Menu
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	formatMinutesToDuration,
	normalizeWikiLink
} from './utils';
import {
	ProjectInfo,
	TimeSummary,
	SessionData,
	TimeSummaryStore
} from './types'
import { TimeTracker } from './timeTracker';
import { TimeModal } from './timeModal';
import {
	TIME_DASHBOARD_VIEW_TYPE
} from "./constants"
import {
	TableColumn,
	updateSortButtons,
	createTableColGroup,
	sortItems,
	GroupPosition
} from './tableFunctions';
import {
	TIME_COLS,
	TimeColumnField,
	TimeSort,
	ProjectGroup,
	ProjectColumnField
	
} from "./tableConstants"
import { TimeSummaryTable } from './timeSummaryTable'


export class TimeDashboardView extends ItemView {
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
	private sortBy: TimeSort[] = [
		{ field: "project", dir: "asc" }
	];
	private sortButtons = new Map<TimeColumnField, ButtonComponent>();

	private groupBy: string = "primary";

	private summaryPeriod: "week" | "month" = "week";  // to drive the summary period selection
	private periodOffset = 0;  // to drive the summary period selection, how far in the past to go

	private projectTableBodyEl!: HTMLTableSectionElement;
	private summaryTableBodyEl!: HTMLTableSectionElement;
	// private rangeText!: HTMLElement;

	private summaryTable!: TimeSummaryTable;

	private refreshInterval: number | null = null;

	private activeSessionMap = new Map<string, SessionData>();

	// private dayTimeSumByPath = new Map<string, TimeSummary>

	constructor(
		leaf: WorkspaceLeaf,
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager
	) {
		super(leaf);
	}

	getViewType(): string {
		return TIME_DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Time dashboard";
	}

	getIcon(): string {
		return 'clock';
	}

	async onOpen(): Promise<void> {
		this.registerEvent(
			this.timeTracker.on("time-tracker-updated", () => {
				void this.updateDashboard()
			})
		);

		await this.buildDashboard();
		await this.updateDashboard();

		this.refreshInterval = window.setInterval(() => {
			void this.updateDashboard();
		}, 60000);
	}

	async onClose(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	private async buildDashboard() {
		const controlSection = this.contentEl.createEl("section");
		controlSection.addClass('dashboard');
		controlSection.addClass('font-size-12');

		const title = controlSection.createEl("h1", {
			text: "Time tracker",
		});
		title.addClass("text-centered");

		const tableMainEl = controlSection.createEl('table');
		tableMainEl.addClass('dashboard-table')
		tableMainEl.addClass('time-table')

		// create colgroup so we can specify column sizes
		const timeCols = this.getVisibleCols()
		createTableColGroup(tableMainEl, timeCols)

		this.createTimeTableHeaders(tableMainEl, timeCols)

		this.projectTableBodyEl = tableMainEl.createEl('tbody');
		
		// Summary table creation
		
		const summarySection = this.contentEl.createDiv("section");
		summarySection.addClass("dashboard")
		const subtitle = summarySection.createEl("h3", {
			text: "By client"
		});
		subtitle.addClass("text-centered");

		summarySection.addClass('font-size-12')

		this.summaryTable = new TimeSummaryTable(this.timeTracker, this.projectManager, summarySection, "week", 0, "sidebar")
		
	}

	async updateDashboard(): Promise<void> {
		await this.updateTimeRows();
		await this.summaryTable?.updateSummaryRows();
	}

	private getVisibleCols(): Array<
		[TimeColumnField, TableColumn]
		> {
		const colOrder: TimeColumnField[] = [
			"sessionStatus",
			"project",
			"hoursToday",
			"hoursWeek",
			"sessionStart"
		]
				
		return colOrder.map(field => [
			field,
			TIME_COLS[field]
		])

	}

	private createTimeTableHeaders(
		table: HTMLTableElement,
		columns: Array<[TimeColumnField, TableColumn]>
	): void {
		const thead = table.createEl('thead');
		const row = thead.createEl('tr');

		for (const [field, column] of columns) {
			const header = row.createEl('th');

			if (!column.centered) {
				header.addClass("left-align")
			}

			if (column.sortable) {
				const button = new ButtonComponent(header)
					// .setButtonText(column.label)
					// .setClass("todo-dashboard-button")
					.onClick(async () => {
						// group is collapsed, uncollapse it
						this.updateSort(field);
						await this.updateTimeRows();
					});
				this.sortButtons.set(field, button);
			} else {
				header.setText(column.label)
			}
		}
		updateSortButtons(this.sortButtons, this.sortBy, TIME_COLS);
	}

	private updateSort(field: TimeColumnField) {
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


		updateSortButtons(this.sortButtons, this.sortBy, TIME_COLS);

	}

	async updateSummaries(): Promise<void> {
		const activeSessions = await this.timeTracker.getActiveSessions();
		this.activeSessionMap = new Map(
			activeSessions.map(session => [session.projectPath, session])
		);

		// const weekStart = window.moment().startOf("week").toDate();
		// const weekEnd = window.moment().endOf("week").toDate();
		// const weekSummaryTotals = await this.timeTracker.getTimeSummary(weekStart, weekEnd);
		// const weekClientSummaryTotals = await this.timeTracker.getTimeSummaryByClient(weekStart, weekEnd);

		// const dayStart = window.moment().startOf("day").toDate();
		// const dayEnd = window.moment().endOf("day").toDate();
		// const daySummaryTotals = await this.timeTracker.getTimeSummary(dayStart, dayEnd);
		// const dayClientSummaryTotals = await this.timeTracker.getTimeSummaryByClient(dayStart, dayEnd);

		// const monthStart = window.moment().startOf("month").toDate();
		// const monthEnd = window.moment().endOf("month").toDate();
		// const monthSummaryTotals = await this.timeTracker.getTimeSummary(monthStart, monthEnd);
		// const monthClientSummaryTotals = await this.timeTracker.getTimeSummaryByClient(monthStart, monthEnd);

		this.timeSummaries = await this.timeTracker.getCurrentTimeSummaries();
		// this.timeSummaries.day.project = new Map(
		// 	daySummaryTotals.map(summary => [
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

	async updateTimeRows(): Promise<void> {
		//const projects = this.projectManager.getActiveProjects();
		await this.updateSummaries();

		const newBody = createEl('tbody')

		await this.buildTimeTableBody(newBody)

		this.projectTableBodyEl?.replaceWith(newBody);
		this.projectTableBodyEl = newBody;

	}

	private async buildTimeTableBody(tbody: HTMLTableSectionElement): Promise<void> {

		let projects = this.projectManager.getActiveProjects();

		projects = sortItems(
			projects,
			this.sortBy,
			(a, b, field) => this.compareProjects(a, b, field)
		)

		const groups = this.groupProjects(projects)

		for (const group of groups) {
			// this.createSummaryRow(
			// 	tbody,
			// 	group
			// );

			for (const [index, project] of group.projects.entries()) {
				let groupPos: GroupPosition = null;
				if (index === 0) {
					groupPos = "first";
				} else if (index === group.projects.length - 1) {
					groupPos = "last"
				} else {
					groupPos = "middle"
				}
				

				this.createTimeRow(
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

	}

	private createSummaryRow(
		target: HTMLTableSectionElement,
		project: ProjectGroup
	) {
		const row = target.createEl('tr');
		
			row.addClass("first")
		

		for (const [field,] of this.getVisibleCols()) {

			const cell = row.createEl("td");

			this.renderGroupCell(cell, field, project);
		}

	}

	private createTimeRow(
		target: HTMLTableSectionElement,
		project: ProjectInfo,
		groupPos: GroupPosition = null) {

		const row = target.createEl('tr');
		
		for (const [field,] of this.getVisibleCols()) {

			const cell = row.createEl("td");

			this.renderTimeCell(cell, field, project, groupPos);
		}

	}

	private createStopRow(target: HTMLTableSectionElement) {
		const row = target.createEl('tr');

		for (const [field,] of this.getVisibleCols()) {
			const cell = row.createEl("td");
			cell.addClass('summary-row')
			this.renderTimeStopRowCell(cell, field);
		}
		
	}

	private renderTimeCell(
		cell: HTMLTableCellElement,
		field: TimeColumnField,
		project: ProjectInfo,
		groupPos: GroupPosition
	): void {
		const activeSession = this.activeSessionMap.get(project.file.path);

		switch (field) {
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
					// cell.addClass("left-align")
					// cell.addClass("left-indent")
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

			
			case "hoursToday":
				{
					const dailyTimeSum = this.timeSummaries.day.project.get(project.file.path) ?? 0;
					const dailyTimeText = formatMinutesToDuration(dailyTimeSum);
					cell.setText(dailyTimeText);
					break;
				}

			case "hoursWeek":
				{
					const weekTimeSum = this.timeSummaries.week.project.get(project.file.path) ?? 0;
					const weekTimeText = formatMinutesToDuration(weekTimeSum);
					cell.setText(weekTimeText);
					break;
				}

			case "hoursMonth":
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
							await this.timeTracker.stopSessions(undefined, project)
						} else {
							await this.timeTracker.startProjectSession(project)
						}
						void this.updateTimeRows()
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
											void this.updateTimeRows()
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
											void this.updateTimeRows()
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
										void this.updateTimeRows()
									}
								}).open();
							});
					});

					menu.showAtMouseEvent(event);
				})
				break;
				break;
			}

			case 'sessionAt':
				new ButtonComponent(cell)
					.setButtonText(activeSession ? "Stop at" : "Start at")
					.setClass("button")
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
									void this.updateTimeRows()
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
									void this.updateTimeRows()
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
									void this.updateTimeRows()
								}
							}).open();
						}


					)

				break;
			
		}
	}

	private renderGroupCell(
		cell: HTMLTableCellElement,
		field: TimeColumnField,
		group: ProjectGroup
	): void {

		const activeCount = group.projects.filter(
			project => this.activeSessionMap.has(project.file.path)).length;

		switch (field) {
			
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

			case "project":  // stacking like this means both cases resolve to the code below
			case "primary":
				{
					/*
						Client is being displayed in the Project column because when grouping by client, the client column
						is not included. For the client value to be displayed, it has to get put in a column that IS present, 
						and we're not summarizing the project names so that column is empty anyway
					*/
					cell.setText(group.label)
					cell.addClass("left-align")
					
					break
					

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


		}
	}

	private renderTimeStopRowCell(
		cell: HTMLTableCellElement,
		field: TimeColumnField
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
							mode: 'stopAll',
							sessions: sessionDisplayInfo,
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


	/*async updateSummaryTable(): Promise<void> {

		// create temporary body for table, then fill it and swap for the current one instead of clearing the whole thing
		const newBody = createEl('tbody')

		await this.buildSummaryTableBody(newBody)

		this.summaryTableBodyEl?.replaceWith(newBody);
		this.summaryTableBodyEl = newBody;
		const newBody = createEl('tbody')

		const summaryTotals = await this.timeTracker.getTimeSummary(start, end);
		*//*
			summaryTotals are returned as array of TimeSummary objects 
			which is projectPath (string) and totalMinutes (number), so 
			we have to loop through and assign to the table
		*//*
		for (const timeSum of summaryTotals) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			const row = newBody.createEl('tr');

			const projectCell = row.createEl('td');
			const totalCell = row.createEl('td');


			const file = this.app.vault.getAbstractFileByPath(timeSum.key);

			if (file instanceof TFile) {
				const projectName = file.basename;
				projectCell.setText(projectName);
			}


			const durationText = formatMinutesToDuration(timeSum.totalMinutes);
			totalCell.setText(durationText)

		}
		// this.summaryTableBodyEl.empty();
		this.summaryTableBodyEl.replaceWith(newBody);
		this.summaryTableBodyEl = newBody;
	}

	private getSummaryPeriod(): { start: Date; end: Date } {
		const start = window.moment()
			.add(this.periodOffset, this.summaryPeriod)
			.startOf(this.summaryPeriod)
			.toDate();

		const end = window.moment()
			.add(this.periodOffset, this.summaryPeriod)
			.endOf(this.summaryPeriod)
			.toDate();

		return { start, end };
	}*/
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
}

