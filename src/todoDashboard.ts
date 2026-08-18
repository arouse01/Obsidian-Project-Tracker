import {
	ItemView,
	WorkspaceLeaf,
	ButtonComponent,
	TFile
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	formatMinutesToDuration
} from './utils';
import { TodoManager } from './todoTracker';
import { TodoModal } from './todoModal';
import {
	TodoItem,
	TodoGroup,
	TodoSort,
	TodoGroupField,
	Todo_Group_Fields,
	TodoSortField,
	TodoContext,
	PRIORITIES
} from './types'

interface TodoColumn {
	field: TodoColumnField;
	label: string;
	sortField?: TodoSortField;
	centered?: boolean;
	width?: string;
}

type TodoColumnField = 
	"name" |
	"notes" |
	"project" |
	"priority" |
	"startDate" |
	"dueDate" |
	"status" |
	"action"

const TODO_COLS = new Map<TodoColumnField, TodoColumn>([
	// render determines how the field is set when it's created
	["name", {
		field: "name",
		label: "Name",
		sortField: "name"
	}],
	["priority", {
		field: "priority",
		label: "Priority",
		sortField: "priority",
		centered: true
	}],
	["notes", {
		field: "notes",
		label: "Notes"
	}],
	["status", {
		field: "status",
		label: "",
		// sortField: "status",
		centered: true
	}],
	["project", {
		field: "project",
		label: "Project",
		sortField: "project",
		centered: true
	}],
	["dueDate", {
		field: "dueDate",
		label: "Due",
		sortField: "dueDate",
		centered: true
	}],
	["startDate", {
		field: "startDate",
		label: "Added",
		// sortField: "startDate",
		centered: true
	}],
	["action", {
		field: "action",
		label: "Action",
		centered: true
	}]
]);

export class TodoDashboardView extends ItemView {
	// private summaryPeriod: "week" | "month" = "week";  // to drive the summary period selection
	// private periodOffset = 0;  // to drive the summary period selection, how far in the past to go

	private todoTableEl!: HTMLTableElement;
	// private todoTableHeaderEl!: HTMLTableSectionElement;
	private todoTableBodyEl!: HTMLTableSectionElement;

	// private groupByProjectButton!: ButtonComponent;
	// private groupByPriorityButton!: ButtonComponent;
	// private groupByNoneButton!: ButtonComponent;

	// private refreshInterval: number | null = null;
	private groupBy: TodoGroupField = "none";
	private sortBy: TodoSort[] = [
		{ field: "priority", dir: "desc" },
		{ field: "dueDate", dir: "desc" }
	];

	private colOrder: TodoColumnField[] = [
		"status",
		"priority",
		"name",
		"notes",
		"project",
		"startDate",
		"dueDate",
		"action"
	]

	private sortButtons = new Map<TodoColumn, ButtonComponent>();

	private groupButtons = new Map<TodoGroupField, ButtonComponent>();

	private projectMap = new Map<string, string>();

	private collapsedGroups = new Set<string>();  // which groups are collapsed in the table

	
	constructor(
		leaf: WorkspaceLeaf,
		private todoManager: TodoManager,
		private projectManager: MyProjectManager
	) {
		super(leaf);
	}

	getViewType(): string {
		return "todo-dashboard";
	}

	
	getDisplayText(): string {
		return "Todo Dashboard";
	}

	async onOpen(): Promise<void> {
		this.registerEvent(
			this.todoManager.on("todo-list-updated", () => {
				void this.updateTodoRows()
			})
		);

		this.buildDashboard();
		await this.updateTodoRows();

		// this.refreshInterval = window.setInterval(() => {
		// 	void this.updateSummary();
		// }, 60000);
	}

	async onClose(): Promise<void> {
		// if (this.refreshInterval !== null) {
		// 	window.clearInterval(this.refreshInterval);
		// 	this.refreshInterval = null;
		// }
	}

	private buildDashboard() {
		const mainSection = this.contentEl.createEl("section");
		// mainSection.createEl("h3", {
		// 	text: "Todo list"
		// });
		mainSection.addClass("todo-dashboard")
		const controlSection = mainSection.createEl("section");
		controlSection.addClass('todo-controls');
		
		const groupingLabelDiv = controlSection.createDiv()
		groupingLabelDiv.createEl("label", { text: 'Group by:' })
		controlSection.createDiv()
		
		// Create grouping buttons 
		// To add a new value, update Todo_Group_Fields in types.ts and then 
		for (const group of Todo_Group_Fields) {
			const button = new ButtonComponent(controlSection)
				.setButtonText(group.label)
				.onClick(async () => {
					this.groupBy = group.value;
					this.collapsedGroups.clear();
					await this.rebuildTodoTable();
				});

			this.groupButtons.set(group.value, button);
		}
	
		

		const todoSection = mainSection.createEl("section");
		todoSection.addClass("todo-dashboard")
		this.todoTableEl = todoSection.createEl('table');
		this.createTodoTableHeaders(this.todoTableEl);

		this.todoTableBodyEl = this.todoTableEl.createEl('tbody')


		const bottomSection = mainSection.createEl("section");
		new ButtonComponent(bottomSection)
			.setButtonText("Create new todo")
			.setClass("todo-dashboard-button-add")
			.onClick(async () => {
				const tempTitle = "";
				const lines = -1;
				// const sourceFile = view.file!;
				const projectNames = null;
				const projectPaths = null;
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
						await this.todoManager.addNewTodoItem(request);
					}
				}).open();
			})


	}

	private createTodoTableHeaders(table: HTMLTableElement): void {
		const thead = table.createEl('thead');
		const row = thead.createEl('tr');

		for (const column of this.getVisibleCols()) {
			const header = row.createEl('th');
			
			if (column.centered) {
				header.addClass("center-align")
			}

			if (column.sortField) {
				const button = new ButtonComponent(header)
					// .setButtonText(column.label)
					.setClass("todo-dashboard-button")
					.onClick(async () => {
						// group is collapsed, uncollapse it
						this.updateSort(column.sortField!);
						await this.updateTodoRows();
					});
				this.sortButtons.set(column, button);
			} else {
				header.setText(column.label)
			}
		}
		this.updateSortButtons();
	}

	async updateTodoRows(): Promise<void> {
		// specifically for updating the rows without touching the headers
		const newBody = createEl('tbody');
		await this.buildTodoTableBody(newBody);
		this.todoTableBodyEl?.replaceWith(newBody);
		this.todoTableBodyEl = newBody;
		// await this.updateSummary();
	}

	async rebuildTodoTable(): Promise<void> {
		const newTable = createEl('table')
		this.createTodoTableHeaders(newTable);
		const newBody = newTable.createEl('tbody')
		await this.buildTodoTableBody(newBody);

		this.todoTableEl.replaceWith(newTable);
		this.todoTableEl = newTable;
		this.todoTableBodyEl = newBody;
	}

	async buildTodoTableBody(tbody: HTMLTableSectionElement): Promise<void> {
		// update the body of the table only and return the updated table for actual loading into the ui
		this.updateGroupByButtons();
		const projects = this.projectManager.getProjects();
		this.projectMap = new Map(
			projects.map(project => [project.file.path, project.name])
		);
		let todos = await this.todoManager.getActiveTodos();
		// const activeTodoMap = new Map(
		// 	todos.map(todo => [todo.projectPath, todo])
		// );

		todos = this.sortTodos(todos, this.sortBy)

		const groups = this.groupTodos(todos)

		// const newTable = createEl('table')
		// this.createTodoTableHeaders(targetTable);

		
		for (const group of groups) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			if (this.groupBy !== 'none') {
				this.renderGroupHeader(tbody, group);
				if (this.collapsedGroups.has(group.key)) {
					continue;  // skip adding rows if the group is collapsed
				}
			}
			
			for (const todo of group.todos) {
				this.createTodoRow(tbody, todo)			
			}
		}


	}

	private updateGroupByButtons(): void {
		for (const [field, button] of this.groupButtons) {
			button.buttonEl.toggleClass(
				"button-selected",
				this.groupBy === field
			)
		}
	}

	private renderGroupHeader(target: HTMLTableSectionElement, group: TodoGroup) {
		const groupRow = target.createEl('tr');
		const groupCell = groupRow.createEl('td');
		groupCell.colSpan = this.colOrder.length;
		if (this.collapsedGroups.has(group.key)) {
			new ButtonComponent(groupCell)
				.setButtonText(`${group.label} ▶`)
				.setClass("todo-dashboard-button")
				.onClick(async () => {
					// group is collapsed, uncollapse it
					this.collapsedGroups.delete(group.key);
					await this.updateTodoRows();
				});
		} else {
			new ButtonComponent(groupCell)
				.setButtonText(`${group.label} ▼`)
				.onClick(async () => {
					// group isn't collapsed, collapse it
					this.collapsedGroups.add(group.key);
					await this.updateTodoRows();
				});
		}
		
	}

	private createTodoRow(target: HTMLTableSectionElement, todo: TodoItem) {
		const row = target.createEl('tr');

		for (const column of this.getVisibleCols()) {
			const cell = row.createEl("td");
			if (column.centered) {
				cell.addClass("center-align")
			}
			this.renderColumn(cell, column.field, todo);
		}
		/*const actionCell = row.createEl('td');
		const priorityCell = row.createEl('td');
		const nameCell = row.createEl('td');
		const descCell = row.createEl('td');
		const projectCell = row.createEl('td');
		const dueDateCell = row.createEl('td');
		
		// const checkboxCell = row.createEl('td');
		

		actionCell.addClass("center-align");
		const check = actionCell.createEl('input')
		check.type = 'checkbox';
		check.checked = todo.status;
		check.addEventListener('change', (event: Event) => {
			void this.todoCheckboxChange(event, todo.id)
		});
		nameCell.setText(todo.name);

		descCell.setText(todo.notes ?? "");

		const projectName = todo.projectPath ? this.projectMap.get(todo.projectPath) ?? "Unknown" : "None";
		projectCell.setText(projectName);
		projectCell.addClass('center-align');


		priorityCell.setText(PRIORITIES.find(p => p.value === todo.priority)?.label ?? "Unknown")

		dueDateCell.setText(todo.dueDate ?? "")
		dueDateCell.addClass('center-align');*/

		// actionCell.addClass("time-dashboard-centered");

		// new ButtonComponent(actionCell)
		// 	.setButtonText(activeSession ? "Stop" : "Start")
		// 	.onClick(async () => {
		// 		if (activeSession) {
		// 			await this.todoManager.stopProjectSession(project)
		// 		} else {
		// 			await this.todoManager.startProjectSession(project)
		// 		}
		// 	})

		// new ButtonComponent(actionCell)
		// 	.setButtonText(activeSession ? "Stop at" : "Start at")
		// 	.onClick(async () => {
		// 		if (activeSession) {
		// 			new TodoModal(this.app, {
		// 				mode: 'stop',
		// 				projectPath: project.file.path,
		// 				sessionStart: activeSession.start,
		// 				onSubmit: async (timestamp: Date) => {
		// 					await this.todoManager.stopProjectSession(
		// 						project,
		// 						timestamp
		// 					);
		// 				}
		// 			}).open();
		// 		} else {
		// 			new TodoModal(this.app, {
		// 				mode: 'start',
		// 				projectPath: project.file.path,
		// 				onSubmit: async (timestamp: Date) => {
		// 					await this.todoManager.startProjectSession(
		// 						project,
		// 						timestamp
		// 					);
		// 				}
		// 			}).open();
		// 		}

		// 	})
	}

	private getVisibleCols(): TodoColumn[] {
		switch (this.groupBy) {
			case 'project':
				this.colOrder = [
					"status",
					"priority",
					"name",
					"notes",
					"startDate",
					"dueDate",
					//"action"
				]
				break;
			case 'priority':
				this.colOrder = [
					"status",
					"name",
					"notes",
					"project",
					"startDate",
					"dueDate",
					//"action"
				]
				break;
			case 'none':
				this.colOrder = [
					"status",
					"priority",
					"name",
					"notes",
					"project",
					"startDate",
					"dueDate",
					//"action"
				]
				break;
		}

		return this.colOrder
			.map(field => TODO_COLS.get(field))
			.filter((column): column is TodoColumn => column !== undefined);
	}


	private renderColumn(
		cell: HTMLTableCellElement,
		field: TodoColumnField,
		todo: TodoItem
	): void {
		switch (field) {
			case "name":
				cell.setText(todo.name);
				break;

			case "project":
				{  // curly braces needed to avoid warning about "unexpected lexical declaration" because we're defining a const
					const projectName = todo.projectPath ? this.projectMap.get(todo.projectPath) ?? "Unknown" : "None";
					cell.setText(projectName);
					cell.addClass('center-align');
					break;
				}

			case "priority":
				cell.setText(PRIORITIES.find(p => p.value === todo.priority)?.label ?? "Unknown");
				break;

			case "status":
				{
					cell.addClass("center-align");
					const check = cell.createEl('input')
					check.type = 'checkbox';
					check.checked = todo.status;
					check.addEventListener('change', (event: Event) => {
						void this.todoCheckboxChange(event, todo.id)
					})
					break;
				}
				
			case 'notes':
				cell.setText(todo.notes ?? "")
				break;

			case 'startDate':
				cell.setText(todo.dateAdded)
				break;

			case 'dueDate':
				cell.setText(todo.dueDate ?? "")
				break;

			case 'action':
				break;



		}
	}

	private sortTodos(
		todos: TodoItem[],
		sorts: TodoSort[]
	): TodoItem[] {
		return [...todos].sort((a, b) => {
			for (const sort of sorts) {
				const compare = this.compareTodos(a, b, sort.field);
				if (compare !== 0) {
					return sort.dir === "asc"
						? compare : -compare;
				
				}
			}
			return 0;
		});
	}

	private compareTodos(
		a: TodoItem,
		b: TodoItem,
		field: TodoSortField
	): number {
		switch (field) {
			case "project": {
				const projectA = a.projectPath ?? "";
				const projectB = b.projectPath ?? "";

				return projectA.localeCompare(projectB);
			}

			case "priority":
				return a.priority - b.priority;

			case "dueDate": {
				const dateA = a.dueDate
					? new Date(a.dueDate).getTime()
					: Infinity;

				const dateB = b.dueDate
					? new Date(b.dueDate).getTime()
					: Infinity;

				return dateA - dateB;
			}

			case "name": {
				const nameA = a.name;
				const nameB = b.name;
				return nameA.localeCompare(nameB);
			}
		}
	}

	private groupTodos(
		todos: TodoItem[],
		
	): TodoGroup[] {
		if (this.groupBy === "none") {
			return [{
				key: "all",
				label: "",
				todos
			}];
		}
		const groups = new Map<string, TodoItem[]>();

		for (const todo of todos) {
			const key = this.getGroupKey(todo);

			if (!groups.has(key)) {
				groups.set(key, []);
			}

			groups.get(key)!.push(todo);
		}

		// Get the group labels after the groups are assembled so you only have to get each group label once instead of per item
		return Array.from(groups.entries()).map(
			([key, todos]) => ({
				key,
				label: this.getGroupLabel(key),
				todos
			})
		);
	}

	private getGroupKey(
		todo: TodoItem,
	): string {
		// Needs a case statement for each item in types.Todo_Group_Fields to handle returning the group's key, based on the selected grouping
		switch (this.groupBy) {
			case "priority": 
				return String(todo.priority)

			case "project": 
				return String(todo.projectPath)

			default:
				return "";
		}
	}

	private getGroupLabel(
		key: string
	): string {
		// Needs a case statement for each item in types.Todo_Group_Fields to handle returning the individual group name, based on the selected grouping
		switch (this.groupBy) {
			case "priority":
				return PRIORITIES.find(p => p.value === Number(key))?.label ?? "Unknown";

			case "project": 
				return key ? this.projectMap.get(key) ?? "Unknown" : "None";

			default:
				return "";
		}
	}

	private async todoCheckboxChange(
		event: Event,
		todoID: number
	): Promise<void> {
		const target = event.currentTarget as HTMLInputElement;

		if (target.checked) {
			await this.todoManager.completeTodoItem(todoID)
			await this.todoManager.markTodoCompleteEverywhere(todoID)
		} else {
			console.log('Checkbox unchecked.');
		}
	}

	private updateSort(field: TodoSortField) {
		const index = this.sortBy.findIndex(sort => sort.field === field);

		if (index === -1) {
			// index of -1 means it's not in the list at all, add it
			this.sortBy.unshift({
				field,
				dir: "asc"
			});
		} else {
			const sort = this.sortBy[index];
			if (sort!.dir === "asc") {
				// currently ascending, change to descending
				sort!.dir = "desc";

				// move to front of array
				this.sortBy.splice(index, 1);
				this.sortBy.unshift(sort!);
			} else {
				// dir can only be asc, desc, or none (not present)
				this.sortBy.splice(index, 1);
			}
		}


		this.updateSortButtons();
		
	}

	private updateSortButtons(): void {

		for (const [col, button] of this.sortButtons) {
			const sort = this.sortBy.find(s => s.field === col.sortField);
			const sortIndex = this.sortBy.findIndex((sort) => sort.field === col.sortField);
			let text = col.label;
			if (sort?.dir === "asc") {
				text += " ▲"
			} else if (sort?.dir === "desc") {
				text += " ▼"
			}
			if (sort?.dir) {
				;
				text += (sortIndex+1)
			}

			button.setButtonText(text);
		}
	}
}

