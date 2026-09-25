import {
	ButtonComponent
} from 'obsidian';
import { TimeTracker } from './timeTracker';
import { MyProjectManager } from "./projectManager"
import {
	PeriodicTimeSummary,
	DateKey,
	TimeSummaryStore
} from './types'
import {
	SummaryPeriod,
	getSummaryPeriod,
	SummaryGroup,
	SummaryColumn,
	SummaryFormat,
	createTableColGroup,
	TimeSummaryTableOptions
} from './tableFunctions';
import {
	getDateKey,
	formatMinutesToDuration,
	dateKeyToDate
} from "./utils";
// import {
// 	TimeModal
// } from "./timeModal"




export class TimeSummaryTable {

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
	private summaryFormat: SummaryFormat;
	private summaryPeriod: SummaryPeriod;
	private periodOffset: number;
	private summaryGroup: SummaryGroup = "client";
	private selectedProjectPath: string | null;


	private container: HTMLDivElement;
	// private tableContainer: HTMLElement;

	private summaryTableEl!: HTMLTableElement;
	private summaryTableBodyEl!: HTMLTableSectionElement;
	private rangeText!: HTMLElement;

	// private activeSessionMap = new Map<string, SessionData>();
	constructor(
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager,
		target: HTMLDivElement,
		options: TimeSummaryTableOptions = {},
		
	) {
		this.container = target;
		this.summaryPeriod = options.period ?? "week";
		this.periodOffset = options.offset ?? 0;
		this.summaryFormat = options.summaryFormat ?? "full";
		this.selectedProjectPath = options.selectedProject ?? null
		// this.tableContainer = target.createDiv();

		if (options.summaryFormat === "single") {
			this.summaryGroup = "project"
		}
		this.createControls();
		void this.createTable();
		void this.rebuildSummaryTable();
	}

	
	private createControls() {
		this.container.addClass('dashboard')
		if (this.summaryFormat !== "sidebar") { 
			// in the sidebar we want a client summary only, since horizontal space is limited 
			const summaryControlsTop = this.container.createDiv();
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
				value: 'year',
				text: "Month"
			});
			periodSelect.value = "week";

			periodSelect.addEventListener("change", () => {
				const value = periodSelect.value;

				if (value === "week" || value === "year") {
					this.summaryPeriod = value;
					void this.rebuildSummaryTable();
				}
			});
		

			const summaryControlsBottom = this.container.createDiv();
			summaryControlsBottom.addClass('summary-controls')
			new ButtonComponent(summaryControlsBottom)
				.setButtonText("⏴")
				// .setClass("arrow-button")
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
				// .setClass("arrow-button")
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

		}

	}

	private async createTable() {
		const sectionSummaryTableEl = this.container.createEl('section');
		sectionSummaryTableEl.addClass('project-dashboard');

		this.summaryTableEl = sectionSummaryTableEl.createEl('table');
		this.summaryTableEl.addClass("dashboard-table")
		this.summaryTableEl.addClass("text-centered")
		const summaryData = await this.getSummaryData()
		const summaryCols = this.getSummaryColumns(summaryData);
		this.createSummaryTableColGroup(this.summaryTableEl, summaryCols);
		this.createSummaryHeaders(this.summaryTableEl, summaryData);
	}

	setProject(projectPath: string | null): void {
		this.selectedProjectPath = projectPath
	}

	async updateSummaries(): Promise<void> {
		// const activeSessions = await this.timeTracker.getActiveSessions();
		// this.activeSessionMap = new Map(
		// 	activeSessions.map(session => [session.projectPath, session])
		// );
		this.timeSummaries = await this.timeTracker.getCurrentTimeSummaries();
		

	}
	async getSummaryData(): Promise<PeriodicTimeSummary> {

		let summaryTotals: PeriodicTimeSummary;

		if (this.summaryFormat === "sidebar") {
			// sidebar gets current day and week only, no historical data
			const start = new Date();
			start.setHours(0, 0, 0, 0)  // clear time
			start.setDate(start.getDate() - start.getDay())
			const end = new Date(start)
			end.setDate(end.getDate() + 7)
			summaryTotals = await this.timeTracker.getTimeSummary(start, end);
		} else {
			const { start, end } = getSummaryPeriod(this.periodOffset, this.summaryPeriod);
			summaryTotals = await this.timeTracker.getTimeSummary(start, end);
			if (this.summaryPeriod === "year") {
				summaryTotals = await this.timeTracker.getMonthlySummary(summaryTotals);
			}
		}
		if (this.summaryFormat === "single") {
			summaryTotals = await this._filterProjectSummary(summaryTotals)
		}
		return summaryTotals;
	}

	private async _filterProjectSummary(summaryData: PeriodicTimeSummary): Promise<PeriodicTimeSummary> {
		if (this.selectedProjectPath === null) {
			return summaryData
		}

		const projectDays = summaryData.projects.get(this.selectedProjectPath)

		return {
			days: summaryData.days,
			projects: projectDays === undefined
				? new Map<string, Map<string, number>>()
				: new Map([[this.selectedProjectPath, projectDays]]),
			clients: new Map()
		}
	}

	async rebuildSummaryTable(): Promise<void> {
		// Get summary data first, then use it to build the summary table. Works different from the project table because the columns that appear are much more dependent on app state, which also affects how the calculations work
		const summaryTotals = await this.getSummaryData();
		const { start, end } = getSummaryPeriod(this.periodOffset, this.summaryPeriod);

		let dateRangeText: string;
		// let summaryTotals: PeriodicTimeSummary;

		const newTable = createEl('table');

		if (this.summaryPeriod === "year") {
			dateRangeText = window.moment(start).format("YYYY")
		} else {
			dateRangeText = `${window.moment(start).format("MMM DD")} - ${window.moment(end).format("MMM DD")}`
		}

		this.rangeText?.setText(dateRangeText);
		const summaryCols = this.getSummaryColumns(summaryTotals);
		createTableColGroup(newTable, summaryCols);
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
		if (this.summaryFormat === "sidebar") {
			summaryCols = [
				{
					key: "group",
					label: "",
					minWidth: "120px",
					width: "220px",
					maxWidth: "500px"
				},
				{
					key: "dayTotal",
					label: "Today",
					width: "50px"
				},

				{
					key: "weekTotal",
					label: "Week",
					width: "50px"
				}
			]
		} else {
			if (this.summaryPeriod === "week") {
				summaryCols = [
					
					...summaryTotals.days.map(day => ({
						key: day,
						label: dateKeyToDate(day).toLocaleDateString("en-US", {
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
					// {
					// 	key: "group",
					// 	label: "",
					// 	minWidth: "120px",
					// 	maxWidth: "500px"
					// },
					...summaryTotals.days.map(day => ({
						key: day,
						label: dateKeyToDate(day).toLocaleDateString("en-US", {
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
			if (this.summaryFormat !== "single") {
				summaryCols.unshift({
					key: "group",
					label: "",
					minWidth: "120px",
					width: "250px",
					maxWidth: "500px"
				})
			}
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

	private createSummaryHeaders(
		table: HTMLTableElement,
		summaryData: PeriodicTimeSummary
	) {

		table.addClass('dashboard-table')
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');

		// create group column (grouping by project or client)
		if (this.summaryFormat !== "single") {
			// for single project we already know the project name so the cell is not needed
			const groupCell = headerRow.createEl('th');
			if (this.summaryFormat === "sidebar") {
				groupCell.setText("Primary")
			} else {
				const groupSelect = groupCell.createEl('select', {
					cls: 'dropdown-new'
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
			}
		}
		// rest of columns
		if (this.summaryFormat === "sidebar") {
			headerRow.createEl('th', {text: "Today"});
			headerRow.createEl('th', { text: "Week" });
		} else {
			if (this.summaryPeriod === "year") {
				for (const day of summaryData.days) {
					const monthDate = dateKeyToDate(day)
					const headerCell = headerRow.createEl('th');
					headerCell.createDiv({
						text: monthDate.toLocaleDateString("en-US", { month: 'short' }),
						cls: "summary-col-header"
					})
					headerCell.createDiv({
						text: monthDate.toLocaleDateString("en-US", { year: 'numeric' }),
						cls: "summary-col-subheader"
					})
				}
				const totalCell = headerRow.createEl('th', { text: 'Total' });
				totalCell.addClass("total-col")
			} else {
				for (const day of summaryData.days) {
					const dayDate = dateKeyToDate(day)
					const headerCell = headerRow.createEl('th');
					headerCell.createDiv({
						text: dayDate.toLocaleDateString("en-US", { weekday: 'short' }),
						cls: "summary-col-header"
					})
					headerCell.createDiv({
						text: dayDate.toLocaleDateString("en-US", { day: '2-digit' }),
						cls: "summary-col-subheader"
					})
				}

				const totalCell = headerRow.createEl('th', { text: 'Total' });
				totalCell.addClass("total-col")

			}
		}
		this.summaryTableBodyEl = this.summaryTableEl.createEl('tbody');
	}

	async updateSummaryRows(): Promise<void> {
		// function for updating the rows without touching the headers

		// create temporary body for table, then fill it and swap for the current one instead of clearing the whole thing
		const newBody = createEl('tbody')
		if (this.summaryFormat === "sidebar") {
			const summaryData = await this.getSummaryData()
			await this.buildSummaryTableBody(newBody, summaryData);
		} else {
			const summaryData = await this.getSummaryData()
			await this.buildSummaryTableBody(newBody, summaryData);
		}
		

		if (this.summaryTableBodyEl) {
			this.summaryTableBodyEl.replaceWith(newBody);
		}
		
		this.summaryTableBodyEl = newBody;
	}

	async buildSummaryTableBody(
		tbody: HTMLTableSectionElement,
		summaryData: PeriodicTimeSummary
	): Promise<void> {
		// build a separate updated summary table body into the provided HTMLTableSectionElement
		// built more directly into the table instead of using the approach seen in other dashboards
		let summary: Map<string, Map<DateKey, number>>
		if (this.summaryGroup === "client") {
			summary = summaryData.clients;
		}
		else {
			// groupName = this.projectManager.getProjectInfoByPath(key)?.name ?? "unknown";
			summary = summaryData.projects;
		}
		
		for (const [key, dailyMinutes] of summary) {
			const row = tbody.createEl('tr');

			if (this.summaryFormat !== "single") {
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
			}

			if (this.summaryFormat === "sidebar") {
				// const day = summaryData.days[0]
				const todayMinutes = dailyMinutes.get(getDateKey()) ?? 0;
				// runningTotal += minutes;
				const cell = row.createEl("td");
				cell.setText(formatMinutesToDuration(todayMinutes, true))
				let weekTotal = 0;
				for (const [, minutes] of dailyMinutes) {
					weekTotal = weekTotal + minutes;
				}
				const totalCell = row.createEl("td");
				// totalCell.addClass("total-col")
				totalCell.setText(formatMinutesToDuration(weekTotal, true))
			} else {
				let runningTotal = 0;
				for (const day of summaryData.days) {
					const minutes = dailyMinutes.get(day) ?? 0;
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
		
		
	}


}

