import {
	App,
	Component,
	ButtonComponent,
	Menu
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import { IssueTracker } from './issueTracker';
import {
	IssueItem,
	PRIORITIES,
	// ProjectInfo
} from './types'
import {
	formatDate
} from './utils'
import {
	
	// PriorityOrder
} from "./constants";
import {
	sortItems,
	// SummaryColumn,
	GroupPosition,
	TableColumn,
	updateSortButtons,
	getGroupOptions,
	createTableColGroup
} from './tableFunctions';
import {
	ISSUE_COLS,
	IssueColumnField,
	IssueSort,
	IssueGroupField,
	IssueGroup
} from "./tableConstants"
import {
	ISSUE_DASHBOARD_VIEW_TYPE
} from "./constants"

export class IssueDashboardView extends Component {
	
	private issueTableEl!: HTMLTableElement;

	private issueTableBodyEl!: HTMLTableSectionElement;

	// currently the todo list can only be modified by itself, but at some point it might get modified by another process, so we want to keep it up to date
	private refreshInterval: number | null = null;  

	private groupBy: IssueGroupField = "none";
	private sortBy: IssueSort[] = [
		{ field: "priority", dir: "desc" },
		{ field: "name", dir: "desc" }
	];

	private colOrder: IssueColumnField[] = [
		"priority",
		"name",
		"project",
		"origin",
		"status",
		"startDate",
		"action"
	]

	private sortButtons = new Map<IssueColumnField, ButtonComponent>();

	private groupButtons = new Map<IssueGroupField, ButtonComponent>();

	private projectMap = new Map<string, string>();

	private collapsedGroups = new Set<string>();  // which groups are collapsed in the table


	constructor(
		private container: HTMLElement,
		private app: App,
		private issueTracker: IssueTracker,
		private projectManager: MyProjectManager,
		private selectedProject: string | null = null
	) {
		super();
		this.container = container;
	}

	getViewType(): string {
		return ISSUE_DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Issue dashboard";
	}

	getIcon(): string {
		return 'list-todo';
	}

	onload(): void {
		this.registerEvent(
			this.issueTracker.on("issue-list-updated", () => {
				void this.updateIssueRows()
			})
		);

		this.buildDashboard();
		void this.updateIssueRows();

		this.refreshInterval = window.setInterval(() => {
			void this.updateIssueRows();
		}, 60000);
	}

	async onClose(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	async selectProject(project: string) {
		this.container.empty()
		this.selectedProject = project;
		this.buildDashboard()
		void this.updateIssueRows();
	}

	private buildDashboard() {
		const mainSection = this.container.createEl("section");
		mainSection.addClass("dashboard")
		mainSection.addClass("font-size-12")

		if (!this.selectedProject) {
			const controlSection = mainSection.createEl("section");
			controlSection.addClass('summary-controls');
		
			this.createGroupingControls(controlSection)
		}
		

		const issueSection = mainSection.createEl("section");
		// todoSection.addClass("todo-dashboard")
		this.issueTableEl = issueSection.createEl('table');
		this.issueTableEl.addClass('dashboard-table')

		// create colgroup so we can specify column sizes
		const columns = this.getVisibleCols();
		createTableColGroup(this.issueTableEl, columns);
		this.createIssueTableHeaders(this.issueTableEl, columns);

		this.issueTableBodyEl = this.issueTableEl.createEl('tbody')


		const bottomSection = mainSection.createEl("section");
		const projInfo = this.projectManager.getProjectInfoByPath(this.selectedProject) ?? undefined
		new ButtonComponent(bottomSection)
			.setButtonText("Create new issue")
			.onClick(async () => {
				await this.issueTracker.createNewIssue(projInfo);
			})


	}

	private createGroupingControls(section: HTMLElement) {
		const groupingLabelDiv = section.createDiv()
		groupingLabelDiv.createEl("label", { text: 'Group by:' })
		section.createDiv()

		// Create grouping buttons 
		for (const group of getGroupOptions(ISSUE_COLS)) {
			const button = new ButtonComponent(section)
				.setButtonText(group.label)
				.onClick(async () => {
					this.groupBy = group.value;
					this.collapsedGroups.clear();
					await this.rebuildIssueTable();
				});

			this.groupButtons.set(group.value, button);
		}
	}

	private createIssueTableHeaders(
		table: HTMLTableElement,
		columns: Array<[IssueColumnField, TableColumn]>
	): void {
		const thead = table.createEl('thead');
		const row = thead.createEl('tr');

		for (const [field, column] of columns) {
			const header = row.createEl('th');
			
			if (!column.centered) {
				header.addClass("left-align")
			}

			if (column.sortable) {
				const button = new ButtonComponent(header)
					// .setButtonText(column.label)
					// .setClass("todo-dashboard-button")
					.onClick(async () => {
						// group is collapsed, uncollapse it
						this.updateSort(field);
						await this.updateIssueRows();
					});
				this.sortButtons.set(field, button);
			} else {
				header.setText(column.label)
			}
		}
		updateSortButtons(this.sortButtons, this.sortBy, ISSUE_COLS);
	}

	async updateIssueRows(): Promise<void> {
		// specifically for updating the rows without touching the headers
		const newBody = createEl('tbody');
		await this.buildIssueTableBody(newBody);
		this.issueTableBodyEl?.replaceWith(newBody);
		this.issueTableBodyEl = newBody;
		// await this.updateSummary();
	}

	async rebuildIssueTable(): Promise<void> {
		const newTable = createEl('table')
		newTable.addClass('dashboard-table')
		const columns = this.getVisibleCols();
		createTableColGroup(newTable, columns);
		this.createIssueTableHeaders(newTable, columns);
		const newBody = newTable.createEl('tbody')
		await this.buildIssueTableBody(newBody);

		this.issueTableEl.replaceWith(newTable);
		this.issueTableEl = newTable;
		this.issueTableBodyEl = newBody;
	}

	async buildIssueTableBody(tbody: HTMLTableSectionElement): Promise<void> {
		// update the body of the table only and return the updated table for actual loading into the ui
		this.updateGroupByButtons();
		
		const projects = this.projectManager.getProjects();
		
		this.projectMap = new Map(
			projects.map(project => [project.file.path, project.name])
		);
		let issues = await this.issueTracker.getIssues("active", this.selectedProject);

		issues = sortItems(
			issues,
			this.sortBy,
			(a, b, field) => this.compareIssues(a, b, field)
		)

		const groups = this.groupIssues(issues)
		
		for (const group of groups) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			if (this.groupBy !== 'none') {

				if (this.collapsedGroups.has(group.key)) {
					this.renderCollapsedGroupRow(tbody, group);
					continue;  // skip adding rows if the group is collapsed
				}
			}

			for (const [index, issue] of group.issues.entries()) {
				let groupPos: GroupPosition = null;
				if (this.groupBy !== 'none') {
					if (index === 0) {
						groupPos = "first";
					} else if (index === group.issues.length - 1) {
						groupPos = "last"
					} else {
						groupPos = "middle"
					}
				}
				
				this.createIssueRow(tbody, issue, groupPos)			
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

	private renderCollapsedGroupRow(target: HTMLTableSectionElement, group: IssueGroup) {
		const groupRow = target.createEl('tr');
		groupRow.addClass("first")
		groupRow.addClass("group-row")

		for (const [field,] of this.getVisibleCols()) {

			const cell = groupRow.createEl("td");

			this.renderCollapsedGroupCell(cell, field, group);
		}

		
	}

	private createIssueRow(
		target: HTMLTableSectionElement,
		issue: IssueItem,
		groupPos: GroupPosition = null
	) {
		const row = target.createEl('tr');
		if (groupPos === "first") {
			row.addClass("first")
		}

		for (const [field, column] of this.getVisibleCols()) {
			const cell = row.createEl("td");
			if (!column.centered) {
				cell.addClass("left-align")
			}
			this.renderCell(cell, field, issue, groupPos);
		}
		
	}

	private getVisibleCols(): Array<
		[IssueColumnField, TableColumn]
	> {
		if (this.selectedProject) {
			this.colOrder = [
				"name",
				"priority",
				"status",
				"origin",
				"startDate",
				"action"
			]
		} else {
			switch (this.groupBy) {
				case 'project':
					this.colOrder = [
						"collapse",
						"project",
						"priority",
						"name",
						"origin",
						"status",
						"startDate",
						"action"
					]
					break;
				case 'priority':
					this.colOrder = [
						"collapse",
						"priority",
						"name",
						"origin",
						"project",
						"status",
						"startDate",
						"action"
					]
					break;
				case 'none':
					this.colOrder = [
						"priority",
						"name",
						"origin",
						"project",
						"status",
						"startDate",
						"action"
					]
					break;
			}
		}
		return this.colOrder.map(field => [
			field,
			ISSUE_COLS[field]
		])
	}

	private renderCollapsedGroupCell(
		cell: HTMLTableCellElement,
		field: IssueColumnField,
		group: IssueGroup
	): void {

		switch (field) {
			case "collapse":
				{
					cell.addClass("group-member")
					cell.addClass("first")
					new ButtonComponent(cell)
						// .setIcon(`list-chevrons-down-up`)
						.setButtonText('⊞')
						// .setClass("first")
						.onClick(async () => {
							// group is collapsed, uncollapse it
							this.collapsedGroups.delete(group.key);
							await this.updateIssueRows();
						});
					break;

					/*new ButtonComponent(cell)
						// .setIcon(`list-chevrons-up-down`)
						
						.onClick(async () => {
							
						});
					break*/
				}

			case "priority":
			case "project":  // both are groupby targets, so if either are selected as group target then render the value in the correct column
				{
					if (this.groupBy === field) {
						// cell.setText(group.label)
						cell.addClass("left-align")
						new ButtonComponent(cell)
							.setButtonText(`${group.label}`)
							.setClass("left-align")
							.onClick(async () => {
								// group is collapsed, uncollapse it
								this.collapsedGroups.delete(group.key);
								await this.updateIssueRows();
							});
					}
					break
					

				}

			
			case "action":
				break;

			default:
				break;


		}
	}

	private renderCell(
		cell: HTMLTableCellElement,
		field: IssueColumnField,
		issue: IssueItem,
		groupPos: GroupPosition
	): void {
		switch (field) {
			case "collapse":
				{
					cell.addClass("group-member")
					switch (groupPos) {
						case "first":
							{
								cell.addClass("first")
								new ButtonComponent(cell)
									.setButtonText("⊟")
									.onClick(async () => {
										// group isn't collapsed, collapse it
										const groupKey = this.getGroupKey(issue)
										this.collapsedGroups.add(groupKey);
										await this.updateIssueRows();
									});
								break;
							}
						case "middle":
							{
								const wrapper = cell.createDiv({ cls: "group-tree-wrapper" })
								wrapper.createSpan({ cls: "group-tree-line" })
								wrapper.createSpan({ cls: "group-tree-branch" })
								break;
							}
						case "last":
							{
								const wrapper = cell.createDiv({ cls: "group-tree-wrapper" })
								wrapper.createSpan({ cls: "group-tree-line-last" })
								wrapper.createSpan({ cls: "group-tree-branch" })
								break;
							}
						default:
							break;
					}

				break;
			}

			case "name":
				{
					new ButtonComponent(cell)
						.setButtonText(issue.title)
						.setClass("left-align")
						.onClick(async (event) => {
							event.preventDefault();
							const existingLeaf = this.app.workspace.getLeavesOfType(
								"markdown"
							).find(leaf => {
								const view = leaf.view;
								return view.getState().file === issue.file.path;
							});

							if (existingLeaf) {
								void this.app.workspace.revealLeaf(existingLeaf);
							} else {
								void this.app.workspace.getLeaf(false).openFile(issue.file);
							}
						});
					break;

				}

			case "project":
				{  // curly braces needed to avoid warning about "unexpected lexical declaration" because we're defining a const
					const projectFile = this.projectManager.getProjectInfoByPath(issue.projectPath)
					const projectName = projectFile ? this.projectMap.get(issue.projectPath) ?? "Unknown" : "None";
					new ButtonComponent(cell)
						.setButtonText(projectName)
						.setClass("left-align")
						.onClick(async (event) => {
							event.preventDefault();
							const existingLeaf = this.app.workspace.getLeavesOfType(
								"markdown"
							).find(leaf => {
								const view = leaf.view;
								return view.getState().file === issue.projectPath;
							});

							if (existingLeaf) {
								void this.app.workspace.revealLeaf(existingLeaf);
							} else {
								void this.app.workspace.getLeaf(false).openFile(projectFile!.file);
							}
						});
					break;
				}

			case "priority":
				cell.setText(PRIORITIES.find(p => p.value === issue.priority)?.label ?? "Unknown");
				break;

			case "status":
				{
					cell.setText(issue.status)
					// const check = cell.createEl('input')
					// check.type = 'checkbox';
					// check.checked = issue.status;
					// check.addEventListener('change', (event: Event) => {
					// 	void this.todoCheckboxChange(event, issue.id)
					// })
					break;
				}
				
			case 'origin':
				{
					// cell.setText(issue.sourceFile?.path ?? "")
					const originFile = issue.sourceFile
					if (originFile) {
						const projectName = originFile.basename;
						new ButtonComponent(cell)
							.setButtonText(projectName)
							.setClass("left-align")
							.onClick(async (event) => {
								event.preventDefault();
								const existingLeaf = this.app.workspace.getLeavesOfType(
									"markdown"
								).find(leaf => {
									const view = leaf.view;
									return view.getState().file === issue.projectPath;
								});

								if (existingLeaf) {
									void this.app.workspace.revealLeaf(existingLeaf);
								} else {
									void this.app.workspace.getLeaf(false).openFile(originFile);
								}
							});
					}
				}
				break;

			case 'startDate':
				cell.setText(issue.startDate)
				break;


			case 'action':
				{
					new ButtonComponent(cell)
						.setIcon("ellipsis")
						// .setButtonText("Action")
						.setClass("dashboard")
						.onClick(async (event: MouseEvent) => {

							const menu = new Menu();

							// menu.addItem((item) => {
							// 	item.setTitle("Edit")
							// 		.onClick(async () => {
							// 			await this.issueTracker.editIssueData(issue)
							// 		});
							// });

							// menu.addItem((item) => {
							// 	item.setTitle("Delete")
							// 		.onClick(async () => {
							// 			await this.issueTracker.deleteIssueData(issue.id);
							// 		});
							// });

							
							menu.showAtMouseEvent(event);
						})

					break;
				}
				break;



		}
	}

	private compareIssues(
		a: IssueItem,
		b: IssueItem,
		field: IssueColumnField
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



			case "name": {
				const nameA = a.title;
				const nameB = b.title;
				return nameA.localeCompare(nameB);
			}

			default:
				return 0;
		}
	}

	private groupIssues(
		issues: IssueItem[],
		
	): IssueGroup[] {
		if (this.groupBy === "none") {
			return [{
				key: "all",
				label: "",
				issues: issues
			}];
		}
		const groups = new Map<string, IssueItem[]>();

		for (const issue of issues) {
			const key = this.getGroupKey(issue);

			if (!groups.has(key)) {
				groups.set(key, []);
			}

			groups.get(key)!.push(issue);
		}

		// Get the group labels after the groups are assembled so you only have to get each group label once instead of per item
		return Array.from(groups.entries()).map(
			([key, issues]) => ({
				key,
				label: this.getGroupLabel(key),
				issues: issues
			})
		);
	}

	private getGroupKey(
		issue: IssueItem,
	): string {
		// Needs a case statement for each item in types.Todo_Group_Fields to handle returning the group's key, based on the selected grouping
		switch (this.groupBy) {
			case "priority": 
				return String(issue.priority)

			case "project": 
				return String(issue.projectPath)

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

	/*private async todoCheckboxChange(
		event: Event,
		todoID: number
	): Promise<void> {
		const target = event.currentTarget as HTMLInputElement;

		if (target.checked) {
			await this.issueTracker.checkIssueData(todoID)
			await this.issueTracker.markTodoCompleteEverywhere(todoID)
		} else {
			// console.log('Checkbox unchecked.');
		}
	}*/

	private updateSort(field: IssueColumnField) {
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


		updateSortButtons(this.sortButtons, this.sortBy, ISSUE_COLS);
		
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

