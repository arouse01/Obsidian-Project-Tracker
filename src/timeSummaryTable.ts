import {
	ButtonComponent
} from 'obsidian';
import { TimeTracker } from './timeTracker';
import { MyProjectManager } from "./projectManager"
import {
	// SortDirection,
	PeriodicTimeSummary,
	// ProjectInfo,
	// ProjectStatus,
	// TimeSession,
	// TimeSummaryStore
} from './types'
import {
	// GroupPosition,
	SummaryPeriod,
	getSummaryPeriod,
	SummaryGroup,
	// sortItems,
	// ColSort,
	// TableColumn,
	SummaryColumn,
	// updateSortButtons,
	// getGroupOptions,
	createTableColGroup
} from './tableFunctions';
import {
	formatDate,
	formatMinutesToDuration
} from "./utils";



export class TimeSummaryTable {

	private summaryPeriod: SummaryPeriod;
	private periodOffset: number;
	private summaryGroup: SummaryGroup = "client";

	private container: HTMLDivElement;
	private tableContainer: HTMLElement;

	private summaryTableEl!: HTMLTableElement;
	private summaryTableBodyEl!: HTMLTableSectionElement;
	private rangeText!: HTMLElement;

	constructor(
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager,
		target: HTMLDivElement,
		period: SummaryPeriod = "week",
		offset = 0
	) {
		this.container = target;
		this.summaryPeriod = period;
		this.periodOffset = offset;

		this.tableContainer = target.createDiv();

		this.createControls();
		void this.createTable();
		void this.rebuildSummaryTable();
	}

	
	private createControls() {

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
			value: 'month',
			text: "Month"
		});
		periodSelect.value = "week";

		periodSelect.addEventListener("change", () => {
			const value = periodSelect.value;

			if (value === "week" || value === "month") {
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

	private createSummaryHeaders(
		table: HTMLTableElement,
		summaryData: PeriodicTimeSummary
	) {

		table.addClass('dashboard-table')
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');

		// create group column (grouping by project or client)
		const groupCell = headerRow.createEl('th');

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


	// async setPeriod(
	// 	period: SummaryPeriod,
	// 	offset = this.periodOffset
	// ): Promise < void> {
	// 	this.summaryPeriod = period;
	// 	this.periodOffset = offset;

	// 	this.updatePeriodText();
	// 	await this.refreshTable();
	// }

	// updatePeriodText() {
	// 	this.rangeText.setText
	// }
}
