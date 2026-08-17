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
	TodoSortField,
	TodoContext,
	PRIORITIES
} from './types'

export class TodoDashboardView extends ItemView {
	private summaryPeriod: "week" | "month" = "week";  // to drive the summary period selection
	private periodOffset = 0;  // to drive the summary period selection, how far in the past to go

	private projectTableBodyEl!: HTMLTableSectionElement;
	private summaryTableBodyEl!: HTMLTableSectionElement;
	private rangeText!: HTMLElement;

	private groupByProjectButton!: ButtonComponent;
	private groupByPriorityButton!: ButtonComponent;
	private groupByNoneButton!: ButtonComponent;

	// private refreshInterval: number | null = null;
	private groupBy: TodoGroupField = "none";
	private sortBy: TodoSort[] = [
		{ field: "priority", dir: "desc" },
		{ field: "dueDate", dir: "desc" }
	];

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
				void this.updateDashboard()
			})
		);

		this.buildDashboard();
		await this.updateDashboard();

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
		mainSection.createEl("h3", {
			text: "Todo list"
		});
		mainSection.addClass("todo-dashboard")
		const controlSection = mainSection.createEl("section");
		controlSection.addClass('todo-controls');
		
		// controlSection.addClass('todo-dashboard')
		const groupingLabelDiv = controlSection.createDiv()
		groupingLabelDiv.createEl("label", { text: 'Group by:' })
		controlSection.createDiv()
		this.groupByProjectButton = new ButtonComponent(controlSection)
			.setButtonText("Project")
			// .setClass("todo-dashboard-button")
			.onClick(async () => {
				this.groupBy = "project";
				this.collapsedGroups.clear();
				await this.updateTodos();
			});

		this.groupByPriorityButton = new ButtonComponent(controlSection)
			.setButtonText("Priority")
			.setClass("todo-dashboard-button")
			.onClick(async () => {
				this.groupBy = "priority";
				this.collapsedGroups.clear();
				await this.updateTodos();
			});

		this.groupByNoneButton = new ButtonComponent(controlSection)
			.setButtonText("None")
			.setClass("todo-dashboard-button")
			.onClick(async () => {
				this.groupBy = "none";
				this.collapsedGroups.clear();
				await this.updateTodos();
			});
		// actionCell.addClass("time-dashboard-centered");
		
		const todoSection = mainSection.createEl("section");
		todoSection.addClass("todo-dashboard")
		const tableMainEl = todoSection.createEl('table');
		const tableMainHeaderEl = tableMainEl.createEl('thead');
		const headerMainRowEl = tableMainHeaderEl.createEl('tr');

		headerMainRowEl.createEl('th', { text: '' });
		headerMainRowEl.createEl('th', { text: 'Priority' });
		headerMainRowEl.createEl('th', { text: 'Todo' });
		headerMainRowEl.createEl('th', { text: 'Description' });
		headerMainRowEl.createEl('th', { text: 'Project' });
		headerMainRowEl.createEl('th', { text: 'Due date' });
		

		this.projectTableBodyEl = tableMainEl.createEl('tbody');

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
		/*const summarySection = this.contentEl.createEl("section");
		summarySection.createEl("h3", {
			text: "Summary"
		});


		summarySection.addClass('time-dashboard')

		const summaryControlsTop = summarySection.createDiv();
		summaryControlsTop.addClass('summary-controls')

		summaryControlsTop.createEl('label', {
			text: 'Summarize by:',
			attr: { for: 'period-selector' }
		});
		const periodSelect = summaryControlsTop.createEl('select', {
			cls: 'summary-period-select',
			attr: { id: 'period-selector' }
		});
		periodSelect.createEl('option', {
			value: 'week',
			text: "Week"
		});
		periodSelect.createEl('option', {
			value: 'month',
			text: "Month"
		});
		periodSelect.value = this.summaryPeriod;

		periodSelect.addEventListener("change", () => {
			const value = periodSelect.value;

			if (value === "week" || value === "month") {
				this.summaryPeriod = value;
				void this.updateSummary();
			}
		});

		const summaryControlsBottom = summarySection.createDiv();
		summaryControlsBottom.addClass('summary-controls')
		new ButtonComponent(summaryControlsBottom)
			.setButtonText("⏴")
			.setClass("arrow-button")
			.onClick(async () => {
				this.periodOffset--;
				await this.updateSummary();
			});
		const { start, end } = this.getSummaryPeriod();

		let dateRangeText: string;
		if (this.summaryPeriod === "week") {
			dateRangeText = `${window.moment(start).format("MMM DD")} - ${window.moment(end).format("MMM DD")}`
		} else {
			dateRangeText = window.moment(start).format("MMMM YYYY")
		}
		this.rangeText = summaryControlsBottom.createSpan({
			text: dateRangeText,
			cls: "fixed-width-date-range"
		})

		new ButtonComponent(summaryControlsBottom)
			.setButtonText("⏵")
			.setClass("arrow-button")
			.onClick(async () => {
				this.periodOffset++;
				await this.updateSummary();
			})

		new ButtonComponent(summaryControlsBottom)
			.setButtonText("Now")
			.onClick(async () => {
				this.periodOffset = 0;
				await this.updateSummary();
			})

		// select.style.width = "100%";

		const tableSummaryEl = summarySection.createEl('table');
		tableSummaryEl.addClass('summary-section')
		const tableSummaryHeaderEl = tableSummaryEl.createEl('thead');
		const headerSummaryRowEl = tableSummaryHeaderEl.createEl('tr');
		headerSummaryRowEl.createEl('th', { text: 'Project' });
		headerSummaryRowEl.createEl('th', { text: 'Time' });

		this.summaryTableBodyEl = tableSummaryEl.createEl('tbody');*/
	}

	async updateDashboard(): Promise<void> {
		await this.updateTodos();
		// await this.updateSummary();
	}

	async updateTodos(): Promise<void> {
		this.updateGroupByButtons();
		const projects = this.projectManager.getProjects();
		this.projectMap = new Map(
			projects.map(project => [project.file.path, project.name])
		);
		let todos = await this.todoManager.getActiveTodos();
		const activeTodoMap = new Map(
			todos.map(todo => [todo.projectPath, todo])
		);

		todos = this.sortTodos(todos, this.sortBy)

		const groups = this.groupTodos(todos, this.groupBy)

		const newBody = createEl('tbody')
		
		for (const group of groups) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			if (this.groupBy !== 'none') {
				this.renderGroupHeader(newBody, group);
				if (this.collapsedGroups.has(group.key)) {
					continue;  // skip adding rows if the group is collapsed
				}
			}
			
			for (const todo of group.todos) {
				this.createTodoRow(newBody, todo)
				
			}
		}
			


		this.projectTableBodyEl.replaceWith(newBody);
		this.projectTableBodyEl = newBody;

	}

	private updateGroupByButtons(): void {
		this.groupByProjectButton.buttonEl.toggleClass(
			"button-selected",
			this.groupBy === "project"
		)
		this.groupByPriorityButton.buttonEl.toggleClass(
			"button-selected",
			this.groupBy === "priority"
		)
		this.groupByNoneButton.buttonEl.toggleClass(
			"button-selected",
			this.groupBy === "none"
		)
	}

	private renderGroupHeader(target: HTMLTableSectionElement, group: TodoGroup) {
		const groupRow = target.createEl('tr');
		const groupCell = groupRow.createEl('td');
		groupCell.addClass('left-align');
		groupCell.colSpan = 6;
		if (this.collapsedGroups.has(group.key)) {
			new ButtonComponent(groupCell)
				.setButtonText(`${group.label} ▶`)
				.setClass("todo-dashboard-button")
				.onClick(async () => {
					// group is collapsed, uncollapse it
					this.collapsedGroups.delete(group.key);
					await this.updateDashboard();
				});
		} else {
			new ButtonComponent(groupCell)
				.setButtonText(`${group.label} ▼`)
				.onClick(async () => {
					// group isn't collapsed, collapse it
					this.collapsedGroups.add(group.key);
					await this.updateDashboard();
				});
		}
		
	}

	private createTodoRow(target: HTMLTableSectionElement, todo: TodoItem) {
		const row = target.createEl('tr');

		const actionCell = row.createEl('td');
		const priorityCell = row.createEl('td');
		const nameCell = row.createEl('td');
		const descCell = row.createEl('td');
		const projectCell = row.createEl('td');
		const dueDateCell = row.createEl('td');
		
		// const checkboxCell = row.createEl('td');
		

		actionCell.addClass("todo-dashboard-centered");
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

		priorityCell.setText(PRIORITIES.find(p => p.value === todo.priority)?.label ?? "Unknown")

		dueDateCell.setText(todo.dueDate ?? "")

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

	async updateSummary(): Promise<void> {
		
		/*const { start, end } = this.getSummaryPeriod();

		let dateRangeText: string;
		if (this.summaryPeriod === "week") {
			dateRangeText = `${window.moment(start).format("MMM DD")} - ${window.moment(end).format("MMM DD")}`
		} else {
			dateRangeText = window.moment(start).format("MMMM YYYY")
		}
		this.rangeText.setText(dateRangeText);

		// create temporary body for table, then fill it and swap for the current one instead of clearing the whole thing
		const newBody = createEl('tbody')

		const summaryTotals = await this.todoManager.getTimeSummary(start, end);
		*//*
			summaryTotals are returned as array of TimeSummary objects 
			which is projectPath (string) and totalMinutes (number), so 
			we have to loop through and assign to the table
		*//*
		for (const timeSum of summaryTotals) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			const row = newBody.createEl('tr');

			const projectCell = row.createEl('td');
			const totalCell = row.createEl('td');


			const file = this.app.vault.getAbstractFileByPath(timeSum.projectPath);

			if (file instanceof TFile) {
				const projectName = file.basename;
				projectCell.setText(projectName);
			}


			const durationText = formatMinutesToDuration(timeSum.totalMinutes);
			totalCell.setText(durationText)

		}
		// this.summaryTableBodyEl.empty();
		this.summaryTableBodyEl.replaceWith(newBody);
		this.summaryTableBodyEl = newBody;*/
	}

	private getSummaryPeriod(): { start: Date; end: Date } {
		const start = window.moment()
			.add(this.periodOffset, this.summaryPeriod)
			.startOf(this.summaryPeriod)
			.toDate();

		const end = window.moment()
			.add(this.periodOffset, this.summaryPeriod)
			.endOf(this.summaryPeriod)
			.toDate();

		return { start, end };
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
		groupBy: TodoGroupField
	): TodoGroup[] {
		if (groupBy === "none") {
			return [{
				key: "all",
				label: "",
				todos
			}];
		}
		const groups = new Map<string, TodoItem[]>();

		for (const todo of todos) {
			const key = this.getGroupKey(todo, groupBy);

			if (!groups.has(key)) {
				groups.set(key, []);
			}

			groups.get(key)!.push(todo);
		}

		// Get the group labels after the groups are assembled so you only have to get each group label once instead of per item
		return Array.from(groups.entries()).map(
			([key, todos]) => ({
				key,
				label: this.getGroupLabel(key, groupBy),
				todos
			})
		);
	}

	private getGroupKey(
		todo: TodoItem,
		groupBy: TodoGroupField
	): string {
		switch (groupBy) {
			case "priority": 
				return String(todo.priority)
			

			case "project": 
				return String(todo.projectPath)
			

			default:
				return "";
		}
	}

	private getGroupLabel(
		key: string,
		groupBy: TodoGroupField
	): string {
		switch (groupBy) {
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
}

