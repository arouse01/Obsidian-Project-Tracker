import {
	App,
	Editor,
	TFile
} from 'obsidian';
import {
	IssueTrackerSettings,
} from './settings';
import {
	IssueContext,
	CreateIssueRequest
} from "./types";
import {
	formatIssueID,
	formatTimestamp
} from './utils';



export default class IssueTracker {
	constructor(
		private app: App,
		private settings: IssueTrackerSettings,
		private saveSettings: () => Promise<void>
	) { }

	async onload() {

		

		
	}

	private sanitizeFilename(name: string): string {
		// remove any disallowed characters from intended filename
		return name.replace(/[\\/:*?"<>|]/g, "-");
	}

	async createIssue(
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
		const creationTS = formatTimestamp();
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

