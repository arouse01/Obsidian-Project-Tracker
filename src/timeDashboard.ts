import {
	ItemView,
	WorkspaceLeaf,
	ButtonComponent,
	// TFile
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	formatMinutesToDuration
} from './utils';
import {
	ProjectInfo,
	TimeSummary,
	TimeSession,
	TimeSummaryStore
} from './types'
import { TimeTracker } from './timeTracker';
import { TimeModal } from './timeModal';
import {
	TIME_DASHBOARD_VIEW_TYPE
} from "./constants"
import {
	TableColumn,
	// SummaryColumn,
	updateSortButtons,
	createTableColGroup
} from './tableFunctions';
import {
	TIME_COLS,
	TimeColumnField,
	TimeSort
} from "./tableConstants"



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

	private summaryPeriod: "week" | "month" = "week";  // to drive the summary period selection
	private periodOffset = 0;  // to drive the summary period selection, how far in the past to go

	private projectTableBodyEl!: HTMLTableSectionElement;
	private summaryTableBodyEl!: HTMLTableSectionElement;
	private rangeText!: HTMLElement;

	private refreshInterval: number | null = null;

	private activeSessionMap = new Map<string, TimeSession>();

	private dayTimeSumByPath = new Map<string, TimeSummary>

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

		const title = controlSection.createEl("h3", {
			text: "Time tracker"
		});
		title.addClass("text-centered");

		const tableMainEl = controlSection.createEl('table');
		tableMainEl.addClass('dashboard-table')
		// create colgroup so we can specify column sizes
		
		// const colGroup = tableMainEl.createEl('colgroup');
		const timeCols = this.getVisibleCols()
		createTableColGroup(tableMainEl, timeCols)
		// for (const [, column] of timeCols) {
		// 	const col = colGroup.createEl("col")
		// 	if (column.width) {
		// 		col.style.width = column.width;
		// 	}
		// 	if (column.minWidth) {
		// 		col.style.minWidth = column.minWidth;
		// 	}
		// 	if (column.maxWidth) {
		// 		col.style.maxWidth = column.maxWidth;
		// 	}
		// }

		// Create headers

		// const tableMainHeaderEl = tableMainEl.createEl('thead');
		// const headerMainRowEl = tableMainHeaderEl.createEl('tr');

		/*
		// const colGroups = new Map<string, TableColumn[]>();

		// for (const column of timeCols) {
		// 	const colGroup = column.format ?? "";

		// 	if (!colGroups.has(colGroup)) {
		// 		colGroups.set(colGroup, []);
		// 	}

		// 	colGroups.get(colGroup)!.push(column);
		// }
		// for (const [colGroupName, colGroupColumns] of colGroups) {
		// 	const cell = headerMainRowEl.createEl("th");
		// 	cell.colSpan = colGroupColumns.length;
		// 	cell.setText(colGroupName);
		// }
		for (const column of timeCols) {
			const header = headerMainRowEl.createEl('th');
			header.setText(column.label)
		}
		*/

		// manually creating headers because this table is so simple
		// headerMainRowEl.createEl('th', { text: 'Status' })
		// 	.addClass("text-centered");
		// headerMainRowEl.createEl('th', { text: 'Project' })
		// 	.addClass("text-centered");
		// headerMainRowEl.createEl('th', { text: 'Today' })
		// 	.addClass("text-centered");
		// headerMainRowEl.createEl('th', { text: 'Action', attr: { colspan: 2 } })
		// 	.addClass("text-centered");
		this.createTimeTableHeaders(tableMainEl, timeCols)

		this.projectTableBodyEl = tableMainEl.createEl('tbody');
		
/*

		const summarySection = this.contentEl.createEl("section");
		summarySection.addClass("dashboard")
		summarySection.createEl("h3", {
			text: "Summary"
		});


		summarySection.addClass('font-size-12')

		const summaryControlsTop = summarySection.createDiv();
		summaryControlsTop.addClass('summary-controls')

		summaryControlsTop.createEl('label', {
			text: 'Summarize by:',
			attr: { for: 'period-selector' }
		});
		const periodSelect = summaryControlsTop.createEl('select', {
			cls: 'dropdown-new',
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
				void this.updateSummaryTable();
			}
		});

		const summaryControlsBottom = summarySection.createDiv();
		summaryControlsBottom.addClass('summary-controls')
		new ButtonComponent(summaryControlsBottom)
			.setButtonText("⏴")
			.setClass("arrow-button")
			.onClick(async () => {
				this.periodOffset--;
				await this.updateSummaryTable();
			});
		const { start, end } = this.getSummaryPeriod();

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
				await this.updateSummaryTable();
			})

		new ButtonComponent(summaryControlsBottom)
			.setButtonText("Now")
			.onClick(async () => {
				this.periodOffset = 0;
				await this.updateSummaryTable();
			})
*/
		// select.style.width = "100%";

		// const tableSummaryEl = summarySection.createEl('table');
		// tableSummaryEl.addClass('summary-section')
		// tableSummaryEl.addClass('dashboard-table')


		// const tableSummaryHeaderEl = tableSummaryEl.createEl('thead');
		// const headerSummaryRowEl = tableSummaryHeaderEl.createEl('tr');
		// headerSummaryRowEl.createEl('th', { text: 'Project' });
		// headerSummaryRowEl.createEl('th', { text: 'Time' });

		// this.summaryTableBodyEl = tableSummaryEl.createEl('tbody');
	}

	async updateDashboard(): Promise<void> {
		await this.updateTimeRows();
		// await this.updateSummaryTable();
	}

	private getVisibleCols(): Array<
		[TimeColumnField, TableColumn]
	> {
		const colOrder: TimeColumnField[] = [
			"status",
			"project",
			"hoursToday",
			"hoursWeek",
			"sessionStart",
			"sessionAt"
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

		const weekStart = window.moment().startOf("week").toDate();
		const weekEnd = window.moment().endOf("week").toDate();
		const weekSummaryTotals = await this.timeTracker.getTimeSummary(weekStart, weekEnd);
		const weekClientSummaryTotals = await this.timeTracker.getTimeSummaryByClient(weekStart, weekEnd);

		const dayStart = window.moment().startOf("day").toDate();
		const dayEnd = window.moment().endOf("day").toDate();
		const daySummaryTotals = await this.timeTracker.getTimeSummary(dayStart, dayEnd);
		const dayClientSummaryTotals = await this.timeTracker.getTimeSummaryByClient(dayStart, dayEnd);

		const monthStart = window.moment().startOf("month").toDate();
		const monthEnd = window.moment().endOf("month").toDate();
		const monthSummaryTotals = await this.timeTracker.getTimeSummary(monthStart, monthEnd);
		const monthClientSummaryTotals = await this.timeTracker.getTimeSummaryByClient(monthStart, monthEnd);

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

	async updateTimeRows(): Promise<void> {
		//const projects = this.projectManager.getActiveProjects();
		await this.updateSummaries();

		const newBody = createEl('tbody')

		await this.buildTimeTableBody(newBody)

		this.projectTableBodyEl?.replaceWith(newBody);
		this.projectTableBodyEl = newBody;

	}

	private async buildTimeTableBody(tbody: HTMLTableSectionElement): Promise<void> {

		const projects = this.projectManager.getActiveProjects();

		for (const project of projects) {

			this.createTimeRow(tbody, project);

		}

		const activeSessions = await this.timeTracker.getActiveSessions();

		if (activeSessions.length > 0) {
			this.createStopRow(tbody)
		}
	}
		
	

	private createTimeRow(target: HTMLTableSectionElement, project: ProjectInfo) {
		const row = target.createEl('tr');

		for (const [field,] of this.getVisibleCols()) {

			const cell = row.createEl("td");

			this.renderTimeCell(cell, field, project);
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
		project: ProjectInfo
	): void {
		const activeSession = this.activeSessionMap.get(project.file.path);

		switch (field) {
			case "status":
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

			case 'sessionStart':
				new ButtonComponent(cell)
					.setButtonText(activeSession ? "Stop" : "Start")
					.setClass("dashboard")
					.onClick(async () => {
						if (activeSession) {
							await this.timeTracker.stopProjectSession(project)
						} else {
							await this.timeTracker.startProjectSession(project)
						}
						void this.updateTimeRows()
					})


				break;

			case 'sessionAt':
				new ButtonComponent(cell)
					.setButtonText(activeSession ? "Stop at" : "Start at")
					.setClass("button")
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


	/*async updateSummaryTable(): Promise<void> {
		
		const { start, end } = this.getSummaryPeriod();

		let dateRangeText: string;
		if (this.summaryPeriod === "week") {
			dateRangeText = `${window.moment(start).format("MMM DD")} - ${window.moment(end).format("MMM DD")}`
		} else {
			dateRangeText = window.moment(start).format("MMMM YYYY")
		}
		this.rangeText.setText(dateRangeText);

		// create temporary body for table, then fill it and swap for the current one instead of clearing the whole thing
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
	}
*/
	
}

