import {
	App,
	Component,
	ButtonComponent,
	Notice
} from 'obsidian';
import { MyProjectManager } from '@/projects/projectManager';
import { ProjectOption } from '@/utils/types';
import { TimeTracker } from '@/time/timeTracker';
import { IssueTracker }from '@/issues/issueTracker';
import { TodoManager } from '@/todos/todoTracker';
import { TodoDashboardView } from '@/todos/todoDashboard';
import { IssueDashboardView } from '@/issues/issueDashboard';
import { TimeSummarySingle } from '@/time/timeSummarySingle';
import { ProjectInfoSingle } from '@/projects/projectInfoDashboard';
import { NoteDashboard } from '@/notes/noteDashboard';
import { NoteManager } from '@/notes/noteManager';

const DASHBOARD_TABS = ["Todos", "Issues", "Meeting notes", "Other project notes"] as const;
type DashboardTab = typeof DASHBOARD_TABS[number];

export class ProjectSingleView extends Component {
	private refreshInterval: number | null = null;

	private projectTitle!: HTMLDivElement;
	private timeEl!: HTMLDivElement;
	private todoEl!: HTMLDivElement;
	private detailsEl!: HTMLDivElement;
	private issueEl!: HTMLDivElement;
	private meetingEl!: HTMLDivElement;
	private otherNoteEl!: HTMLDivElement;
	private projectSelect!: HTMLSelectElement;

	selectedProject: string | undefined;
	private timeTable: TimeSummarySingle | undefined;
	private todoTable: TodoDashboardView | undefined;
	private detailsSection: ProjectInfoSingle | undefined;
	private issueTable: IssueDashboardView | undefined;
	private meetingTable: NoteDashboard | undefined;
	private otherNoteTable: NoteDashboard | undefined;

	private activeTab: DashboardTab;
	private tabButtons = new Map<DashboardTab, ButtonComponent>();

	constructor(
		private container: HTMLElement,
		private app: App,
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager,
		private issueTracker: IssueTracker,
		private todoManager: TodoManager,
		private noteManager: NoteManager,
		private project?: string | undefined,
		activeTab: DashboardTab = "Issues"
	) {
		super();
		this.selectedProject = this.project
		this.activeTab = activeTab
	}

	getViewType(): string {
		return "project-view";
	}

	getDisplayText(): string {
		return "Project view";
	}

	getIcon(): string {
		return 'square-chart-gantt';
	}

	onload(): void {
		this.registerEvent(
			this.timeTracker.on("time-tracker-updated", () => {
				// void this.setActiveIndicator()
				void this.timeTable?.refreshDashboard()
			})
		);
		this.registerEvent(
			this.timeTracker.on("time-allocations-updated", () => {
				// when a session is started, stopped, or a whole one is added
				void this.timeTable?.refreshDashboard()
			})
		);
		void this.initialize();

		this.refreshInterval = window.setInterval(() => {
			void this.updateProjectView();
		}, 60000);
	}

	private async initialize(): Promise<void> {
		// await this.updateSummaryVars();
		await this.buildDashboard();
		await this.updateTableRows();
	}
	// async setState(
	// 	state: Record<string, unknown>,
	// 	result: ViewStateResult,
	// ): Promise<void> {
	// 	if (
	// 		state.activeTab === "Issues" ||
	// 		state.activeTab === "Todos" ||
	// 		state.activeTab === "Meeting notes" || 
	// 		state.activeTab === "Other project notes"
	// 	) {
	// 		this.activeTab = state.activeTab;
	// 	}

	// 	await super.setState(state, result);
	// }
	async onClose(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	private async buildDashboard() {

		/*

		┌─────────────────────────────────────────────────────────────────────────────┐
		│                                    Project name                  [●━] Active│
		│ Client | Status | Collaborators |                                           │
		│                                                                             │
		├─────────────────────────────────────────────────────────────────────────────┤
		│                      [ Start ]           [ Start at ]                       │
		│                 Worked today | This week | This month                       │
		│                     Expandable weekday breakdown                            │
		├─────────────────────────────────────────────────────────────────────────────┤
		│ Issues                     [_Filters_]                               [ Add ]│
		│ ┌─────────────┬──────────────┬─────────────┬──────────────┬─────────────┐   │
		│ │ Priority    │ Name         │ Status      │ Start Date   │ Goto        │   │
		│ ├─────────────┼──────────────┼─────────────┼──────────────┼─────────────┤   │
		│ │             │              │             │              │             │↕  │
		│ └─────────────┴──────────────┴─────────────┴──────────────┴─────────────┘   │
		├─────────────────────────────────────────────────────────────────────────────┤
		│ Todos                      [_Filters_]                               [ Add ]│
		│ ┌───────────┬───────────┬───────────┬───────────┬───────────┬───────────┐   │
		│ │ Check     │ Priority  │ Todo      │ Desc      │ Added     │ Due       │   │
		│ ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤   │
		│ │           │           │           │           │           │           │↕  │
		│ └───────────┴───────────┴───────────┴───────────┴───────────┴───────────┘   │
		├─────────────────────────────────────────────────────────────────────────────┤
		│ Meetings                    [_Filters_]                              [ Add ]│
		│ ┌─────────────┬──────────────┬─────────────┬──────────────┬─────────────┐   │
		│ │ Filename    │ Date         │ Topic       │ People       │ Goto        │   │
		│ ├─────────────┼──────────────┼─────────────┼──────────────┼─────────────┤   │
		│ │             │              │             │              │             │↕  │
		│ └─────────────┴──────────────┴─────────────┴──────────────┴─────────────┘   │
		├─────────────────────────────────────────────────────────────────────────────┤
		│ Notes                          [_Filters_]                           [ Add ]│
		│ ┌───────────────────────┬───────────────────────┬───────────────────────┐   │
		│ │ Filename              │ Tags                  │ Goto                  │   │
		│ ├───────────────────────┼───────────────────────┼───────────────────────┤   │
		│ │                       │                       │                       │↕  │
		│ └───────────────────────┴───────────────────────┴───────────────────────┘   │
		└─────────────────────────────────────────────────────────────────────────────┘


		*/
		const dashboardContainer = this.container.createDiv({cls: 'project-dashboard'})
		const projectSection = dashboardContainer.createDiv({ cls: "section-header project-title-section dashboard" })
		const titleSection = projectSection.createDiv({cls: "project-title-with-button"})
		this.projectTitle = titleSection.createDiv({cls: "project-title"})
		const linkDiv = titleSection.createDiv({ cls: "dashboard" })
		
		new ButtonComponent(linkDiv)
			.setIcon("file-symlink")
			.setClass("font-size-12")
			.onClick(async () => {
				const files = this.app.vault.getMarkdownFiles();
				const projectNotePath = files.find(file => file.path === this.selectedProject);
				if (projectNotePath) {
					// event.preventDefault();
					const existingLeaf = this.app.workspace.getLeavesOfType(
						"markdown"
					).find(leaf => {
						const view = leaf.view;
						return view.getState().file === projectNotePath.path;
					});

					if (existingLeaf) {
						void this.app.workspace.revealLeaf(existingLeaf);
					} else {
						void this.app.workspace.getLeaf(false).openFile(projectNotePath);
					}
				} else {
					new Notice(`Project note file not found (${this.selectedProject}).`);
				}
			});
		
		/*this.projectTitle.addEventListener("click", (event) => {
			event.preventDefault();

			// right-click menu
			const menu = new Menu();
			const files = this.app.vault.getMarkdownFiles();
			const projectNotePath = files.find(file => file.path === this.selectedProject);
			if (projectNotePath) {
				menu.addItem((item) => {
					item.setTitle("Open project Markdown file")
						.onClick(async () => {
							// event.preventDefault();
							const existingLeaf = this.app.workspace.getLeavesOfType(
								"markdown"
							).find(leaf => {
								const view = leaf.view;
								return view.getState().file === projectNotePath.path;
							});

							if (existingLeaf) {
								void this.app.workspace.revealLeaf(existingLeaf);
							} else {
								void this.app.workspace.getLeaf(false).openFile(projectNotePath);
							}
						});
				})
				menu.showAtMouseEvent(event);
			}

		})*/
			
		this.projectSelect = projectSection.createEl("select", {cls: "dropdown-new project-selector"});
		this.projectSelect.required = true;
		this.updateProjectSelector()
		
		this.registerDomEvent(this.projectSelect, "change", async () => {
			const path = this.projectSelect.value;
			if (path !== "") {
				this.selectedProject = path;
				await this.handleProjectChange(path);
				this.projectSelect.value = "";
			}


		});

		const detailsSection = dashboardContainer.createDiv({ cls: "single-project-section" });

		this.detailsEl = detailsSection.createDiv()
		dashboardContainer.createEl("hr")

		const timeSection = dashboardContainer.createDiv({ cls: "single-project-section" });
		this.timeEl = timeSection.createDiv()
		dashboardContainer.createEl("hr")

		const projectTabsArea = dashboardContainer.createDiv({ cls: "dashboard-tab-container" });
		await this.buildTabs(projectTabsArea)

		const contentArea = dashboardContainer.createDiv({ cls: "dashboard-tab-area" })
		
		await this.buildContentArea(contentArea)
		
		this.showTab(this.activeTab)

		
	}

	async buildContentArea(parent: HTMLDivElement): Promise<void> {
		this.todoEl = parent.createDiv({ cls: "single-project-section project-section", attr: { name: "single-project-todo-dashboard" } })
		this.issueEl = parent.createDiv({ cls: "single-project-section project-section", attr: { name: "single-project-issue-dashboard" } })
		this.meetingEl = parent.createDiv({ cls: "single-project-section project-section", attr: { name: "single-project-meetings-dashboard" } })
		this.otherNoteEl = parent.createDiv({ cls: "single-project-section project-section", attr: { name: "single-project-notes-dashboard" } })
/*
		this.projectDashboard = new ProjectDashboardView(
			projectViewEl,
			this,
			this.app,
			this.plugin.timeTracker,
			this.plugin.projectManager,
			this.plugin.issueTracker,
			this.plugin.todoManager
		)
		this.addChild(this.projectDashboard)

		this.todoDashboard = new TodoDashboardView(
			todoEl,
			this.app,
			this.plugin.todoManager,
			this.plugin.projectManager
		)
		this.addChild(this.todoDashboard)

		this.issueDashboard = new IssueDashboardView(
			issueEl,
			this.app,
			this.plugin.issueTracker,
			this.plugin.projectManager
		)
		this.addChild(this.issueDashboard)

		this.singleProjectDashboard = new ProjectSingleView(
			singleProjectEl,
			this.app,
			this.plugin.timeTracker,
			this.plugin.projectManager,
			this.plugin.issueTracker,
			this.plugin.todoManager,
			this.plugin.noteManager
		)
		this.addChild(this.singleProjectDashboard)

		// this.projectDashboard.setSingleProjectView(this.singleProjectDashboard)

		this.projectViewEl = projectViewEl;
		this.todoEl = todoEl;
		this.timeEl = timeEl;
		this.issueEl = issueEl;
		this.singleProjectEl = singleProjectEl;

		void this.showTab(this.activeTab);
		*/
		
		/*

		dashboardContainer.createEl("hr")


		// build issue table section
		const issueSection = dashboardContainer.createDiv({ cls: "single-project-section" });
		issueSection.createDiv({ text: "Project issues", cls: "section-header" });
		this.issueEl = issueSection.createDiv()

		dashboardContainer.createEl("hr")

		// build todo section
		const todoSection = dashboardContainer.createDiv({ cls: "single-project-section" });
		todoSection.createDiv({ text: "Project todos", cls: "section-header" })
		this.todoEl = todoSection.createDiv({ cls: "project-section" });

		dashboardContainer.createEl("hr")

		// build meeting section
		const meetingSection = dashboardContainer.createDiv({ cls: "single-project-section" });
		meetingSection.createDiv({ text: "Meeting notes", cls: "section-header" })
		this.meetingEl = meetingSection.createDiv()


		dashboardContainer.createEl("hr")

		// build other notes section
		const noteSection = dashboardContainer.createDiv({ cls: "single-project-section" });
		noteSection.createDiv({ text: "Other project notes", cls: "section-header" })
		this.otherNoteEl = noteSection.createDiv()*/
	}

	updateProjectSelector() {
		const placeholder = this.projectSelect.createEl("option", {
			value: "",
			text: "Select a project"
		})
		placeholder.hidden = true;
		for (const project of this.getProjectOptions()) {
			this.projectSelect.createEl("option", {
				value: project.path,
				text: project.name
			})
		}
	}

	private async buildTabs(header: HTMLElement): Promise<void> {

		const tabArea = header.createDiv({
			cls: "dashboard-tabs"
		})
		// tabArea.setCssStyles("display: flex")
		// const tabs = header.createDiv({
		// 	cls: "dashboard-tabs"
		// })
		// const newTable = tabArea.createEl('table')
		// newTable.addClass("dashboard-tab-table")
		// const row = newTable.createEl('tr');
		for (const tab of DASHBOARD_TABS) {
			// const cell = row.createEl("td");
			const button = new ButtonComponent(tabArea)
				.setButtonText(tab)
				// .setClass("dashboard-tab")
				.onClick(async () => {
					const value = tab;
					this.activeTab = value;
					void this.showTab(this.activeTab);
				});

			this.tabButtons.set(tab, button);
		}

		new ButtonComponent(tabArea)
			.setIcon("refresh-cw")
			.setClass("dev-button")
			.onClick(async () => {
				await this.refreshTabs();
			});
	}

	showTab(tab: DashboardTab): void {
		this.issueEl.hidden = tab !== "Issues";
		this.todoEl.hidden = tab !== "Todos";
		this.meetingEl.hidden = tab !== "Meeting notes";
		this.otherNoteEl.hidden = tab !== "Other project notes";

		for (const [tab, button] of this.tabButtons) {
			button.buttonEl.toggleClass(
				"button-selected",
				this.activeTab === tab
			)
		}
	}

	switchTab(tab: DashboardTab): void {
		this.activeTab = tab;
		void this.showTab(this.activeTab);
	}

	async refreshTabs(): Promise<void> {
		if (this.detailsSection === undefined) {  // just check the details section, don't need to check them all
			await this.initializeComponents()
		}
		try {
			await Promise.all([
				// this.detailsSection?.refresh(path),
				this.timeTable?.refreshDashboard(),
				this.issueTable?.refresh(),
				this.todoTable?.refresh(),
				this.meetingTable?.refresh(),
				this.otherNoteTable?.refresh()
			]);
		} catch (error) {
			console.error("Failed to update project view", error);
		} 
	}

	async changeSelectedProject(path: string): Promise<void> {
		this.projectSelect.value = ""
		await this.handleProjectChange(path)
	}

	private async handleProjectChange(path: string): Promise <void> {
		this.selectedProject = path;
		this.projectTitle.setText(this.projectManager.getProjectNameByPath(path) ?? "")
		if (this.detailsSection === undefined) {  // just check the details section, don't need to check them all
			await this.initializeComponents()
		}
		try {
			await Promise.all([
				this.detailsSection?.selectProject(path),
				this.timeTable?.selectProject(path),
				this.issueTable?.selectProject(path),
				this.todoTable?.selectProject(path),
				this.meetingTable?.selectProject(path),
				this.otherNoteTable?.selectProject(path)
			]);
		} catch(error) {
			console.error("Failed to update project view", error);
		}
	}

	private async initializeComponents(): Promise<void> {
		if (this.selectedProject) {
			this.timeTable = new TimeSummarySingle(
				this.selectedProject,
				this.timeEl,
				this.app,
				this.timeTracker,
				this.projectManager,
				"week",
				0
			)
			this.detailsSection = new ProjectInfoSingle(
				this.selectedProject,
				this.detailsEl,
				this.app,
				this.projectManager
			)
			this.todoTable = new TodoDashboardView(
				this.todoEl,
				this.todoManager,
				this.projectManager,
				this.selectedProject
			)
			this.issueTable = new IssueDashboardView(
				this.issueEl,
				this.app,
				this.issueTracker,
				this.projectManager,
				this.selectedProject
			)
			this.meetingTable = new NoteDashboard(
				this.meetingEl,
				"meeting",
				this.app,
				this.noteManager,
				this.projectManager,
				this.selectedProject
			)
			this.otherNoteTable = new NoteDashboard(
				this.otherNoteEl,
				"other",
				this.app,
				this.noteManager,
				this.projectManager,
				this.selectedProject
			)

			this.addChild(this.timeTable)
			this.addChild(this.detailsSection)
			this.addChild(this.todoTable)
			this.addChild(this.issueTable)
			this.addChild(this.meetingTable)
			this.addChild(this.otherNoteTable)
		}
	}

	
	private updateProjectView() {

	}

	

	private async updateTableRows() {
		// Update all tables on the layout

	}

	private getProjectOptions(): ProjectOption[] {
		const files = this.app.vault.getMarkdownFiles();
		const projectFiles = files.filter(file =>
			file.path.startsWith("Projects/")  // Get all md files in the Projects folder
		);
		return projectFiles.map(file => {

			return {
				path: file.path,
				name: file.basename,
			};

		})
			.sort((a, b) =>
				a.name.localeCompare(b.name)
			);
	}

	


	
	
}

