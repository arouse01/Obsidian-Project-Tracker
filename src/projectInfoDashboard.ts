import {
	App,
	Component,
} from 'obsidian';
import {
	ProjectInfo
} from "./types";
import {
	normalizeWikiLink,
	getFrontmatterString,
	getFrontmatterStringArray
} from './utils';
import { MyProjectManager } from './projectManager'


export class ProjectInfoSingle extends Component {

	private container: HTMLDivElement;

	private selectedProjectInfo: ProjectInfo | null = null

	constructor(
		private selectedProjectPath: string | null,
		target: HTMLDivElement,
		private app: App,
		private projectManager: MyProjectManager,
	) {
		super();

		this.container = target;

		// this.tableContainer = target.createDiv();

		void this.buildDashboard();

	}


	async selectProject(project: string) {
		this.selectedProjectPath = project;
		this.selectedProjectInfo = this.projectManager.getProjectInfoByPath(this.selectedProjectPath)
		this.container.empty()
		await this.buildDashboard()
		await this.updateValues()
		// void this.updateTodoRows();
	}

	private async buildDashboard() {
		await this.updateValues()

		const mainSection = this.container.createEl("section");
		mainSection.addClass("project-stats")
		// mainSection.addClass("font-size-16")

		
		// mainSection.addClass("project-dashboard")

		const primary = normalizeWikiLink(this.selectedProjectInfo?.client ?? "")
		const collaborators = getFrontmatterStringArray(this.app.metadataCache, this.selectedProjectInfo!.file, "Collaborators")

		const primaryDiv = mainSection.createDiv()
		primaryDiv.createEl("label", { text: 'Primary: ' })
		primaryDiv.createEl("label", { text: primary, cls: "bold" })

		const collabDiv = mainSection.createDiv()
		collabDiv.createEl("label", { text: 'Collaborators: ' })
		collabDiv.createEl("label", { text: collaborators.join(", "), cls: "bold" })
			
		}

	
	
/*
	private async createControls(sessionControls: HTMLDivElement) {
		sessionControls.addClass("project-controls")
		// sessionControls.addClass("project-time-section")
		const activeSession = await this.timeTracker.getActiveProjectSession(this.selectedProjectPath!);

		if (this.selectedProjectInfo !== null) {
			const project = this.selectedProjectInfo
			const activeIndicator = sessionControls.createDiv({
				text: "Status: ",
				cls: "font-size-16"
			})
			activeIndicator.addClass("right-align")
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


			// const activeSession = await this.timeTracker.getActiveProjectSession(this.selectedProject!);
			if (activeSession) {
				const indicator = activeIndicator.createDiv({ cls: "active-indicator-large" });
				indicator.createDiv({ cls: "blinky-circle-green-large" })
				const span = indicator.createSpan();  //⏲
				span.setText("🟢")
			} else {
				const indicator = activeIndicator.createDiv({ cls: "active-indicator-large" });
				indicator.createDiv()
				const span = indicator.createSpan({ cls: "blinky-circle-null-large" });  //⏲
				span.setText("⚪️")
			}


			
		}
	}
*/
	async updateValues(): Promise<void> {
		// const activeSessions = await this.timeTracker.getActiveSessions();
		// this.activeSessionMap = new Map(
		// 	activeSessions.map(session => [session.projectPath, session])
		// );
		// this.timeSummaries = await this.timeTracker.getCurrentTimeSummaries();
		// await this.summaryTable.updateSummaryRows()


	}
	



}


