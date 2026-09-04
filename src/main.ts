import {
	Plugin,
	Editor,
	MarkdownView,
	MarkdownFileInfo
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	IssueTrackerSettings,
	IssueTrackerSettingTab,
} from './settings';
import { MyProjectManager } from './projectManager';
import { TimeTracker } from "./timeTracker";
// import { IssueModal } from "./issueModal"
import IssueTracker from "./issueTracker"
import { TodoManager } from "./todoTracker"
import {
	TIME_DASHBOARD_VIEW_TYPE,
	VIEW_TYPE_TRACKER
} from "./constants"
import {
	TimeDashboardView
} from './timeDashboard';
// import {
// 	ProjectDashboardView
// } from './projectDashboard'
// import {
// 	ProjectSingleView
// } from './projectView'
// import {
// 	TodoDashboardView
// } from './todoDashboard'
import { TrackerView } from './trackerView';



export default class ProjectTrackerPlugin extends Plugin {
	projectManager!: MyProjectManager;
	settings!: IssueTrackerSettings;
	timeTracker!: TimeTracker;
	issueTracker!: IssueTracker;
	todoManager!: TodoManager;


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
			this.projectManager,
			() => this.saveSettings()
		);

		this.todoManager = new TodoManager(
			this.app,
			this.projectManager,
			() => this.settings.todoLogPath
		)

		this.registerView(
			VIEW_TYPE_TRACKER,
			leaf => new TrackerView(leaf, this)
		);

		// this.registerView(
		// 	PROJECT_DASHBOARD_VIEW_TYPE,
		// 	leaf => new ProjectDashboardView(
		// 		leaf,
		// 		this.timeTracker,
		// 		this.projectManager,
		// 		this.issueTracker,
		// 		this.todoManager
		// 	)
		// );

		// this.registerView(
		// 	PROJECT_SINGLE_VIEW_TYPE,
		// 	leaf => new ProjectSingleView(
		// 		leaf,
		// 		this.timeTracker,
		// 		this.projectManager,
		// 		this.issueTracker,
		// 		this.todoManager
		// 	)
		// );

		this.registerView(
			TIME_DASHBOARD_VIEW_TYPE,
			leaf => new TimeDashboardView(
				leaf,
				this.timeTracker,
				this.projectManager
			)
		);

		// this.registerView(
		// 	TODO_DASHBOARD_VIEW_TYPE,
		// 	leaf => new TodoDashboardView(
		// 		leaf,
		// 		this.todoManager,
		// 		this.projectManager
		// 	)
		// );

		this.addCommand({
			id: "open-tracker-dashboard",
			name: "Open project management dashboard",
			editorCallback: async () => {
				await this.activateTrackerDashboard();
			}
		});

		this.addCommand({
			id: "open-project-dashboard",
			name: "Open project dashboard",
			editorCallback: async () => {
				await this.activateProjectDashboard();
			}
		});

		this.addCommand({
			id: "open-time-dashboard",
			name: "Open time dashboard",
			editorCallback: async () => {
				await this.activateTimeDashboard();
			}
		});

		this.addCommand({
			id: "open-todo-dashboard",
			name: "Open todo dashboard",
			editorCallback: async () => {
				await this.activateTodoDashboard();
			}
		});

		this.addCommand({
			id: "add-todo",
			name: "Add new todo",
			editorCallback: async () => {
				await this.todoManager.startBlankTodoItem()
			}
		});

		this.addCommand({
			id: "create-issue-from-selection",
			name: "Create issue from selection",
			editorCallback: async (editor, view) => {
				await this.issueTracker.createIssueFromSelection(editor, view);
			}
		});

		this.addCommand({
			id: "add-to-issue",
			name: "Add to issue",
			editorCallback: async (editor, view) => {
				await this.addToIssue(editor, view);
			}
		});

		this.addCommand({
			id: "create-todo-from-selection",
			name: "Create todo from selection",
			editorCallback: async (editor, view) => {
				await this.todoManager.createTodoFromSelection(editor, view);
			}
		});

		this.addRibbonIcon(
			'folder-open-dot',
			'Open project dashboard',
			async (_evt: MouseEvent) => {
				// Called when the user clicks the icon.
				await this.activateProjectDashboard();
			});

		this.addRibbonIcon(
			'clock',
			'Open time dashboard',
			async (_evt: MouseEvent) => {
				// Called when the user clicks the icon.
				await this.activateTimeDashboard();
			});

		//this.addRibbonIcon(
		//	'list-todo',
		//	'Open todo dashboard',
		//	async (_evt: MouseEvent) => {
		//		await this.activateTodoDashboard();
		//	});

		/*
				// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
				const statusBarItemEl = this.addStatusBarItem();
				statusBarItemEl.setText('Status bar text');
		*/
		

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				// const selectedText = editor.getSelection();
				// const startLine = editor.getCursor("from").line;
				// let selected: string[];
				// if (selectedText.length == 0) {
				// 	selected = editor.getLine(startLine).split(/\r?\n/)
				// } else {
				// 	selected = editor.getSelection().split(/\r?\n/);
				// }

				menu.addItem(item => {
					item
						.setTitle("Create issue from selection")
						.setIcon("file-plus")
						.onClick(async () => {
							await this.issueTracker.createIssueFromSelection(editor, view)
						})
					});

				menu.addItem(item => {
					item
						.setTitle("Add to issue")
						.setIcon("message-circle-plus")
						.onClick(async () => {
							await this.addToIssue(editor, view);
						});
				});

				menu.addItem(item => {
					item
						.setTitle("Create todo from selection")
						.setIcon("file-plus")
						.onClick(async () => {
							await this.todoManager.createTodoFromSelection(editor, view)
						});
				});

			})
		);

		this.addSettingTab(new IssueTrackerSettingTab(this.app, this));
	}

	async activateTrackerDashboard(): Promise<void> {

		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(
			VIEW_TYPE_TRACKER
		)[0];

		if (!leaf) {
			leaf = workspace.getLeaf("tab");

			if (!leaf) {
				return;
			}

			await leaf.setViewState({
				type: VIEW_TYPE_TRACKER,
				active: true
			});
		}

		await workspace.revealLeaf(leaf);
	}

	async activateProjectDashboard(): Promise<void> {

		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(
			VIEW_TYPE_TRACKER
		)[0];

		if (!leaf) {
			leaf = workspace.getLeaf("tab");

			if (!leaf) {
				return;
			}

			await leaf.setViewState({
				type: VIEW_TYPE_TRACKER,
				active: true,
				state: { activeTab: "Projects"}
			});
		}

		await workspace.revealLeaf(leaf);
	}

	async activateTimeDashboard(): Promise<void> {

		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(
			TIME_DASHBOARD_VIEW_TYPE
		)[0];

		if (!leaf) {
			leaf = workspace.getRightLeaf(false)!;

			if (!leaf) {
				return;
			}

			await leaf.setViewState({
				type: TIME_DASHBOARD_VIEW_TYPE,
				active: true
			});
		}

		await workspace.revealLeaf(leaf);
	}

	async activateTodoDashboard(): Promise<void> {

		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(
			VIEW_TYPE_TRACKER
		)[0];

		if (!leaf) {
			leaf = workspace.getLeaf("tab");

			if (!leaf) {
				return;
			}

			await leaf.setViewState({
				type: VIEW_TYPE_TRACKER,
				active: true,
				state: { activeTab: "Todos" }
			});
		}

		await workspace.revealLeaf(leaf);
	}

	async addToIssue(editor: Editor, view: MarkdownView | MarkdownFileInfo): Promise<void> {
		/*
							Append to issue steps
								Select which issue (from open issues)	
								Go to end of "Activity" section 
								Add new subsection with meeting backlink
								Add selected text
							*/
	}

	async createNewTodo() {
		await this.todoManager.startBlankTodoItem()
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

