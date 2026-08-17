import { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	IssueTrackerSettings,
	IssueTrackerSettingTab,
} from './settings';
import { MyProjectManager } from './projectManager';
import { TimeTracker } from "./timeTracker";
import { IssueModal } from "./issueModal"
import IssueTracker from "./issueTracker"
import { TodoManager } from "./todoTracker"
import { TodoModal } from "./todoModal"
import {
	IssueContext,
	IssueModalOptions,
	PRIORITIES,
	TodoContext
} from "./types";
import {
	normalizeWikiLink
} from './utils';
import {
	TimeDashboardView
} from './timeDashboard';
import {
	ProjectDashboardView
} from './projectDashboard'
import {
	TodoDashboardView
} from './todoDashboard'



export default class ProjectTrackerPlugin extends Plugin {
	projectManager!: MyProjectManager;
	settings!: IssueTrackerSettings;
	timeTracker!: TimeTracker;
	issueTracker!: IssueTracker;
	todoManager!: TodoManager

	async onload() {

		this.projectManager = new MyProjectManager(this.app);

		await this.loadSettings();

		this.timeTracker = new TimeTracker(
			this.app,
			this.projectManager,
			() => this.settings.timeLogPath
		);

		this.issueTracker = new IssueTracker(
			this.app,
			this.settings,
			() => this.saveSettings()
		);

		this.todoManager = new TodoManager(
			this.app,
			this.projectManager,
			() => this.settings.todoLogPath
		)
		this.registerView(
			"project-dashboard",
			leaf => new ProjectDashboardView(
				leaf,
				this.timeTracker,
				this.projectManager,
				this.issueTracker
			)
		);

		this.registerView(
			"time-dashboard",
			leaf => new TimeDashboardView(
				leaf,
				this.timeTracker,
				this.projectManager
			)
		);

		this.registerView(
			"todo-dashboard",
			leaf => new TodoDashboardView(
				leaf,
				this.todoManager,
				this.projectManager
			)
		);

		this.addRibbonIcon(
			'folder-open-dot',
			'Open project dashboard',
			async (_evt: MouseEvent) => {
				// Called when the user clicks the icon.
				await this.activateProjectDashboard();
			});

		// Add the time tracking dashboard to the right 
		this.addRibbonIcon(
			'clock',
			'Open time dashboard',
			async (_evt: MouseEvent) => {
				// Called when the user clicks the icon.
				await this.activateTimeDashboard();
			});

		this.addRibbonIcon(
			'list-todo',
			'Open todo dashboard',
			async (_evt: MouseEvent) => {
				await this.activateTodoDashboard();
			});

		/*
				// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
				const statusBarItemEl = this.addStatusBarItem();
				statusBarItemEl.setText('Status bar text');
		*/


		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				const selectedText = editor.getSelection();
				const startLine = editor.getCursor("from").line;
				let selected: string[];
				if (selectedText.length == 0) {
					selected = editor.getLine(startLine).split(/\r?\n/)
				} else {
					selected = editor.getSelection().split(/\r?\n/);
				}


				// if (editor.getSelection().length > 0) {
					menu.addItem(item => {
						item
							.setTitle("Create issue from selection")
							.setIcon("file-plus")
							.onClick(async () => {
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
										await this.issueTracker.createIssue(request);
									}

								}
								new IssueModal(
									this.app,
									options
								).open();

								

							});
					});

					menu.addItem(item => {
						item
							.setTitle("Add to issue")
							.setIcon("message-circle-plus")
							.onClick(async () => {
								/*
								Append to issue steps
									Select which issue (from open issues)	
									Go to end of "Activity" section 
									Add new subsection with meeting backlink
									Add selected text
								*/
							});
					});

					menu.addItem(item => {
						item
							.setTitle("Create todo selection")
							.setIcon("file-plus")
							.onClick(async () => {

								const tempTitle = selected[0] ?? ""
									.replace(/^[-*]\s*/, "")
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

								const context: TodoContext = {
									tempTitle: tempTitle,
									sourceFile: sourceFile,
									line: startLine,
									projectPaths: projectPaths,
									projectNames: projectNames,
									editor: editor

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


								new TodoModal(this.app, {
									context: context,
									projects: sortedProjects,
									priorities: PRIORITIES,
									onSubmit: async (request) => {
										await this.todoManager.addNewTodoItem(request);
									}
								}).open();




							});
					});
				// }
			})
		);

		this.addSettingTab(new IssueTrackerSettingTab(this.app, this));
	}


	async activateProjectDashboard(): Promise<void> {

		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(
			"project-dashboard"
		)[0];

		if (!leaf) {
			leaf = workspace.getLeaf("tab");

			if (!leaf) {
				return;
			}

			await leaf.setViewState({
				type: "project-dashboard",
				active: true
			});
		}

		await workspace.revealLeaf(leaf);
	}

	async activateTimeDashboard(): Promise<void> {

		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(
			"time-dashboard"
		)[0];

		if (!leaf) {
			leaf = workspace.getRightLeaf(false)!;

			if (!leaf) {
				return;
			}

			await leaf.setViewState({
				type: "time-dashboard",
				active: true
			});
		}

		await workspace.revealLeaf(leaf);
	}

	async activateTodoDashboard(): Promise<void> {

		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(
			"todo-dashboard"
		)[0];

		if (!leaf) {
			leaf = workspace.getLeaf("tab");

			if (!leaf) {
				return;
			}

			await leaf.setViewState({
				type: "todo-dashboard",
				active: true
			});
		}

		await workspace.revealLeaf(leaf);
	}

	/*
		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'create-issue-from-text',
			name: 'Create Issue',
			callback: () => {
				new SampleModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (
				editor: Editor,
				_ctx: MarkdownView | MarkdownFileInfo,
			) => {
				editor.replaceSelection('Sample editor command');
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			},
		});
		*/
/*
		
*/


		/*// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000),
		);*/


	onunload() {}

	async loadSettings() {
		const data = await this.loadData() as Partial<IssueTrackerSettings>;
		this.settings = {
			...DEFAULT_SETTINGS,
			...data
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

