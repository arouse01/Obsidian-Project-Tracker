import {
	App,
	Component,
	// Menu,
	// ButtonComponent,
	TFile,
	// setIcon
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	// PeriodicTimeSummary,
	ProjectInfo,
	// TimeSession,
	// TimeSummary
	ProjectOption
} from "./types";
import {
	// formatMinutesToDuration,
	// formatDate,
	// normalizeWikiLink
} from './utils';
import { TimeTracker } from './timeTracker';
// import { TimeModal } from './timeModal';
import IssueTracker from './issueTracker';
import { TodoManager } from './todoTracker';
import {
	// SummaryPeriod,
	// getSummaryPeriod,
	// SummaryGroup,
	// sortItems,
	// GroupDefs,
	// ColSort,
	// TableColumn,
	// SummaryColumn,
	// updateSortButtons,
	// getGroupOptions
} from './tableFunctions';
import {
	TodoDashboardView
} from './todoDashboard'

// type SingleViewSection = "Issues" | "Todos" | "Meetings" | "Notes"

export class ProjectSingleView extends Component {
	private refreshInterval: number | null = null;

	selectedProject: string | null;
	private todoTable!: TodoDashboardView;

	constructor(
		private container: HTMLElement,
		private app: App,
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager,
		private issueTracker: IssueTracker,
		private todoManager: TodoManager,
		private project: string | null = null
	) {
		super();
		this.selectedProject = project
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
				// void this.updateTimeValues()
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
		const dashboardContainer = this.container.createDiv({ cls: "project-section" })
		dashboardContainer.addClass('project-dashboard')
		const detailsSection = dashboardContainer.createDiv({ cls: "project-section" });

		detailsSection.createEl("h3", {
			text: "Projects"
		});
		const select = detailsSection.createEl("select");
		select.addClass("dropdown-new")
		for (const project of this.getProjectOptions()) {
			select.createEl("option", {
				value: project.path,
				text: project.name
			})
		}
		select.addEventListener("change", () => {
			const path = select.value;
			this.selectedProject = path;
			void this.todoTable.selectProject(path)


		});

		dashboardContainer.createEl("hr")
		// build the time tracker section
		const timeSection = dashboardContainer.createDiv({ cls: "project-section" });
		timeSection.createEl("h4", { text: "Hours worked" });

		dashboardContainer.createEl("hr")
		// build issue table section
		const issueSection = dashboardContainer.createDiv({ cls: "project-section" });
		issueSection.createEl("h4", { text: "Project issues" });
		await this.buildSection(issueSection)
		dashboardContainer.createEl("hr")

		// build todo section
		const todoSection = dashboardContainer.createDiv({ cls: "project-section" });
		todoSection.createEl("h4", { text: "Project todos" });
		const todoTableSection = todoSection.createDiv({ cls: "project-section" });
		await this.buildTodoSection(todoTableSection)
		dashboardContainer.createEl("hr")

		// build meeting section
		const meetingSection = dashboardContainer.createDiv({ cls: "project-section" });
		await this.buildSection(meetingSection)
		dashboardContainer.createEl("hr")

		// build other notes section
		const noteSection = dashboardContainer.createDiv({ cls: "project-section" });
		await this.buildSection(noteSection)
		
	}

	private async buildSection(section: HTMLDivElement) {

		const controlSection = section.createDiv({ cls: 'project-controls' });
		controlSection.addClass("control-col")

		const controlRow1 = controlSection.createDiv({ cls: 'project-controls' });
		controlRow1.addClass("control-row")
		// filter buttons
		const filterSection = controlRow1.createDiv({ cls: 'project-controls' });
		// filterSection.addClass("control-row")
		filterSection.createEl("label", { text: 'Show only:' })
		// const filterSelect = filterSection.createEl('select', {
		// 	cls: 'dropdown-new'
		// });
		/*for (const filter of PROJECT_STATUS_FILTERS) {
			filterSelect.createEl('option', {
				value: filter, //'project',
				text: filter
			});
		}
		filterSelect.value = this.filterBy;
		filterSelect.addEventListener("change", () => {
			const value = filterSelect.value;
			// if ((PROJECT_STATUS_FILTERS as readonly string[]).includes(value)) {
			this.filterBy = value as ProjectStatusFilter;
			void this.rebuildProjectTable();
	// }

		});*/
	}

	private async buildTodoSection(section: HTMLDivElement) {
		this.todoTable = new TodoDashboardView(
			section,
			this.app,
			this.todoManager,
			this.projectManager,

		)
		this.addChild(this.todoTable)
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

	getProjects(): ProjectInfo[] {
		// Get all projects and return their status
		const files = this.app.vault.getMarkdownFiles();
		const projectFiles = files.filter(file =>
			file.path.startsWith("Projects/")  // Get all md files in the Projects folder
		);
		return projectFiles.map(file => {

			return {
				file: file,
				name: file.basename,
				status: this.getFrontmatterString(file, "Project Status"),
				client: this.getFrontmatterString(file, "Primary")
			};

		})
		.sort((a, b) =>
			a.name.localeCompare(b.name)
		);
	}

	getActiveProjects(): ProjectInfo[] {
		return this.getProjects().filter(project =>
			project.status === "Active"
		);	
	}

	getArchivedProjects(): ProjectInfo[] {
		return this.getProjects().filter(project =>
			project.status === "Archived" ||
			project.status === "Inactive"
		);
	}

	getProjectInfoByPath(path: string | null): ProjectInfo | null {
		if (path === null) {
			return null;
		}

		return this.getActiveProjects().find(
			p => p.file.path === path
		) ?? null;
	}

	getProjectNameByPath(path: string | null): string | null {
		if (path === null) {
			return null;
		}

		const project = this.getActiveProjects().find(
			p => p.file.path === path
		) ?? null;

		return project?.name ?? null;
	}

	private getFrontmatterValue(
		// So we can access without worrying about spaces
		file: TFile,
		property: string
	): unknown {
		const cache = this.app.metadataCache.getFileCache(file);

		return cache?.frontmatter?.[property];

	}

	public getFrontmatterString(
		file: TFile,
		property: string
	): string {

		const value =
			this.getFrontmatterValue(file, property);

		return typeof value === "string"
			? value
			: "";
	}

	public getFrontmatterStringArray(
		file: TFile,
		property: string
	): string[] {

		const cache = this.app.metadataCache.getFileCache(file);
		const value: unknown = cache?.frontmatter?.[property];

		if (typeof value === "string") {
			return [value.replace(/^\[\[\]\]$/g, "")];
		}

		if (Array.isArray(value)) {
			return value
				.filter((v): v is string => typeof v === "string")
				.map(v => v.replace(/^\[\[|\]\]$/g, ""));
		}

		return [];
	}
	
}

