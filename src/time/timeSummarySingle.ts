import {
	App,
	ButtonComponent,
	Component,
	Menu
} from 'obsidian';
import { TimeTracker } from '@/time/timeTracker';
import { MyProjectManager } from '@/projects/projectManager'
import {
	SessionData,
	PeriodicTimeSummary,
	ProjectInfo,
	TimeSummaryStore,
    CreateModalRequest,
    ModalContext
} from '@/utils/types'
import {
	// GroupPosition,
	SummaryPeriod,
	getSummaryPeriod
} from '@/utils/tableFunctions';
import {
	formatMinutesToDuration,
	createStatusIcon,
	createProgressWheel,
	TimeProgressBar
} from '@/utils/utils';
import {
	TimeModal
} from '@/time/timeModal'
import {
	TimeSummaryTable
} from '@/time/timeSummaryTable'
import { GenericModal } from '@/utils/genericModal';



export class TimeSummarySingle extends Component {

	private summaryTable!: TimeSummaryTable;

	private summaryPeriod: SummaryPeriod;
	private periodOffset: number;

	private container: HTMLDivElement;  // parent container the component will live in

	// private sessionControls!: HTMLDivElement;
	private activeDiv!: HTMLDivElement;
	private activeIcon!: HTMLSpanElement;
	// private generalSummary!: HTMLDivElement;
	private progressIndicator!: TimeProgressBar;

	private todayTime!: HTMLDivElement;
	private weekTime!: HTMLDivElement;
	private monthTime!: HTMLDivElement;

	private startButton!: ButtonComponent
	private startAtButton!: ButtonComponent
	private addSessionButton!: ButtonComponent

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
	private sessionActive: SessionData | undefined
	private selectedProject: ProjectInfo

	private refreshInterval: number | null = null;

	constructor(
		private selectedProjectPath: string,
		target: HTMLDivElement,
		private app: App,
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager,
		period: SummaryPeriod = "week",
		offset = 0,

	) {
		super();
		this.selectedProject = this.projectManager.getProjectInfoByPath(selectedProjectPath)!

		this.container = target;
		this.summaryPeriod = period;
		this.periodOffset = offset;

		// this.tableContainer = target.createDiv();
		
		// this.buildDashboard();

		// void this.createTable();
		// void this.rebuildSummaryTable();
	}

	onload() {
		this.registerEvent(
			this.timeTracker.on("time-tracker-updated", () => {
				// when a session is started, stopped, or a whole one is added
				void this.refreshDashboard()
			})
		);
		
		this.refreshInterval = window.setInterval(() => {
			void this.refreshDashboard();
		}, 60000);
	}
	
	async onClose(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	async selectProject(projectPath: string) {
		// this.selectedProjectPath = project;

		const project = this.projectManager.getProjectInfoByPath(projectPath)
		if (project === undefined) {
			throw new Error(`Project not found: ${projectPath}`);
		}
		this.selectedProject = project
		this.container.empty()
		await this.buildDashboard()
		await this.refreshDashboard()
		// void this.updateTodoRows();
	}

	private async buildDashboard() {

		/*
			```
			┌──────────────────┬───────────────────────────────────────────┐
			│                  │ Weekly/monthly summary                    │
			│ Today       0:00 │                                           │
			│                  │                                           │
			│ This week   4:15 │                                           │
			│                  │                                           │
			│ This month 16:30 │                                           │
			│                  │                                           │
			├──────────────────┤                                           │
			│ target           │                                           │
			│ progressBar      │                                           │
			│ timeRemaining    │                                           │
			├──────────────────┴───────────────────────────────────────────┤
			│         sessionControlButtons                                │
			└──────────────────────────────────────────────────────────────┘
			```



		*/




		await this.updateSummaryData()

		const mainSection = this.container.createEl("section");
		mainSection.addClass("dashboard-section")
		mainSection.addClass("font-size-12")

		const headerSection = mainSection.createDiv({cls: "time-header"})
		headerSection.createDiv({ text: "Timekeeping", cls: "section-header" })
		const statusIconSection = headerSection.createDiv()
		await this.createStatusIndicator(statusIconSection)
		// mainSection.createDiv({ text: "Hours worked", cls: "section-header" }) 

		const generalSummary = mainSection.createDiv({ cls: "project-section" });
		generalSummary.addClass("project-time-full-layout")
		const runningTotals = generalSummary.createDiv({ cls: "project-section" })
		runningTotals.addClass("time-running-totals")
		// const timeSummary = leftSummary.createDiv({ cls: "project-section" })
		await this.buildProjectStats(runningTotals)

		const detailTableSection = generalSummary.createDiv({ cls: "project-section" });
		detailTableSection.addClass("time-summary-table")
		this.summaryTable = new TimeSummaryTable(
			this.timeTracker,
			this.projectManager,
			detailTableSection,
			{
				period: "week",
				offset: 0,
				summaryFormat: "single",
				selectedProject: this.selectedProject?.file.path ?? undefined
			}
		)
		const progressSection = generalSummary.createDiv({ cls: 'project-section' })
		await this.createProgressTracker(progressSection)
		// const controlSection = mainSection.createDiv({ cls: "project-status-section" });
		const statusSection = generalSummary.createDiv({ cls: 'project-section' })
		statusSection.addClass("session-control-buttons")

		await this.createControls(statusSection)
		
		// mainSection.createDiv({ cls: "divider" });

		

		

	}

	private async updateActiveSessionIcon() {
		// this.sessionActive = await this.timeTracker.getActiveProjectSession(this.selectedProjectPath!);

		// const activeSession = await this.timeTracker.getActiveProjectSession(this.selectedProject!);
		// Use svg for icon instead of emoji - renders cleaner across systems

		// this.activeIcon?.setText(this.sessionActive ? "🟢" : "⚪️")
		if (this.activeIcon) {
			this.activeIcon.empty();
			this.activeIcon.appendChild(createStatusIcon(!!this.sessionActive))
			this.activeIcon.title = this.sessionActive ? "Session active" : "Inactive"
		}
		this.activeDiv?.toggleClass("active", !!this.sessionActive);
	}

	private async updateSessionControlButtons() {
		this.startButton?.setButtonText(this.sessionActive ? "Stop" : "Start")
		this.startAtButton?.setButtonText(this.sessionActive ? "Stop at" : "Start at")
	}

	private async createProgressTracker(controlSection: HTMLDivElement) {
		controlSection.addClass("time-progress-cell")
		const progressDiv = controlSection.createDiv()
		if (this.selectedProject !== null && this.selectedProject.targetHours) {
			// progressDiv.addClass("center-align")


			const weekMinutes = this.timeSummaries.week.project.get(this.selectedProject.file.path) ?? 0;
			const targetMinutes = this.selectedProject.targetHours * 60
			const timePercent = weekMinutes / targetMinutes

			const indicatorType: "bar" | "ball" = "bar"

			if (indicatorType === "bar") {
				progressDiv.addClass("time-progress-cell")
				this.progressIndicator = new TimeProgressBar(progressDiv)
				this.progressIndicator.update(weekMinutes, targetMinutes)
				controlSection.createDiv({ text: `${Math.round(timePercent * 100) }%` })
			} else if (indicatorType === "ball") {
				progressDiv.addClass("active-indicator")
				const span = progressDiv.createSpan();  //⏲
				span.appendChild(createProgressWheel(timePercent))

				const textDiv = controlSection.createDiv({ cls: "font-size-12" })
				const targetText = formatMinutesToDuration(targetMinutes, "hours")


				const currHours = formatMinutesToDuration(weekMinutes, "hours")
				const percent = Math.round(timePercent * 100)
				textDiv.setText(`${percent}%`)
				// controlSection.title = `${currHours}/${targetText}h (${percent}%)`

				controlSection.addEventListener("contextmenu", (event) => {
					event.preventDefault();

					// right-click menu
					const menu = new Menu();

					menu.addItem((item) => {
						item.setTitle("Update weekly target")
							.onClick(async () => {
								const context: ModalContext = {
									items: [
										{
											type: "number",
											text: "Target weekly hours"
										}
									]
								}
								new GenericModal(this.app, {
									context: context,
									onSubmit: async (responses: CreateModalRequest) => {
										const newTarget = responses.responses[0]
										if (newTarget) {
											await this.projectManager.updateTargetTime(this.selectedProject, Number(newTarget))
											// void this.updateProjectTableRows()
										}

									}
								}).open();


							});
					});



					menu.showAtMouseEvent(event);
				})
			}
		}
	}

	private async createStatusIndicator(target: HTMLDivElement) {
		if (this.selectedProject !== null) {
			// const project = this.selectedProjectInfo
			const activeIndicator = target.createDiv({
				cls: "font-size-16"
			})
			activeIndicator.addClass("status-div")
			// activeIndicator.addClass("center-align")
			

			this.activeDiv = activeIndicator.createDiv({ cls: "active-indicator" });
			this.activeDiv.addClass("large")
			this.activeDiv.createDiv({ cls: "blinky-circle-green" })
			this.activeIcon = this.activeDiv.createSpan();
			// const statusText = !!this.sess
			// activeIndicator.createSpan({ text: "Status: ", cls: "vertical-middle" })
		}
	}

	private async createControls(sessionControls: HTMLDivElement) {
		// sessionControls.addClass("project-controls")
		sessionControls.addClass("no-scroll")
		sessionControls.addClass("control-col")
		const activeSession = await this.timeTracker.getActiveProjectSession(this.selectedProject?.file.path);

		if (this.selectedProject !== null) {
			const buttonDiv = sessionControls.createDiv({ cls: "summary-controls" })
			buttonDiv.addClass("font-size-14")

			this.startButton = new ButtonComponent(buttonDiv)
				.setButtonText(activeSession ? "Stop" : "Start")
				.setClass("button-larger")
				// .setClass("button-new")
				.onClick(async () => {
					if (this.sessionActive) {
						await this.timeTracker.stopSessions(undefined, this.selectedProject ?? undefined)
					} else {
						await this.timeTracker.startProjectSession(this.selectedProject)
					}
					await this.updateSummaryData()
				})

			this.startAtButton = new ButtonComponent(buttonDiv)
				.setButtonText(activeSession ? "Stop at" : "Start at")
				.setClass("button-larger")
				// .setClass("button-new")
				.onClick(async () => {
					if (this.sessionActive) {
						new TimeModal(this.app, {
							mode: 'stop',
							session: {
								projectName: this.selectedProject.name,
								startTime: this.sessionActive.start
							},
							onSubmit: async (timestamp: Date) => {
								await this.timeTracker.stopSessions(
									timestamp,
									this.selectedProject
								);
								await this.updateSummaryData()
							}
						}).open();
					} else {
						new TimeModal(this.app, {
							mode: 'start',
							projectPath: this.selectedProject.file.path,
							onSubmit: async (timestamp: Date) => {
								await this.timeTracker.startProjectSession(
									this.selectedProject,
									timestamp
								);
								await this.updateSummaryData()
							}
						}).open();
					}
				})

			this.addSessionButton = new ButtonComponent(buttonDiv)
				.setButtonText("Add session")
				.setClass("button-larger")
				// .setClass("button-new")
				.onClick(async () => {

					new TimeModal(this.app, {
						mode: 'add',
						projectPath: this.selectedProject.file.path,
						onSubmit: async (startTimestamp: Date, stopTimestamp: Date) => {
							await this.timeTracker.addCompleteSession(
								this.selectedProject,
								startTimestamp,
								stopTimestamp
							);
							await this.updateSummaryData()
						}
					}).open();
				})

			await this.updateActiveSessionIcon()
			// await this.updateSessionControlButtons()

			// sessionControls.createEl('label', {text: "Session controls: "})
			// const project = this.selectedProjectInfo

			

		}
	}

	private async buildProjectStats(projectSection: HTMLDivElement) {
		const newDiv = createDiv({ cls: "project-section" })
		newDiv.addClass("project-time-section")
		
		// today
		// const todayDiv = newDiv.createDiv()
		newDiv.createDiv({
			text: "Today",
			cls: "project-time-label"
		})
		const todayHours = this.timeSummaries.day.project.get(this.selectedProject?.file.path)
		this.todayTime = newDiv.createDiv({
			text: formatMinutesToDuration(todayHours ?? 0),
			cls: "project-time-value"
		})

		// week
		// const weekDiv = newDiv.createDiv()
		newDiv.createDiv({
			text: "This week",
			cls: "project-time-label"
		})
		const weekHours = this.timeSummaries.week.project.get(this.selectedProject?.file.path) ?? 0
		this.weekTime = newDiv.createDiv({
			text: formatMinutesToDuration(weekHours ?? 0),
			cls: "project-time-value"
		})

		

		// month
		// const monthDiv = newDiv.createDiv()
		newDiv.createDiv({
			text: "This month",
			cls: "project-time-label"
		})
		const monthHours = this.timeSummaries.month.project.get(this.selectedProject?.file.path)
		this.monthTime = newDiv.createDiv({
			text: formatMinutesToDuration(monthHours ?? 0),
			cls: "project-time-value"
		})

		projectSection?.replaceWith(newDiv);
		projectSection = newDiv;
	}

	updateProjectStats() {
		const todayHours = this.timeSummaries.day.project.get(this.selectedProject?.file.path)
		this.todayTime.setText(formatMinutesToDuration(todayHours ?? 0))

		// week
		const weekHours = this.timeSummaries.week.project.get(this.selectedProject?.file.path)
		this.weekTime.setText(formatMinutesToDuration(weekHours ?? 0))
		
		// month
		const monthHours = this.timeSummaries.month.project.get(this.selectedProject?.file.path)
		this.monthTime.setText(formatMinutesToDuration(monthHours ?? 0))

	}

	async initialDataRefresh(): Promise<void> {

		this.timeSummaries = await this.timeTracker.getCurrentTimeSummaries();
		this.sessionActive = await this.timeTracker.getActiveProjectSession(this.selectedProject?.file.path);
		// await this.summaryTable.updateSummaryRows()
		await this.updateActiveSessionIcon()
		await this.updateSessionControlButtons()
	}

	async updateSummaryData(): Promise<void> {

		this.timeSummaries = await this.timeTracker.getCurrentTimeSummaries();
		this.sessionActive = await this.timeTracker.getActiveProjectSession(this.selectedProject?.file.path);
		await this.summaryTable?.updateSummaryRows()
		await this.updateActiveSessionIcon()
		await this.updateSessionControlButtons()
	}

	/*async updateSummaries(): Promise<void> {
		// const activeSessions = await this.timeTracker.getActiveSessions();
		// this.activeSessionMap = new Map(
		// 	activeSessions.map(session => [session.projectPath, session])
		// );
		this.timeSummaries = await this.timeTracker.getCurrentTimeSummaries();
		await this.summaryTable.updateSummaryRows()


	}*/

	async refreshDashboard(): Promise<void> {
		

		await this.updateSummaryData()
		this.updateProjectStats()
		// await this.summaryTable.updateSummaryRows()
		// await this.updateActiveSessionIcon()
		// await this.updateSessionControlButtons()
	}

	async getSummaryData(): Promise<PeriodicTimeSummary> {

		let summaryTotals: PeriodicTimeSummary;

		
			const { start, end } = getSummaryPeriod(this.periodOffset, this.summaryPeriod);
			summaryTotals = await this.timeTracker.getTimeSummary(start, end);
			if (this.summaryPeriod === "year") {
				summaryTotals = await this.timeTracker.getMonthlySummary(summaryTotals);
			}
		
		return summaryTotals;
	}

	

}


