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
	getFrontmatterStringArray
	// normalizeWikiLink
} from './utils';
import { TimeTracker } from './timeTracker';
// import { TimeModal } from './timeModal';
import { IssueTracker }from './issueTracker';
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
import {
	IssueDashboardView
} from './issueDashboard'
import {
	TimeSummarySingle
} from './timeSummaryTable'
import {
	ProjectInfoSingle
} from './projectInfoDashboard';

// type SingleViewSection = "Issues" | "Todos" | "Meetings" | "Notes"

export class ProjectSingleView extends Component {
	private refreshInterval: number | null = null;

	selectedProject: string | null;
	private timeTable!: TimeSummarySingle;
	private todoTable!: TodoDashboardView;
	private detailsSection!: ProjectInfoSingle;
	private issueTable!: IssueDashboardView;

	private indicatorSection!: HTMLDivElement;

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
				// void this.setActiveIndicator()
				void this.timeTable.updateSummaries()
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
		const dashboardContainer = this.container.createDiv()
		dashboardContainer.addClass('project-dashboard')
		const projectSection = dashboardContainer.createDiv({cls: "section-header"})
		projectSection.addClass("dashboard")
		const select = projectSection.createEl("select");
		select.addClass("dropdown-new")
		select.addClass("center-align")
		select.addClass("project-selector")
		for (const project of this.getProjectOptions()) {
			select.createEl("option", {
				value: project.path,
				text: project.name
			})
		}
		this.registerDomEvent(select, "change", async () => {
			const path = select.value;
			this.selectedProject = path;
			await this.handleProjectChange(path)


		});
		// this.indicatorSection = projectSection.createDiv({cls: "right-align"})
		
		
		const detailsSection = dashboardContainer.createDiv({ cls: "project-section" });
		detailsSection.createDiv({ text: "Project details", cls: "section-header" })
		const detailsTableSection = detailsSection.createDiv()
		await this.buildDetailsSection(detailsTableSection)
		

		dashboardContainer.createEl("hr")

		// build the time tracker section
		const timeSection = dashboardContainer.createDiv({ cls: "project-section" });
		timeSection.createDiv({ text: "Hours worked", cls: "section-header" }) 
		const timeTableSection = timeSection.createDiv()
		await this.buildTimeSectionContents(timeTableSection)
		// this.timeTable = new TimeSummarySingle(this.selectedProject, timeSection, this.app, this.timeTracker, this.projectManager, "week", 0)

		dashboardContainer.createEl("hr")

		// build issue table section
		const issueSection = dashboardContainer.createDiv({ cls: "project-section" });
		issueSection.createDiv({ text: "Project issues", cls: "section-header" });
		const issueTableSection = issueSection.createDiv()
		await this.buildIssueSectionContents(issueTableSection)

		dashboardContainer.createEl("hr")

		// build todo section
		const todoSection = dashboardContainer.createDiv({ cls: "project-section" });
		todoSection.createDiv({ text: "Project todos", cls: "section-header" })
		const todoTableSection = todoSection.createDiv({ cls: "project-section" });
		await this.buildTodoSectionContents(todoTableSection)

		dashboardContainer.createEl("hr")

		// build meeting section
		const meetingSection = dashboardContainer.createDiv({ cls: "project-section" });
		meetingSection.createDiv({ text: "Meeting notes", cls: "section-header" }) 
		const meetingTableSection = meetingSection.createDiv()
		await this.buildSection(meetingTableSection)

		dashboardContainer.createEl("hr")

		// build other notes section
		const noteSection = dashboardContainer.createDiv({ cls: "project-section" });
		noteSection.createDiv({ text: "Other project notes", cls: "section-header" }) 
		const noteTableSection = noteSection.createDiv()
		await this.buildSection(noteTableSection)
		
	}
	
	private async handleProjectChange(path: string): Promise < void> {
	this.selectedProject = path;

	try {
		await Promise.all([
			this.detailsSection.selectProject(path),
			this.timeTable.selectProject(path),
			this.issueTable.selectProject(path),
			this.todoTable.selectProject(path)
		]);
	} catch(error) {
		console.error("Failed to update project view", error);
	}
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

	private async buildDetailsSection(section: HTMLDivElement) {
		const temp = section.createDiv()
		this.detailsSection = new ProjectInfoSingle(
			this.selectedProject,
			temp,
			this.app,
			this.projectManager
		)
		this.addChild(this.detailsSection)
	}
	private async buildTimeSectionContents(section: HTMLDivElement) {
		this.timeTable = new TimeSummarySingle(
			this.selectedProject,
			section,
			this.app,
			this.timeTracker,
			this.projectManager,
			"week",
			0
		)
		this.addChild(this.timeTable)
	}
	private async buildTodoSectionContents(section: HTMLDivElement) {
		this.todoTable = new TodoDashboardView(
			section,
			this.app,
			this.todoManager,
			this.projectManager,

		)
		this.addChild(this.todoTable)
	}

	private async buildIssueSectionContents(section: HTMLDivElement) {
		this.issueTable = new IssueDashboardView(
			section,
			this.app,
			this.issueTracker,
			this.projectManager,

		)
		this.addChild(this.issueTable)
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

