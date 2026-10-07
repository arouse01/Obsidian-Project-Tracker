import {
	App,
	Component,
	// Menu,
	// ButtonComponent,
	// TFile,
	// setIcon
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	// PeriodicTimeSummary,
	// ProjectInfo,
	// TimeSession,
	// TimeSummary
	ProjectOption
} from "./types";
import {
	// formatMinutesToDuration,
	// formatDate,
	// getFrontmatterString,
	// getFrontmatterStringArray
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
} from './timeSummarySingle'
import {
	ProjectInfoSingle
} from './projectInfoDashboard';
import {
	NoteDashboard
} from './noteDashboard';
import {
	NoteManager
} from './noteManager';


export class ProjectSingleView extends Component {
	private refreshInterval: number | null = null;

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

	private indicatorSection!: HTMLDivElement;

	constructor(
		private container: HTMLElement,
		private app: App,
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager,
		private issueTracker: IssueTracker,
		private todoManager: TodoManager,
		private noteManager: NoteManager,
		private project?: string | undefined
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
		this.projectSelect = projectSection.createEl("select");
		this.projectSelect.addClass("dropdown-new")
		this.projectSelect.addClass("center-align")
		this.projectSelect.addClass("project-selector")
		for (const project of this.getProjectOptions()) {
			this.projectSelect.createEl("option", {
				value: project.path,
				text: project.name
			})
		}
		this.registerDomEvent(this.projectSelect, "change", async () => {
			const path = this.projectSelect.value;
			this.selectedProject = path;
			await this.handleProjectChange(path)


		});
		// this.indicatorSection = projectSection.createDiv({cls: "right-align"})
		
		
		const detailsSection = dashboardContainer.createDiv({ cls: "single-project-section" });
		detailsSection.createDiv({ text: "Project details", cls: "section-header" })
		this.detailsEl = detailsSection.createDiv()
		

		dashboardContainer.createEl("hr")

		// build the time tracker section
		const timeSection = dashboardContainer.createDiv({ cls: "single-project-section" });
		timeSection.createDiv({ text: "Hours worked", cls: "section-header" })
		this.timeEl = timeSection.createDiv()
		// this.timeTable = new TimeSummarySingle(this.selectedProject, timeSection, this.app, this.timeTracker, this.projectManager, "week", 0)

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
		this.otherNoteEl = noteSection.createDiv()

		
	}

	async changeSelectedProject(path: string): Promise<void> {
		this.projectSelect.value = path
		await this.handleProjectChange(path)
	}

	private async handleProjectChange(path: string): Promise <void> {
		this.selectedProject = path;
		if (this.detailsSection === undefined) {
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
				this.app,
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

