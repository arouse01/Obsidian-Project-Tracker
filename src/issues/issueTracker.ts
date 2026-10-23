import {
	App,
	Editor,
	Events,
	TFile,
	MarkdownView,
	MarkdownFileInfo,
    Notice
} from 'obsidian';
import {
	IssueTrackerSettings,
} from '@/settings/settings';
import {
	IssueContext,
	CreateIssueRequest,
	ProjectInfo,
	IssueModalOptions,
	PRIORITIES,
	IssueItem,
	IssueStatusFilter,
    IssueSelectModalOptions
} from '@/utils/types';
import {
	formatIssueID,
	formatDate,
	normalizeWikiLink,
	getFrontmatterString,
	getFrontmatterStringArray,
    getFrontmatterNumber,
    createFileSafely
} from '@/utils/utils';
import { IssueModal } from '@/issues/issueModal'
import { MyProjectManager } from '@/projects/projectManager'
import { IssueSelectModal } from './issueSelectModal';



export class IssueTracker extends Events {
	constructor(
		private app: App,
		private settings: IssueTrackerSettings,
		private projectManager: MyProjectManager,
		private saveSettings: () => Promise<void>
	) {
		super()
	}

	async onload() {

		

		
	}

	
	getAllIssues(): IssueItem[] {

		const files = this.app.vault.getMarkdownFiles();
		const issueFiles = files.filter(file =>
			file.path.startsWith("Issues/")  // Get all md files in the Projects folder
		);
		return issueFiles.map(file => {
			/*
			projectPath: string;
			priority: number;
			title: string;
			sourceFile: TFile | null;
			id: number;
			file: TFile;
			*/
			return {
				file: file,
				title: file.basename,
				status: getFrontmatterString(this.app.metadataCache, file, "Issue Status"),
				client: getFrontmatterString(this.app.metadataCache, file, "Primary"),
				priority: getFrontmatterNumber(this.app.metadataCache, file, "Priority"),
				projectPath: this.app.metadataCache.getFirstLinkpathDest(
					normalizeWikiLink(getFrontmatterString(this.app.metadataCache, file, "Project")),
					file.path
				)!.path,
				sourceFile: this.app.metadataCache.getFirstLinkpathDest(
					normalizeWikiLink(getFrontmatterString(this.app.metadataCache, file, "Origin")),
					file.path
				),
				id: +getFrontmatterString(this.app.metadataCache, file, "ID"),
				startDate: getFrontmatterString(this.app.metadataCache, file, "Creation Date")
				/*
					getFrontmatterString(this.app.metadataCache, file, "Project")
					.map(link => normalizeWikiLink(link))
					.map(link =>
						this.app.metadataCache.getFirstLinkpathDest(
							link,
							file.path
						)?.path
					)
					.filter((path): path is string => path !== undefined);
					*/
			};

		})
			.sort((a, b) =>
				a.title.localeCompare(b.title)
			);

	}

	filterIssues(issues: IssueItem[], status: IssueStatusFilter): IssueItem[] {
		return issues.filter(issue =>
			issue.status === status
		);
	}

	async getIssues(status: IssueStatusFilter = "Open", project: string | null = null): Promise<IssueItem[]> {
		const issues = this.getAllIssues();
		let fetchedIssues: IssueItem[]
		if (status !== "All") {
			fetchedIssues = this.filterIssues(issues, status)
		} else {
			fetchedIssues = issues;
		}
		let filteredIssues: IssueItem[]
		if (project) {
			filteredIssues = fetchedIssues.filter((path): path is IssueItem => path.projectPath === project);
		} else {
			filteredIssues = fetchedIssues
		}
		return filteredIssues;
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
				getFrontmatterStringArray(this.app.metadataCache, sourceFile, "project");
			// console.log('projects: ', projectNames);
			const projectPaths =
				getFrontmatterStringArray(this.app.metadataCache, sourceFile, "project")
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

	async createNewIssue(
		project: ProjectInfo | undefined
	): Promise<void> {
		const tempTitle = "";
		const lines = -1;
		const sourceFile = project?.file ?? null;

		// get the project of the current document and its actual file location, if any
		let projectNames: string[] | null = null
		let projectPaths: string[] | null = null
		if (project) {
			projectNames = [project.name];
			projectPaths = [project.file.path];
		} 

		const context: IssueContext = {
			tempTitle: tempTitle,
			selectedText: "",
			sourceFile: sourceFile,
			line: lines,
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

	private async createIssueNote(
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
		const sourceFile = request.issue.sourceFile
			? `"[[${request.issue.sourceFile.path}|${request.issue.sourceFile.basename}]]"`
			: ""
		const content =
			`---
id: ${issueID}
project: "[[${request.issue.project.name}]]"
priority: ${request.issue.priority}
issue status: Open
origin: ${sourceFile}
creation date: "${creationTS}"
type: issue
tags:
  - 
---
# ${filename}

## Description

${request.issue.description}

## Activity

## Notes

## Resolution Notes

`;

		newFile = await createFileSafely( this.app.vault, path, content);

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

	async selectIssue() {

	}

	async addSelectionToIssue(
		editor: Editor,
		view: MarkdownView | MarkdownFileInfo
	) {
		/*
			Append to issue steps
				- Select which issue (from open issues)	
				- Go to end of "Activity" section 
				- Add new subsection with meeting backlink
				- Add selected text
		*/
		const selectedText = editor.getSelection();
		const startLine = editor.getCursor("from").line;
		let selected: string[];
		if (selectedText.length == 0) {
			selected = editor.getLine(startLine).split(/\r?\n/)
		} else {
			selected = editor.getSelection().split(/\r?\n/);
		}
		const sourceFile = view.file!;
		

		const sourceFileName = sourceFile.basename
		const lines = selected
			.join("\n")
			.trim();
		const currDate = formatDate(undefined, "datetime_short");
		const textToAdd = `### ${currDate}\n#### Added from [[${sourceFileName}]]\n` + lines

		// console.log('projects: ', projectNames);
		const projectPaths =
			getFrontmatterStringArray(this.app.metadataCache, sourceFile, "project")
				.map(link => normalizeWikiLink(link))
				.map(link =>
					this.app.metadataCache.getFirstLinkpathDest(
						link,
						sourceFile.path
					)?.path
				)
				.filter((path): path is string => path !== undefined);

		let issueList: IssueItem[] = []
		for (const projectPath of projectPaths) {
			const projectIssues = await this.getIssues("Open", projectPath);
			issueList.push(...projectIssues) 
		}

		const options: IssueSelectModalOptions = {
			issueList: issueList,
			onSubmit: async (request) => {
				await this._appendToIssue(request, textToAdd);
				// await this.app.workspace.getLeaf(false).openFile(newFile);
			}

		}
		

		new IssueSelectModal(
			this.app,
			options
		).open();

	}

	private async _appendToIssue(issuePath: string, textToAdd: string, section: string = "Activity", ) {
		const files = this.app.vault.getMarkdownFiles();
		const issueFile = files.find(item => item.path === issuePath)

		if (!issueFile) {
			new Notice(`Issue file ${issuePath} not found`)
			return;
		} else {
			const content = await this.app.vault.read(issueFile);
			const cache = this.app.metadataCache.getFileCache(issueFile)

			if (!cache) {
				new Notice(`Issue file ${issuePath} couldn't be read`)
				return;
			}

			const eol = content.includes('\r\n') ? '\r\n' : '\n'

			const headings = cache.headings;
			if (!headings) {
				new Notice(`Issue file ${issuePath} section headers couldn't be read`)
				return;
			}

			

			const targetIndex = headings.findIndex(h => h.heading.toLowerCase() === section.toLowerCase())

			if (targetIndex === -1) {
				new Notice(`Header "${section}" not found, added to end of file`)
				textToAdd = `${eol}##${section}${eol}${textToAdd}`
			}

			const currHeader = headings[targetIndex]!;
			// insert location depends on whether there's another header at same level or higher - otherwise just append to end of file

			let nextHeader = headings.slice(targetIndex + 1).find(h => h.level <= currHeader.level);

			const insertPosition = nextHeader ? nextHeader.position.start.offset : content.length;

			const before = content.substring(0, insertPosition)
			const after = content.substring(insertPosition)

			// enforce correct EOL in added text
			const normalizedTextToAdd = textToAdd.replace(/\r?\n/g, eol)

			const beforeNewline = !before.endsWith('\n') ? eol : ''
			const afterNewline = !after.startsWith('\r') && !after.startsWith('\n') && after.length > 0 ? eol : ''

			const resultingContent = before + beforeNewline + normalizedTextToAdd + afterNewline + after
			await this.app.vault.modify(issueFile, resultingContent);





				
					}
			
			
		}

			
	}


