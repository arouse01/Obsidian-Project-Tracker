import {
	App,
	Component,
	ButtonComponent,
	Notice
} from 'obsidian';
import {
	ProjectInfo
} from '@/utils/types';
import {
	normalizeWikiLink,
	// getFrontmatterString,
	getFrontmatterStringArray,
	getFrontmatterNumber
} from '@/utils/utils';
import { MyProjectManager } from '@/projects/projectManager'


export class ProjectInfoSingle extends Component {

	private container: HTMLDivElement;

	private selectedProject: ProjectInfo | undefined

	constructor(
		private projectPath: string,
		target: HTMLDivElement,
		private app: App,
		private projectManager: MyProjectManager,
	) {
		super();

		this.container = target;

		const project = this.projectManager.getProjectInfoByPath(projectPath)
		if (project === undefined) {
			throw new Error(`Project not found: ${projectPath}`);
		}
		this.selectedProject = project
		// this.tableContainer = target.createDiv();

		void this.buildDashboard();

	}


	async selectProject(projectPath: string) {
		const project = this.projectManager.getProjectInfoByPath(projectPath)
		if (project === undefined) {
			throw new Error(`Project not found: ${projectPath}`);
		}
		this.selectedProject = project
		
		this.container.empty()
		await this.buildDashboard()
		await this.updateValues()
		// void this.updateTodoRows();
	}

	private async buildDashboard() {
		await this.updateValues()

		// const mainSection = this.container.createEl("section");
		this.container.addClass("project-stats")
		this.container.addClass("control-col")
		// mainSection.addClass("font-size-16")
		
		if (this.selectedProject) {
			
		
		
			// this.container.addClass("project-dashboard")
			const statsSection = this.container.createDiv({ cls: "project-stats" })
			const primary = normalizeWikiLink(this.selectedProject?.client ?? "")
			const collaborators = getFrontmatterStringArray(this.app.metadataCache, this.selectedProject.file, "Collaborators")

			const primaryDiv = statsSection.createDiv()
			primaryDiv.createEl("label", { text: 'Primary: ' })
			primaryDiv.createEl("label", { text: primary, cls: "bold" })

			const collabDiv = statsSection.createDiv()
			collabDiv.createEl("label", { text: 'Collaborators: ' })
			collabDiv.createEl("label", { text: collaborators.join(", "), cls: "bold" })

			const tags = getFrontmatterStringArray(this.app.metadataCache, this.selectedProject.file, "tags")
			const tagsDiv = statsSection.createDiv()
			tagsDiv.createEl("label", { text: 'Tags: ' })
			tagsDiv.createEl("label", { text: tags.join(", "), cls: "bold" })

			// const hours = getFrontmatterNumber(this.app.metadataCache, this.selectedProject!.file, "targetHours")
			if (this.selectedProject.targetHours) {
				const hours = this.selectedProject.targetHours.hours
				const period = this.selectedProject.targetHours.period
				const hoursDiv = statsSection.createDiv()
				hoursDiv.createEl("label", { text: period === "month" ? 'Hours/month: ' : 'Hours/week: ' })
				hoursDiv.createEl("label", { text: hours.toString(), cls: "bold" })
			}
		}
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


