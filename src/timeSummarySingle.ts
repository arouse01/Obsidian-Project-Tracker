import {
	App,
	ButtonComponent,
	Component,
	Menu
} from 'obsidian';
import { TimeTracker } from './timeTracker';
import { MyProjectManager } from "./projectManager"
import {
	SessionData,
	PeriodicTimeSummary,
	ProjectInfo,
	TimeSummaryStore,
	
} from './types'
import {
	// GroupPosition,
	SummaryPeriod,
	getSummaryPeriod
} from './tableFunctions';
import {
	formatMinutesToDuration
} from "./utils";
import {
	TimeModal
} from "./timeModal"
import {
	TimeSummaryTable
} from "./timeSummaryTable"



export class TimeSummarySingle extends Component {

	private summaryTable!: TimeSummaryTable;

	private summaryPeriod: SummaryPeriod;
	private periodOffset: number;

	private container: HTMLDivElement;  // parent container the component will live in

	private sessionControls!: HTMLDivElement;
	private activeDiv!: HTMLDivElement;
	private activeIcon!: HTMLSpanElement;
	private generalSummary!: HTMLDivElement;

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
		this.selectedProject = this.projectManager.getProjectInfoByPath(this.selectedProjectPath)!

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
				void this.updateSummaryData()
			})
		);
		
		this.refreshInterval = window.setInterval(() => {
			void this.updateSummaryData();
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
		await this.updateSummaryData()

		const mainSection = this.container.createEl("section");
		mainSection.addClass("dashboard-section")
		mainSection.addClass("font-size-12")
		// mainSection.createDiv({ text: "Hours worked", cls: "section-header" }) 

		this.sessionControls = mainSection.createDiv({ cls: "project-section" });
		this.sessionControls.addClass("summary-controls")
		await this.createControls(this.sessionControls)
		// mainSection.createDiv({ cls: "divider" });
		this.generalSummary = mainSection.createDiv({ cls: "project-section" });
		this.generalSummary.addClass("project-time-section")
		await this.buildProjectStats(this.generalSummary)

		const detailTableSection = mainSection.createDiv({ cls: "project-section" });
		this.summaryTable = new TimeSummaryTable(
			this.timeTracker,
			this.projectManager,
			detailTableSection,
			{
				period: "week",
				offset: 0,
				summaryFormat: "single",
				selectedProject: this.selectedProjectPath ?? undefined
			}
		)

	}

	private async updateActiveSessionIcon() {
		// this.sessionActive = await this.timeTracker.getActiveProjectSession(this.selectedProjectPath!);
		
		// const activeSession = await this.timeTracker.getActiveProjectSession(this.selectedProject!);
		this.activeIcon?.setText(this.sessionActive ? "🟢" : "⚪️")
		
		this.activeDiv?.toggleClass("active", !!this.sessionActive);
	}

	private async updateSessionControlButtons() {
		this.startButton?.setButtonText(this.sessionActive ? "Stop" : "Start")
		this.startAtButton?.setButtonText(this.sessionActive ? "Stop at" : "Start at")
	}

	private async createControls(sessionControls: HTMLDivElement) {
		sessionControls.addClass("project-controls")
		sessionControls.addClass("no-scroll")
		sessionControls.addClass("control-col")
		const activeSession = await this.timeTracker.getActiveProjectSession(this.selectedProjectPath);

		if (this.selectedProject !== null) {
			// const project = this.selectedProjectInfo
			const activeIndicator = sessionControls.createDiv({
				text: "Status: ",
				cls: "font-size-16"
			})
			activeIndicator.addClass("center-align")
			/*
			activeIndicator.addEventListener("click", (event) => {
				event.preventDefault();

				// right-click menu
				const menu = new Menu();

				menu.addItem((item) => {
					item.setTitle(activeSession ? "Stop" : "Start")
						.onClick(async () => {
							if (activeSession) {
								await this.timeTracker.stopSessions(undefined, project)
							} else {
								await this.timeTracker.startProjectSession(project)
							}
							await this.updateSummaryData()
						})
				})
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
										await this.updateSummaryData()
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
										await this.updateSummaryData()
									}
								}).open();
							}
						})
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
									await this.updateSummaryData()
								}
							}).open();
						})
				});

				menu.showAtMouseEvent(event);
			})
			*/

			this.activeDiv = activeIndicator.createDiv({ cls: "active-indicator" });
			this.activeDiv.addClass("large")
			this.activeDiv.createDiv({ cls: "blinky-circle-green" })
			this.activeIcon = this.activeDiv.createSpan();  //⏲

			const buttonDiv = sessionControls.createDiv({cls: "dashboard"})
			this.startButton = new ButtonComponent(buttonDiv)
				.setButtonText(activeSession ? "Stop" : "Start")
				.setClass("button-larger")
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
		const todayDiv = newDiv.createDiv()
		todayDiv.createDiv({
			text: "Today",
			cls: "project-time-label"
		})
		const todayHours = this.timeSummaries.day.project.get(this.selectedProjectPath)
		todayDiv.createDiv({
			text: formatMinutesToDuration(todayHours ?? 0),
			cls: "project-time-value"
		})

		// week
		const weekDiv = newDiv.createDiv()
		weekDiv.createDiv({
			text: "This week",
			cls: "project-time-label"
		})
		const weekHours = this.timeSummaries.week.project.get(this.selectedProjectPath)
		weekDiv.createDiv({
			text: formatMinutesToDuration(weekHours ?? 0),
			cls: "project-time-value"
		})

		// month
		const monthDiv = newDiv.createDiv()
		monthDiv.createDiv({
			text: "This month",
			cls: "project-time-label"
		})
		const monthHours = this.timeSummaries.month.project.get(this.selectedProjectPath)
		monthDiv.createDiv({
			text: formatMinutesToDuration(monthHours ?? 0),
			cls: "project-time-value"
		})

		projectSection?.replaceWith(newDiv);
		projectSection = newDiv;
	}

	async initialDataRefresh(): Promise<void> {

		this.timeSummaries = await this.timeTracker.getCurrentTimeSummaries();
		this.sessionActive = await this.timeTracker.getActiveProjectSession(this.selectedProjectPath);
		// await this.summaryTable.updateSummaryRows()
		await this.updateActiveSessionIcon()
		await this.updateSessionControlButtons()
	}

	async updateSummaryData(): Promise<void> {

		this.timeSummaries = await this.timeTracker.getCurrentTimeSummaries();
		this.sessionActive = await this.timeTracker.getActiveProjectSession(this.selectedProjectPath);
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
		await this.buildProjectStats(this.generalSummary)

		await this.updateSummaryData()

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


