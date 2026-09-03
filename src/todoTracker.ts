import {
	App,
	Editor,
	Events,
	TFile,
	MarkdownView,
	MarkdownFileInfo
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	ProjectInfo,
	TodoItem,
	TodoContext,
	CreateTodoRequest
} from "./types";
import {
	PRIORITIES
} from "./constants";
import { TodoModal } from './todoModal'
import {
	formatDate,
	normalizeWikiLink
} from './utils'


export class TodoManager extends Events {

	constructor(
		private app: App,
		private projectManager: MyProjectManager,
		private getTodoLogPath: () => string
	) {
		super();
	}

	private async loadTodos(): Promise<TodoItem[]> {
		const path = this.getTodoLogPath();
		const file = this.app.vault.getAbstractFileByPath(path);

		if (!(file instanceof TFile)) {
			return [];
		}

		const json = await this.app.vault.read(file);

		return JSON.parse(json) as TodoItem[];
	}

	private async saveTodos(
		todos: TodoItem[]
	): Promise<void> {
		const path = this.getTodoLogPath();
		const file = this.app.vault.getAbstractFileByPath(path);
		//console.log(file);
		const todoData = JSON.stringify(todos)

		if (file && (file instanceof TFile)) {
			// timeLog file exists, write to it
			await this.app.vault.modify(file, todoData);
		} else {
			await this.app.vault.create(path, todoData);
		}

		this.trigger("todo-list-updated");  // trigger an update of displays related to time tracking

	}

	private findActiveTodos(
		todos: TodoItem[]
	): TodoItem[] {
		return todos.filter(s => !s.status)  // return any todos with with a status of false, meaning incomplete
	}

	async getActiveTodos(): Promise<TodoItem[]> {

		const todos = await this.loadTodos();
		return this.findActiveTodos(todos)

	}

	async createTodoFromSelection(editor: Editor, view: MarkdownView | MarkdownFileInfo): Promise<void> {
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
				await this.addNewTodoItem(request);
			}
		}).open();




	}



	async startBlankTodoItem(): Promise<void> {
		const tempTitle = "";
		const lines = -1;
		// No selected project
		const projectNames = null;
		const projectPaths = null;

		const context: TodoContext = {
			tempTitle: tempTitle,
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


		new TodoModal(this.app, {
			context: context,
			projects: sortedProjects,
			priorities: PRIORITIES,
			onSubmit: async (request) => {
				await this.addNewTodoItem(request);
			}
		}).open();
	}

	async startProjectTodoItem(
		project: ProjectInfo,
	): Promise<void> {
		const tempTitle = "";
		const lines = -1;
		// const sourceFile = view.file!;
		const projectNames = [project.name];
		const projectPaths = [project.file.path];
		// get the project of the current document and its actual file location, if any


		const context: TodoContext = {
			tempTitle: tempTitle,
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


		new TodoModal(this.app, {
			context: context,
			projects: sortedProjects,
			priorities: PRIORITIES,
			onSubmit: async (request) => {
				await this.addNewTodoItem(request);
			}
		}).open();
	}

	async addNewTodoItem(
		request: CreateTodoRequest
	): Promise<number> {
		/*
		Actually add a new todo item to the todo file
		*/
		let todos = await this.loadTodos();

		const { project, ...todoFields } = request.todoInfo;  // pulls the project item out so it can be processed separately and then not included in TodoItem
		const newID = this.getNextTodoID(todos)
		const newTodo: TodoItem = {
			...todoFields,
			id: newID,
			status: false,
			dateAdded: formatDate(),
			projectPath: project?.file.path
		}

		todos.push(newTodo);

		await this.saveTodos(todos);

		if (request.context.editor) {
			await this.addTodoLinkToSource(
				request.context.editor,
				request.context,
				newID
			);
		}

		return newID;


	}

	async completeTodoItem(
		id: number
	): Promise<void> {
		/*
		- For the todo that matches the id, change todo.status to "completed"
		*/

		const todos = await this.loadTodos();
		const todo = todos.find(todo => todo.id === id);

		if (!todo) {
			throw new Error(`Todo item ${id} not found`);
		}

		todo.status = true;
		todo.completedTS = new Date().toISOString();

		await this.saveTodos(todos);

		await this.markTodoCompleteEverywhere(id);
		

	}

	async getTodoItem(
		id: number
	): Promise<TodoItem | undefined> {
		const todos = await this.loadTodos();
		const todo = todos.find(todo => todo.id === id);
		return todo;
	}

	async deleteTodoItem(
		id: number
	) {
		const todos = await this.loadTodos();
		const updatedTodos = todos.filter(todo => todo.id !== id);
		await this.saveTodos(updatedTodos)
	}

	async filterTodoToProject() {

	}

	async addTodoLinkToSource(
		editor: Editor,
		context: TodoContext,
		id: number) {
		if (context.line) {
			const link = ` <!-- todo:${id} -->`;
			let line = editor.getLine(context.line);
			const hasTaskCheckbox = /^\s*[-*+]\s+\[[ xX]\]\s/.test(line);

			const match = /^(\s*)(.*)$/.exec(line);  // for preserving white space before the text

			if (!hasTaskCheckbox) {
				if (match) {
					// if there is indentation, account for it
					const indent = match[1];
					const content = match[2];

					line = `${indent}- [ ] ${content}`;
				} else {
					line = `- [ ] ${line}`
				}
			}
			if (match && !hasTaskCheckbox) {
				const indent = match[1];
				const content = match[2];

				line = `${indent}- [ ] ${content}`;
			}

			editor.setLine(
				context.line,
				line + link
			);
		}
	}

	private getNextTodoID(todos: TodoItem[]): number {
		if (todos.length === 0) {
			return 1;
		}

		return Math.max(...todos.map(todo => todo.id)) + 1;
	}

	async markTodoCompleteEverywhere(todoId: number): Promise<void> {
		// go through all markdown files and look for this todo marker, and indicate it's been completed
		const reference = `<!-- todo:${todoId} -->`;

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const content = await this.app.vault.read(file);

			if (!content.includes(reference)) {
				continue;
			}

			const lines = content.split("\n");
			if (lines.length > 0) {
				let changed = false;


				for (let i = 0; i < lines.length; i++) {
					if (!lines[i]!.includes(reference)) {
						continue;
					}

					const taskMatch = /^(\s*)([-*+])\s+\[([ xX])\](\s+)(.*)$/.exec(lines[i]!);

					if (taskMatch) {
						// Preserve indentation, bullet, and task text.
						lines[i] =
							`${taskMatch[1]}${taskMatch[2]} [x]${taskMatch[4]}${taskMatch[5]}`;

						changed = true;
					}
				}

				if (changed) {
					await this.app.vault.modify(file, lines.join("\n"));
				}
			}
		}
	}

	/*
	async stopAllSessions(
		timestamp: Date = new Date()
	): Promise<void> {

		const stopTS = timestamp.toISOString();
		let sessions = await this.loadSessions();
		const activeSessions = this.findActiveSessions(sessions);
		if (activeSessions.length === 0) {
			return;  // no active sessions at all, no need to do anything
		}
		sessions = this.stopSessions(sessions, stopTS);

		await this.saveSessions(sessions);

	}

	

	private stopSessions(
		sessions: TimeSession[],
		stopTime: string,
		projectPath: string | null = null
	): TimeSession[] {
		// if projectPath is null, then stop all running projects, otherwise just stop the ones for the specified project
		return sessions.map(session => {
			const stopBool =
				session.end === null &&
				(projectPath === null || session.projectPath === projectPath);

			if (stopBool) {
				return {
					...session,
					end: stopTime
				};
			}
			return session;
		});
	}

	async getTimeSummary(
		rangeStart: Date,
		rangeEnd: Date
	): Promise<TimeSummary[]> {
		// Get summary of time worked between start and end for all projects
		
		const activeProjects = this.projectManager.getActiveProjects();

		// initialize the summary table
		const summaryArray = new Map<string, number>();

		// initialize the active project rows
		for (const project of activeProjects) {
			summaryArray.set(project.file.path, 0);
		}

		const sessions = await this.loadSessions();

		for (const session of sessions) {

			const rawStart = new Date(session.start);
			const rawEnd = session.end ? new Date(session.end) : new Date();

			const sessionStart = this.roundToNearest(rawStart, 15, true);
			const sessionEnd = session.end
				? this.roundToNearest(rawEnd, 15, false)
				: this.roundToNearest(rawEnd, 1, false);

			if ( sessionStart >= rangeEnd || sessionEnd <= rangeStart ) {
				continue;  // ignore any sessions that start after or end before the target range
			}

			if (
				session.end &&
				rawEnd.getTime() - rawStart.getTime() < 2 * 60 * 1000  // total time less than 2 minutes
			) {
				continue  // filter out sessions less than 2 minutes, which are most likely errors
			} 

			const effectiveStart =
				sessionStart > rangeStart ? sessionStart : rangeStart;

			const effectiveEnd =
				sessionEnd < rangeEnd ? sessionEnd : rangeEnd;

			const durationMinutes = Math.round(
				(effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60)
			);

			const currentTotal = summaryArray.get(session.projectPath) ?? 0;

			summaryArray.set(
				session.projectPath,
				currentTotal + durationMinutes
			);
		}

		const results: TimeSummary[] = [];

		for (const [projectPath, totalMinutes] of summaryArray) {
			results.push({
				projectPath,
				totalMinutes
			});
		}

		return results;

	}

	async getTimeSummaryByClient(
		rangeStart: Date,
		rangeEnd: Date
	): Promise<ClientTimeSummary[]> {
		// Get summary of time worked between start and end for all projects

		const projects = this.projectManager.getProjects();
		const clients = new Set(
			projects.map(project => project.client.replace(/^\[\[|\]\]$/g, ""))
		)
		const clientByProjectPath = new Map(
			projects.map(project => [
				project.file.path,
				project.client.replace(/^\[\[|\]\]$/g, "")
			])
		)

		// initialize the summary table
		const summaryArray = new Map<string, number>();

		// initialize the active project rows
		for (const client of clients) {
			summaryArray.set(client, 0);
		}

		const sessions = await this.loadSessions();

		for (const session of sessions) {

			const rawStart = new Date(session.start);
			const rawEnd = session.end ? new Date(session.end) : new Date();

			const sessionStart = this.roundToNearest(rawStart, 15, true);
			const sessionEnd = session.end
				? this.roundToNearest(rawEnd, 15, false)
				: this.roundToNearest(rawEnd, 1, false);

			if (sessionStart >= rangeEnd || sessionEnd <= rangeStart) {
				continue;  // ignore any sessions that start after or end before the target range
			}

			if (
				session.end &&
				rawEnd.getTime() - rawStart.getTime() < 2 * 60 * 1000  // total time less than 2 minutes
			) {
				continue  // filter out sessions less than 2 minutes, which are most likely errors
			}

			const effectiveStart =
				sessionStart > rangeStart ? sessionStart : rangeStart;

			const effectiveEnd =
				sessionEnd < rangeEnd ? sessionEnd : rangeEnd;

			const durationMinutes = Math.round(
				(effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60)
			);
			let currClient = clientByProjectPath.get(session.projectPath);
			if (!currClient) {
				currClient = '(none)';  // if no client entered, default to "none"
			}
			const currentTotal = summaryArray.get(currClient) ?? 0;

			summaryArray.set(
				currClient,
				currentTotal + durationMinutes
			);
		}

		const results: ClientTimeSummary[] = [];

		for (const [client, totalMinutes] of summaryArray) {
			results.push({
				client,
				totalMinutes
			});
		}

		return results;

	}

	private roundToNearest(date: Date, nearest: number = 15, start: boolean): Date {
		const msInterval = nearest * 60 * 1000; // 15 minutes in milliseconds
		if (start) {
			return new Date(Math.floor(date.getTime() / msInterval) * msInterval);
		} else {
			return new Date(Math.ceil(date.getTime() / msInterval) * msInterval);
		}
		
	}
	*/
}


