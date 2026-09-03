import {
	App,
	Editor,
	TFile,
	MarkdownView,
	MarkdownFileInfo
} from 'obsidian';
import {
	IssueTrackerSettings,
} from './settings';
import {
	IssueContext,
	CreateIssueRequest,
	ProjectInfo,
	IssueModalOptions
} from "./types";
import {
	PRIORITIES
} from "./constants";
import {
	formatIssueID,
	formatDate,
	normalizeWikiLink
} from './utils';
import { IssueModal } from './issueModal'
import { MyProjectManager } from './projectManager'



export default class IssueTracker {
	constructor(
		private app: App,
		private settings: IssueTrackerSettings,
		private projectManager: MyProjectManager,
		private saveSettings: () => Promise<void>
	) { }

	async onload() {

		

		
	}

	private sanitizeFilename(name: string): string {
		// remove any disallowed characters from intended filename
		return name.replace(/[\\/:*?"<>|]/g, "-");
	}

	async createIssueFromSelection(editor: Editor, view: MarkdownView | MarkdownFileInfo): Promise<void> {
		{
			/*
			Create issue steps
				Prompt for issue title, project selection (Default to current note project)
				Get current note link
				Create new note in Issues folder
					Get next issue ID
				Assign Issue template
				Assign properties
					ID, Project, Origin
				Rename issue note
				Back in note, insert/replace link to issue note
			*/
			// const cursor = editor.getCursor();
			const selectedText = editor.getSelection();
			const startLine = editor.getCursor("from").line;
			let selected: string[];
			if (selectedText.length == 0) {
				selected = editor.getLine(startLine).split(/\r?\n/)
			} else {
				selected = editor.getSelection().split(/\r?\n/);
			}

			const tempTitle = selected[0] ?? ""
				.replace(/^[-*]\s*/, "")
				.trim();
			const lines = selected
				.slice(1)
				.join("\n")
				.trim();
			const sourceFile = view.file!;

			// get the project of the current document and its actual file location, if any
			const projectNames =
				this.projectManager.getFrontmatterStringArray(sourceFile, "project");
			// console.log('projects: ', projectNames);
			const projectPaths =
				this.projectManager.getFrontmatterStringArray(sourceFile, "project")
					.map(link => normalizeWikiLink(link))
					.map(link =>
						this.app.metadataCache.getFirstLinkpathDest(
							link,
							sourceFile.path
						)?.path
					)
					.filter((path): path is string => path !== undefined);

			const context: IssueContext = {
				tempTitle: tempTitle,
				selectedText: lines,
				sourceFile: sourceFile,
				line: editor.getCursor("from").line,
				projectPaths: projectPaths,
				projectNames: projectNames,
				editor: editor

			}

			const allProjects = this.projectManager.getActiveProjects();
			const currProjectSet = new Set(projectNames);
			const sortedProjects = [...allProjects].sort((a, b) => {
				const aSource = currProjectSet.has(a.file.path);
				const bSource = currProjectSet.has(b.file.path);
				if (aSource !== bSource) {
					return aSource ? -1 : 1;
				}

				return a.name.localeCompare(b.name);
			})

			const options: IssueModalOptions = {
				context: context,

				projects: sortedProjects,
				priorities: PRIORITIES,
				onSubmit: async (request) => {
					await this.createIssueNote(request);
				}

			}
			new IssueModal(
				this.app,
				options
			).open();



		}
	};

	async createProjectIssue(project: ProjectInfo): Promise<void> {
		const tempTitle = "";
		const lines = "";
		const sourceFile = project.file;

		// get the project of the current document and its actual file location, if any
		const projectNames = [project.name];
		const projectPaths = [project.file.path];

		/*
		let projectPath: string | null = null;

		if (projectName !== "") {

			const file =
				this.app.metadataCache.getFirstLinkpathDest(
					projectName,
					sourceFile.path
				);

			projectPath = file?.path ?? null;
		}
		*/

		const context: IssueContext = {
			tempTitle: tempTitle,
			selectedText: lines,
			sourceFile: sourceFile,
			line: null,
			projectPaths: projectPaths,
			projectNames: projectNames

		}

		// const selectedText = editor.getLine(editor.getCursor().line);
		const allProjects = this.projectManager.getActiveProjects();
		const currProjectSet = new Set(projectNames);
		const sortedProjects = [...allProjects].sort((a, b) => {
			const aSource = currProjectSet.has(a.file.path);
			const bSource = currProjectSet.has(b.file.path);
			if (aSource !== bSource) {
				return aSource ? -1 : 1;
			}

			return a.name.localeCompare(b.name);
		})

		const options: IssueModalOptions = {
			context: context,
			projects: sortedProjects,
			priorities: PRIORITIES,
			onSubmit: async (request) => {
				const newFile = await this.createIssueNote(request);
				await this.app.workspace.getLeaf(false).openFile(newFile);
			}

		}
		new IssueModal(
			this.app,
			options
		).open();
	}

	async createIssueNote(
		request: CreateIssueRequest
	): Promise<TFile> {
		/*
		Input: IssueData
			project: ProjectInfo;
			priority: number;
			title: string;
			description: string;
			sourceFile?: TFile;
		Get next issue ID
		Create new note in Issues folder
		Assign properties
			ID, Project, Origin
		Back in note, insert/replace link to issue note
		
		*/

		let newFile: TFile;

		const issueID = await this.getNextIssueID();
		const filename = `${formatIssueID(issueID)} ${this.sanitizeFilename(request.issue.title)}`
		const path = `Issues/${filename}.md`
		const creationTS = formatDate(undefined, "datetime_long");
		const content =
			`---
ID: ${issueID}
Project: "[[${request.issue.project.name}]]"
Priority: ${request.issue.priority}
Issue Status: Open
Origin: "[[${request.issue.sourceFile.path}|${request.issue.sourceFile.basename}]]"
Creation Date: "${creationTS}"
tags:
- issue
---
# ${filename}

## Description

${request.issue.description}

## Activity

## Notes

## Resolution Notes

`;

		newFile = await this.app.vault.create(path, content);

		if (request.context.editor) {
			await this.addIssueLinkToSource(
				request.context.editor,
				request.context,
				newFile
			);
		}

		return newFile;
		
	}

	async addIssueLinkToSource(
		editor: Editor,
		context: IssueContext,
		issueFile: TFile
	): Promise<void> {
		if (context.line) { 
			const link = ` [[${issueFile.basename}]]`;
			const line = editor.getLine(context.line);
			editor.setLine(
				context.line,
				line + link
			);
		}

	}

	onunload() {}

	private async getNextIssueID(): Promise<number> {
		const id = this.settings.nextIssueID;
		this.settings.nextIssueID++;
		await this.saveSettings();
		return id;
	}

	
}

