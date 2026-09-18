import {
	// App,
	ButtonComponent,
	ItemView,
	// TFile,
	// MarkdownView,
	// MarkdownFileInfo,
	Notice,
	WorkspaceLeaf,
	ViewStateResult
} from 'obsidian';
import ProjectTrackerPlugin from './main'
import {
	// IssueTrackerSettings,
} from './settings';
import {
	// IssueContext,
	// CreateIssueRequest,
	// ProjectInfo,
	// IssueModalOptions
} from "./types";
import {
	// PRIORITIES,
	VIEW_TYPE_TRACKER,
} from "./constants";
import {
	// formatIssueID,
	// formatDate,
	// normalizeWikiLink
} from './utils';
// import { IssueModal } from './issueModal'
// import { MyProjectManager } from './projectManager'
import {
	// TimeDashboardView
} from './timeDashboard';
import {
	ProjectDashboardView
} from './projectDashboard'
import {
	ProjectSingleView
} from './projectView'
import {
	TodoDashboardView
} from './todoDashboard'

const DASHBOARD_TABS = ["Projects", "Todos", "Single Project"] as const;
type DashboardTab = typeof DASHBOARD_TABS[number];

export class TrackerView extends ItemView {

	private activeTab: DashboardTab

	private projectDashboard!: ProjectDashboardView;
	private todoDashboard!: TodoDashboardView;
	private singleProjectDashboard!: ProjectSingleView;

	private projectViewEl!: HTMLElement
	private todoEl!: HTMLElement
	private timeEl!: HTMLElement
	private singleProjectEl!: HTMLElement

	private header!: HTMLElement;
	private container!: HTMLElement;

	private tabButtons = new Map<DashboardTab, ButtonComponent>();
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: ProjectTrackerPlugin,
		private getDevNotePath: () => string | undefined,
		activeTab: DashboardTab = "Projects"

	) {
		super(leaf)
		this.activeTab = activeTab
	}

	async setState(
		state: Record<string, unknown>,
		result: ViewStateResult,
	): Promise<void> {
		if (
			state.activeTab === "Projects" ||
			state.activeTab === "Todos"
		) {
			this.activeTab = state.activeTab;
		}

		await super.setState(state, result);
	}

	getViewType(): string {
		return VIEW_TYPE_TRACKER;
	}

	getDisplayText(): string {
		return "Project tracker";
	}

	getIcon(): string {
		return 'folder-open-dot';
	}

	async onOpen(): Promise<void> {
		await this.buildLayout();
		await this.buildTabs(this.header);

		const projectViewEl = this.container.createDiv()
		const todoEl = this.container.createDiv()
		const timeEl = this.container.createDiv()
		const singleProjectEl = this.container.createDiv()

		this.projectDashboard = new ProjectDashboardView(
			projectViewEl,
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

		this.singleProjectDashboard = new ProjectSingleView(
			singleProjectEl,
			this.app,
			this.plugin.timeTracker,
			this.plugin.projectManager,
			this.plugin.issueTracker,
			this.plugin.todoManager
		)
		this.addChild(this.singleProjectDashboard)

		this.projectViewEl = projectViewEl;
		this.todoEl = todoEl;
		this.timeEl = timeEl;
		this.singleProjectEl = singleProjectEl;

		void this.showTab(this.activeTab);

	}

	private async buildLayout(): Promise<void> {
		this.contentEl.empty();
		this.header = this.contentEl.createDiv()

		this.container = this.contentEl.createDiv()
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

		// const devButtonArea = tabArea.createDiv({
		//  	cls: "right-align"
		// })
		const devNotePath = this.getDevNotePath()
		if (devNotePath) {
			const files = this.app.vault.getMarkdownFiles();
			const devNoteFile = files.find(file => file.path === devNotePath);
			if (devNoteFile) {
				new ButtonComponent(tabArea)
					.setButtonText("Developer notes")
					.setClass("dev-button")
					.onClick(async () => {
						// event.preventDefault();
						const existingLeaf = this.app.workspace.getLeavesOfType(
							"markdown"
						).find(leaf => {
							const view = leaf.view;
							return view.getState().file === devNoteFile.path;
						});

						if (existingLeaf) {
							void this.app.workspace.revealLeaf(existingLeaf);
						} else {
							void this.app.workspace.getLeaf(false).openFile(devNoteFile);
						}
					});
				// devButton.buttonEl.classList.remove("dashboard-tabs")
			} else {
				new Notice(`Developer notes file not found (${devNotePath}).`);
			}
		}

	}

	showTab(tab: DashboardTab): void {
		this.projectViewEl.hidden = tab !== "Projects";
		this.todoEl.hidden = tab !== "Todos";
		this.singleProjectEl.hidden = tab !== "Single Project";

		for (const [tab, button] of this.tabButtons) {
			button.buttonEl.toggleClass(
				"button-selected",
				this.activeTab === tab
			)
		}
	}

	// private async rebuildContent(): Promise<void> {
	// 	switch (this.activeTab) {
	// 		case ("Projects"): {
	// 			const dashboard = new ProjectDashboardView(
	// 				container,
	// 				this.plugin.timeTracker,
	// 				this.plugin.projectManager,
	// 				this.plugin.issueTracker,
	// 				this.plugin.todoManager
	// 			)
	// 		}
				
	// 	}
	// }

	

	onunload() {}

}

