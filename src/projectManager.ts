import {
	App,
	TFile
} from 'obsidian';
import {
	formatDate,
	normalizeWikiLink
} from './utils';
import {
	ProjectInfo,
	CreateProjectRequest,
	ProjectContext,
	ProjectModalOptions
} from "./types";
import {
	ProjectModal
} from "./projectModal"


export class MyProjectManager {
	constructor(
		private app: App,
		private getPeoplePath: () => string
	) {
		this.app = app
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

	goToProjectView(path: string) {

	}

	getClientList(): string[] {
		// Get all clients listed across all projects
		const files = this.app.vault.getMarkdownFiles();
		const clients = files
			.filter(file => file.path.startsWith("Projects/"))  // Get all md files in the Projects folder
			.map(file => this.getFrontmatterString(file, "Primary"))
			.filter(client => client.length > 0)
			.map(client => normalizeWikiLink(client))

		return [...new Set(clients)].sort((a, b) =>
				a.localeCompare(b)
			);

	}

	getCollaboratorList(): string[] {
		// Get all collaborators listed across projects
		const files = this.app.vault.getMarkdownFiles();
		const collaborators = files
			.filter(file => file.path.startsWith("Projects/"))  // Get all md files in the Projects folder
			.flatMap(file => this.getFrontmatterStringArray(file, "Collaborators"))
			.filter(collaborator => collaborator.length > 0)
			.map(collaborator => normalizeWikiLink(collaborator));


		return [...new Set(collaborators)].sort((a, b) =>
			a.localeCompare(b)
		);

	}

	async addNewProject(): Promise<void> {
		// get the clients and collaborators, if any (which, come on, there should be unless this whole thing is being used for the first time)
		const clientList = this.getClientList();
		const collabList = this.getCollaboratorList();

		const context: ProjectContext = {
			clients: clientList,
			collaborators: collabList
		}

		const options: ProjectModalOptions = {
			context: context,
			onSubmit: async (request) => {
				const newFile = await this.createProjectFile(request);
				await this.app.workspace.getLeaf(false).openFile(newFile);
			}
		}

		new ProjectModal(
			this.app,
			options
		).open();
	}

	async createProjectFile(
		project: CreateProjectRequest
	): Promise<TFile> {
	
		let newFile: TFile;

		const projectID = crypto.randomUUID();
		const filename = `${project.name}`
		const path = `Projects/${filename}.md`;
		const collaborators = this.formatCollaborators(project.collaborators);
		const creationTS = formatDate(undefined, "datetime_long");
		const clientText = this.formatClient(project.client)
		const content =
			`---
Project Status: Active
${clientText}
${collaborators}
projectID: ${projectID}
Creation Date: "${creationTS}"
tags:
- project
---


## Notes


`;

		newFile = await this.app.vault.create(path, content);

		return newFile;

	}

	private formatClient(client: string | null): string {
		if (!client) {
			return "Primary: "
		}
		const peoplePath = this.getPeoplePath();
		
		const file = this.app.vault
			.getMarkdownFiles()
			.find(file =>
				file.parent?.path === `${peoplePath}` &&
				file.basename === client
			)
		const value = file
			? `[[${file.path}|${client}]]`
			: client

		const clientPath = `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;


		return `Primary: ${clientPath}`;

	}

	private formatCollaborators(collaborators: string[]): string {
		if (collaborators.length === 0) {
			return "Collaborators:\n  -"
		}
		const peoplePath = this.getPeoplePath();
		const lines = collaborators.map(collab => {
			const file = this.app.vault
				.getMarkdownFiles()
				.find(file =>
					file.parent?.path === `${peoplePath}` &&
					file.basename === collab
				)
			const value = file
				? `[[${file.path}|${collab}]]`
				: collab

			return `  - "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
		});

		return `Collaborators:\n${lines.join("\n")}`;
		
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

