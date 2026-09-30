import {
	App,
	MetadataCache,
	TFile
} from 'obsidian';
import {
	formatDate,
	normalizeWikiLink,
	getFrontmatterString,
	getFrontmatterStringArray
} from './utils';
import {
	ProjectInfo,
	NoteType,
	NoteItem,
} from "./types";
import {
	ProjectModal
} from "./projectModal"
import { MyProjectManager } from './projectManager'


export class NoteManager {
	constructor(
		private app: App,
		private projectManager: MyProjectManager,
		// private getPeoplePath: () => string
	) {
		this.app = app
	}

	private getNotes(type?: NoteType): NoteItem[] {
		const files = this.app.vault.getMarkdownFiles();
		const noteFiles = files.filter(file =>
			!file.path.startsWith("Projects/")  // Get all md files in the Projects folder
		);
		const noteItems = noteFiles.map(file => {
			const noteTypeRaw = getFrontmatterString(this.app.metadataCache, file, "type")
			let noteType: NoteType;
			if (noteTypeRaw === "") {
				noteType = "other"
			} else {
				noteType = noteTypeRaw as NoteType
			}

			const tags = getFrontmatterStringArray(this.app.metadataCache, file, "tags")
			const people = getFrontmatterStringArray(this.app.metadataCache, file, "people")

			// const projectLink = normalizeWikiLink(getFrontmatterString(this.app.metadataCache, file, "project"))
			const project = this.projectManager.getFileProject(file)

			const dateRaw = getFrontmatterString(this.app.metadataCache, file, "date")
			const date = new Date(dateRaw)

			const dateModified = new Date(file.stat.mtime)

			return {
				file: file,
				title: file.basename,
				project: project,
				type: noteType,
				dateModified: dateModified,
				date: date,
				tags: tags,
				people: people
			};

		})
			.sort((a, b) =>
				a.title.localeCompare(b.title)
		);

		if (type) {
			return noteItems.filter(note =>
				note.type === type
			)
		} else {
			return noteItems
		}


	}

	async getProjectNotes(type: NoteType, project: ProjectInfo): Promise<NoteItem[]> {
		const notes = this.getNotes(type);
		const projectNotes = notes.filter(note =>
			note.project?.file.path === project.file.path
		);
		return projectNotes

	}


	async getAllNotes(type: NoteType): Promise<NoteItem[]> {
		return this.getNotes(type);

	}

	
	/*
	getClientList(): string[] {
		// Get all clients listed across all projects
		const files = this.app.vault.getMarkdownFiles();
		const clients = files
			.filter(file => file.path.startsWith("Projects/"))  // Get all md files in the Projects folder
			.map(file => getFrontmatterString(this.app.metadataCache, file, "Primary"))
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
			.flatMap(file => getFrontmatterStringArray(this.app.metadataCache, file, "Collaborators"))
			.filter(collaborator => collaborator.length > 0)
			.map(collaborator => normalizeWikiLink(collaborator));


		return [...new Set(collaborators)].sort((a, b) =>
			a.localeCompare(b)
		);

	}
*/
	async addProjectMeetingNote(
		project: ProjectInfo
	): Promise<void> {
		let newFile: TFile;

		const currDate = formatDate();
		const projectName = project.name;
		const meetingTitle = `${currDate} ${projectName} Meeting`

		const filename = `${meetingTitle}`
		const path = `Meeting Notes/${filename}.md`
		const creationTS = formatDate(undefined, "datetime_long");
		const content =
			`---
project: "[[${projectName}]]"
topic: 
date: "${creationTS}"
people:
- 
tags:
- meeting
---
# ${filename}

`;

		newFile = await this.app.vault.create(path, content);

		await this.app.workspace.getLeaf(false).openFile(newFile);

	}
	
	async createNoteFile(
		project?: ProjectInfo
	): Promise<void> {
	
		let newFile: TFile;

		const projectPath = project?.file.path;
		const filename = project ? `${project.name}` : "untitled"
		const path = `Notes/${filename}.md`;
		const content =
			`---
project: "[[${projectPath}]]"
tags:
  - 
---

`;

		newFile = await this.app.vault.create(path, content);

		await this.app.workspace.getLeaf(false).openFile(newFile);


	}


	// private formatCollaborators(collaborators: string[]): string {
	// 	if (collaborators.length === 0) {
	// 		return "Collaborators:\n  -"
	// 	}
	// 	const peoplePath = this.getPeoplePath();
	// 	const lines = collaborators.map(collab => {
	// 		const file = this.app.vault
	// 			.getMarkdownFiles()
	// 			.find(file =>
	// 				file.parent?.path === `${peoplePath}` &&
	// 				file.basename === collab
	// 			)
	// 		const value = file
	// 			? `[[${file.path}|${collab}]]`
	// 			: collab

	// 		return `  - "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
	// 	});

	// 	return `Collaborators:\n${lines.join("\n")}`;
		
	// }


	
	
}

