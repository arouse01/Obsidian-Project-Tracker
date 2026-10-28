import {
	Plugin,
	Editor,
	MarkdownView,
	MarkdownFileInfo,
    // TFolder,
    FileSystemAdapter,
    Notice,
    TFile,
    Platform,
    normalizePath
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	IssueTrackerSettings,
	IssueTrackerSettingTab,
} from '@/settings/settings';
import { MyProjectManager } from '@/projects/projectManager';
import { TimeTracker } from '@/time/timeTracker';
import { IssueTracker } from '@/issues/issueTracker'
import { TodoManager } from '@/todos/todoTracker'
import {
    DATA_FILES,
	TIME_DASHBOARD_VIEW_TYPE,
	VIEW_TYPE_TRACKER
} from '@/utils/constants'
import { TimeDashboardView } from '@/time/timeDashboard';
import { TrackerView } from '@/trackerView';
import { NoteManager } from '@/notes/noteManager';
// import path from "node:path";



export default class ProjectTrackerPlugin extends Plugin {
	projectManager!: MyProjectManager;
	settings!: IssueTrackerSettings;
	timeTracker!: TimeTracker;
	issueTracker!: IssueTracker;
	todoManager!: TodoManager;
	noteManager!: NoteManager;
	statusBar!: HTMLElement;
	private timeoutId: number | null = null

	async onload() {

		this.statusBar = this.addStatusBarItem()

		this.projectManager = new MyProjectManager(
			this.app,
			this,
			() => this.settings.peoplePath
		);

		await this.loadSettings();

		this.timeTracker = new TimeTracker(
			this.app,
			this,
			this.projectManager,
			this.settings
		);
		this.register(() => {
			this.timeTracker.stopMonitoring();
		});

		this.issueTracker = new IssueTracker(
			this.app,
			this.settings,
			this.projectManager,
			() => this.saveSettings()
		);

		this.todoManager = new TodoManager(
			this.app,
			this,
			this.projectManager,
			() => this.getDataFilePath("todoList")
		)

		this.noteManager = new NoteManager(
			this.app,
			this.projectManager
		)

		this.registerView(
			VIEW_TYPE_TRACKER,
			leaf => new TrackerView(
				leaf,
				this,
				() => this.settings.devNotePath
			)
		);

		this.registerView(
			TIME_DASHBOARD_VIEW_TYPE,
			leaf => new TimeDashboardView(
				leaf,
				this,
				this.timeTracker,
				this.projectManager
			)
		);

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
				await this.todoManager.startTodoItem()
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

		this.app.workspace.onLayoutReady(() => {
			// we need to wait until the layout is ready, then we can read and update the allocation log
			void this.timeTracker.refreshAllocations()
		})
		
	}

	updateStatusText(message: string, duration: number = 5) {
		if (this.timeoutId !== null) {
			window.clearTimeout(this.timeoutId);
		}
		const durationMax = 10
		const durationMin = 2
		let durationMs = Math.min(
			Math.max(duration, durationMin),
			durationMax
		) * 1000;  // coerce duration to value between durationMin and durationMax
		this.statusBar.setText(message)
		this.timeoutId = window.setTimeout(() => {
			this.statusBar.setText("");
			this.timeoutId = null;
		}, durationMs)
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
		await this.issueTracker.addSelectionToIssue(editor, view)
	}

	async openProjectinTracker(projectPath: string): Promise<void> {
		const { workspace } = this.app;

		let leaf = this.app.workspace.getLeavesOfType(
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
				state: { activeTab: "Projects" }
			});
		}
		const view = leaf.view;
		if (!(view instanceof TrackerView)) {
			return;
		}

		await view.goToProjectView(projectPath)
		await workspace.revealLeaf(leaf);
	}

	async createNewTodo() {
		await this.todoManager.startTodoItem()
	}

	async openInExplorer(targetFile: TFile): Promise<void> {
		if (!Platform.isDesktopApp) return;

		// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment -- Electron is already included
		const { shell } = require('electron')
		const adapter = this.app.vault.adapter;

		if (!(adapter instanceof FileSystemAdapter)) {
			new Notice("Opening a local folder requires the desktop app.");
			return;
		}
		const parentFolder = targetFile.parent!.path
		const fullPath = adapter.getFullPath(parentFolder);
		// const folderPath = path.dirname(fullPath);

		const error = await shell.openPath(fullPath);

		if (error) {
			new Notice(`Could not open folder: ${error}`);
		}
	}

	getDataFilePath(file: keyof typeof DATA_FILES): string {
		const folder = this.settings.pluginDataFolder.trim();

		if (!folder) {
			throw new Error('Plugin data folder not configured')
		}
		return normalizePath(`${folder}/${DATA_FILES[file]}`)
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

