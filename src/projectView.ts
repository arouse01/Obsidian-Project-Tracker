import {
	App,
	Component,
	Menu,
	ButtonComponent,
	TFile,
	setIcon
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	PeriodicTimeSummary,
	ProjectInfo,
	TimeSession,
	TimeSummary
} from "./types";
import {
	formatMinutesToDuration,
	formatDate,
	normalizeWikiLink
} from './utils';
import { TimeTracker } from './timeTracker';
import { TimeModal } from './timeModal';
import IssueTracker from './issueTracker';
import { TodoManager } from './todoTracker';
import {
	SummaryPeriod,
	getSummaryPeriod,
	SummaryGroup,
	sortItems,
	GroupDefs,
	ColSort,
	TableColumn,
	SummaryColumn,
	updateSortButtons,
	getGroupOptions
} from './tableFunctions';


export class ProjectSingleView extends Component {
	constructor(
		private container: HTMLElement,
		private app: App,
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager,
		private issueTracker: IssueTracker,
		private todoManager: TodoManager
	) {
		super();
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

	async onOpen(): Promise<void> {
		this.registerEvent(
			this.timeTracker.on("time-tracker-updated", () => {
				// void this.updateProjectTableRows()
			})
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

