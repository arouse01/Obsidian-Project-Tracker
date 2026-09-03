import {
	App,
	Component,
	ButtonComponent
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import { TodoManager } from './todoTracker';
import {
	TodoItem
} from './types'
import {
	formatDate
} from './utils'
import {
	PRIORITIES,
	// PriorityOrder
} from "./constants";
import {
	sortItems,
	ColSort,
	// GroupDefs,
	TableColumn,
	updateSortButtons,
	getGroupOptions
} from './tableFunctions';
import {
	TODO_DASHBOARD_VIEW_TYPE
} from "./constants"

const TODO_COLS = {

	"name": {
		label: "Name",
		sortable: true,
		groupable: false
	},
	"priority": {
		label: "Priority",
		sortable: true,
		groupable: true,
		centered: true
	},
	"notes": {
		label: "Notes",
		sortable: false,
		groupable: false
	},
	"status": {
		label: "",
		sortable: false,
		groupable: false,
		centered: true
	},
	"project": {
		label: "Project",
		sortable: true,
		groupable: true,
		centered: true
	},
	"dueDate": {
		label: "Due",
		sortable: true,
		groupable: false,
		centered: true
	},
	"startDate": {
		label: "Added",
		sortable: false,
		groupable: false,
		centered: true
	},
	"action": {
		label: "Action",
		sortable: false,
		groupable: false,
		centered: true
	}
} satisfies Record<string, TableColumn>;


type TodoColumnField = keyof typeof TODO_COLS;

// type of ProjectColumnField here instead of SortField because it can now let any field be sorted, and that is defined by the master column list above
type TodoSort = ColSort<TodoColumnField>

type TodoGroupField =
	| "none"
	| {
		[K in keyof typeof TODO_COLS]:
		typeof TODO_COLS[K]["groupable"] extends true
		? K
		: never
	}[keyof typeof TODO_COLS];


interface TodoGroup {
	key: string;
	label: string;
	todos: TodoItem[];
}



export class TodoDashboardView extends Component {
	
	private todoTableEl!: HTMLTableElement;

	private todoTableBodyEl!: HTMLTableSectionElement;

	// currently the todo list can only be modified by itself, but at some point it might get modified by another process, so we want to keep it up to date
	private refreshInterval: number | null = null;  

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

	private sortButtons = new Map<TodoColumnField, ButtonComponent>();

	private groupButtons = new Map<TodoGroupField, ButtonComponent>();

	private projectMap = new Map<string, string>();

	private collapsedGroups = new Set<string>();  // which groups are collapsed in the table


	constructor(
		private container: HTMLElement,
		private app: App,
		private todoManager: TodoManager,
		private projectManager: MyProjectManager
	) {
		super();
		this.container = container;
	}

	getViewType(): string {
		return TODO_DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Todo dashboard";
	}

	getIcon(): string {
		return 'list-todo';
	}

	onload(): void {
		this.registerEvent(
			this.todoManager.on("todo-list-updated", () => {
				void this.updateTodoRows()
			})
		);

		this.buildDashboard();
		void this.updateTodoRows();

		this.refreshInterval = window.setInterval(() => {
			void this.updateTodoRows();
		}, 60000);
	}

	async onClose(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	private buildDashboard() {
		const mainSection = this.container.createEl("section");
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
		for (const group of getGroupOptions(TODO_COLS)) {
			const button = new ButtonComponent(controlSection)
				.setButtonText(group.label)
				.onClick(async () => {
					this.groupBy = group.value;
					this.collapsedGroups.clear();
					await this.rebuildTodoTable();
				});

			this.groupButtons.set(group.value, button);
		}
		// for (const group of Todo_Group_Fields) {
		// 	const button = new ButtonComponent(controlSection)
		// 		.setButtonText(group.label)
		// 		.onClick(async () => {
		// 			this.groupBy = group.value;
		// 			this.collapsedGroups.clear();
		// 			await this.rebuildTodoTable();
		// 		});

		// 	this.groupButtons.set(group.value, button);
		// }
	
		

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
				await this.todoManager.startBlankTodoItem();
			})


	}

	private createTodoTableHeaders(table: HTMLTableElement): void {
		const thead = table.createEl('thead');
		const row = thead.createEl('tr');

		for (const [field, column] of this.getVisibleCols()) {
			const header = row.createEl('th');
			
			if (column.centered) {
				header.addClass("center-align")
			}

			if (column.sortable) {
				const button = new ButtonComponent(header)
					// .setButtonText(column.label)
					.setClass("todo-dashboard-button")
					.onClick(async () => {
						// group is collapsed, uncollapse it
						this.updateSort(field);
						await this.updateTodoRows();
					});
				this.sortButtons.set(field, button);
			} else {
				header.setText(column.label)
			}
		}
		updateSortButtons(this.sortButtons, this.sortBy, TODO_COLS);
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

		todos = sortItems(
			todos,
			this.sortBy,
			(a, b, field) => this.compareTodos(a, b, field)
		)

		// todos = this.sortTodos(todos, this.sortBy)

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

		for (const [field, column] of this.getVisibleCols()) {
			const cell = row.createEl("td");
			if (column.centered) {
				cell.addClass("center-align")
			}
			this.renderColumn(cell, field, todo);
		}
		
	}

	private getVisibleCols(): Array<
		[TodoColumnField, TableColumn]
	> {
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
		return this.colOrder.map(field => [
			field,
			TODO_COLS[field]
		])
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

			case 'dueDate': {
				let dueDateFormat: string | undefined;
				const dueDateRaw = todo.dueDate;
				if (dueDateRaw !== undefined) {
					const dueDate = new Date(dueDateRaw);
					if (dueDate.getHours() === 0 &&
						dueDate.getMinutes() === 0
						) {
						dueDateFormat = formatDate(dueDate, "date");
					} else {
						dueDateFormat = dueDateRaw;
					}
				} else {
					dueDateFormat = ""
				}
				
				cell.setText(dueDateFormat)
				break;
			}

			case 'action':
				break;



		}
	}

	private compareTodos(
		a: TodoItem,
		b: TodoItem,
		field: TodoColumnField
	): number {
		switch (field) {
			case "project": {
				const projectA = a.projectPath ?? "";
				const projectB = b.projectPath ?? "";

				return projectA.localeCompare(projectB);
			}

			case "priority": {
				// const aPriority = PriorityOrder.get(a.priority) ?? 0;
				// const bPriority = PriorityOrder.get(b.priority) ?? 0;
				// return aPriority - bPriority;
				return a.priority - b.priority;
			}

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

			default:
				return 0;
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
			// console.log('Checkbox unchecked.');
		}
	}

	private updateSort(field: TodoColumnField) {
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


		updateSortButtons(this.sortButtons, this.sortBy, TODO_COLS);
		
	}

	/*private updateSortButtons(): void {

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
	}*/
}

