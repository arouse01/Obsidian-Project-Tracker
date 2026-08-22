import {
	ItemView,
	WorkspaceLeaf,
	ButtonComponent,
	TFile
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	formatMinutesToDuration
} from './utils';
import { TimeTracker } from './timeTracker';
import { TimeModal } from './timeModal';

export class TimeDashboardView extends ItemView {
	private summaryPeriod: "week" | "month" = "week";  // to drive the summary period selection
	private periodOffset = 0;  // to drive the summary period selection, how far in the past to go

	private projectTableBodyEl!: HTMLTableSectionElement;
	private summaryTableBodyEl!: HTMLTableSectionElement;
	private rangeText!: HTMLElement;

	private refreshInterval: number | null = null;


	constructor(
		leaf: WorkspaceLeaf,
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager
	) {
		super(leaf);
	}

	getViewType(): string {
		return "time-dashboard";
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

		this.buildDashboard();
		await this.updateDashboard();

		this.refreshInterval = window.setInterval(() => {
			void this.updateSummary();
		}, 60000);
	}

	async onClose(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	private buildDashboard() {
		const controlSection = this.contentEl.createEl("section");
		controlSection.createEl("h3", {
			text: "Active projects"
		});
		controlSection.addClass('time-dashboard')

		/*const stopButtonSection = controlSection.createDiv()
		stopButtonSection.addClass('summary-controls')
		this.stopAllButton = new ButtonComponent(stopButtonSection)
			.setButtonText("Stop all")
			// .setClass("")
			.onClick(async () => {
				await this.timeTracker.stopAllSessions()
			})

		this.stopAllAtButton = new ButtonComponent(stopButtonSection)
			.setButtonText("Stop all at")
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
				

			})*/

		const tableMainEl = controlSection.createEl('table');
		const tableMainHeaderEl = tableMainEl.createEl('thead');
		const headerMainRowEl = tableMainHeaderEl.createEl('tr');
		headerMainRowEl.createEl('th', { text: 'Status' });
		headerMainRowEl.createEl('th', { text: 'Project' });
		headerMainRowEl.createEl('th', { text: 'Action', attr: { colspan: 2 }});

		this.projectTableBodyEl = tableMainEl.createEl('tbody');


		const summarySection = this.contentEl.createEl("section");
		summarySection.createEl("h3", {
			text: "Summary"
		});


		summarySection.addClass('time-dashboard')

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
				void this.updateSummary();
			}
		});

		const summaryControlsBottom = summarySection.createDiv();
		summaryControlsBottom.addClass('summary-controls')
		new ButtonComponent(summaryControlsBottom)
			.setButtonText("⏴")
			.setClass("arrow-button")
			.onClick(async () => {
				this.periodOffset--;
				await this.updateSummary();
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
				await this.updateSummary();
			})

		new ButtonComponent(summaryControlsBottom)
			.setButtonText("Now")
			.onClick(async () => {
				this.periodOffset = 0;
				await this.updateSummary();
			})

		// select.style.width = "100%";

		const tableSummaryEl = summarySection.createEl('table');
		tableSummaryEl.addClass('summary-section')
		const tableSummaryHeaderEl = tableSummaryEl.createEl('thead');
		const headerSummaryRowEl = tableSummaryHeaderEl.createEl('tr');
		headerSummaryRowEl.createEl('th', { text: 'Project' });
		headerSummaryRowEl.createEl('th', { text: 'Time' });

		this.summaryTableBodyEl = tableSummaryEl.createEl('tbody');
	}

	async updateDashboard(): Promise<void> {
		await this.updateProjects();
		await this.updateSummary();
	}

	async updateProjects(): Promise<void> {
		const projects = this.projectManager.getActiveProjects();
		const activeSessions = await this.timeTracker.getActiveSessions();
		const activeSessionMap = new Map(
			activeSessions.map(session => [session.projectPath, session])
		);

		
		

		const newBody = createEl('tbody')

		for (const project of projects) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			const row = newBody.createEl('tr');

			const statusCell = row.createEl('td');
			const projectCell = row.createEl('td');
			const actionCell = row.createEl('td');
			const actionAtCell = row.createEl('td');
			// const timeCell = row.createEl('td');

			statusCell.addClass("time-dashboard-centered");
			const activeSession = activeSessionMap.get(project.file.path);
			// const isActive = activePaths.has(project.file.path);
			if (activeSession) {
				statusCell.setText("🟢"); //⏲
			} else {
				statusCell.setText("");  //💤
			}

			projectCell.setText(project.name);

			actionCell.addClass("time-dashboard-centered");
			new ButtonComponent(actionCell)
				.setButtonText(activeSession ? "Stop" : "Start")
				.onClick(async () => {
					if (activeSession) {
						await this.timeTracker.stopProjectSession(project)
					} else {
						await this.timeTracker.startProjectSession(project)
					}
				})

			new ButtonComponent(actionAtCell)
				.setButtonText(activeSession ? "Stop at" : "Start at")
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
		}

		// add the stop all row
		if (activeSessions.length > 0) {
			const stopAllRow = newBody.createEl('tr');
			stopAllRow.addClass('summary-row')
			stopAllRow.createEl('td', { attr: { class: 'summary-row' } });
			stopAllRow.createEl('td', { text: "All active projects", attr: { class: 'summary-row' } });

			const actionCell = stopAllRow.createEl('td');
			actionCell.addClass('summary-row')
			const actionAtCell = stopAllRow.createEl('td');
			actionAtCell.addClass('summary-row')

			new ButtonComponent(actionCell)
				.setButtonText("Stop")
				// .setClass("")
				.onClick(async () => {
					await this.timeTracker.stopAllSessions()
				})

			new ButtonComponent(actionAtCell)
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
		}
		// this.projectTableBodyEl.empty();


		this.projectTableBodyEl.replaceWith(newBody);
		this.projectTableBodyEl = newBody;

	}

	async updateSummary(): Promise<void> {
		
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
		/*
			summaryTotals are returned as array of TimeSummary objects 
			which is projectPath (string) and totalMinutes (number), so 
			we have to loop through and assign to the table
		*/
		for (const timeSum of summaryTotals) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			const row = newBody.createEl('tr');

			const projectCell = row.createEl('td');
			const totalCell = row.createEl('td');


			const file = this.app.vault.getAbstractFileByPath(timeSum.projectPath);

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

	
}

