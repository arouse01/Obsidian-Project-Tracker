import {
	App,
	Component,
	ButtonComponent,
	// TFile
} from 'obsidian';
import {
	ProjectInfo,
	NoteItem,
	NoteType
} from '@/utils/types';
import {
	normalizeWikiLink,
	// getFrontmatterString,
	// getFrontmatterStringArray,
	formatDate
} from '@/utils/utils';
import { MyProjectManager } from '@/projects/projectManager'
import {
	GroupPosition,
	sortItems,
	// ColSort,
	TableColumn,
	updateSortButtons,
	// getGroupOptions,
	createTableColGroup
} from '@/utils/tableFunctions';
import {
	NOTE_COLS,
	NoteColumnField,
	NoteGroup,
	NoteGroupField,
	NoteSort
} from '@/utils/tableConstants'
import {
	NoteManager
} from '@/notes/noteManager'

export class NoteDashboard extends Component {

	private container: HTMLDivElement;
	private filter: NoteType
	private selectedProject: ProjectInfo | undefined
	// private filterBy: ProjectStatusFilter = "Active"; // to drive which projects are visible
	private groupBy: NoteGroupField = "project";
	private sortBy: NoteSort[] = [
		{ field: "project", dir: "asc" }
	];

	private colOrder: NoteColumnField[] = [
		"project",
		"title",
		"filename",
		"people",
		"topic",
		"date",
		"action"
	]

	private sortButtons = new Map<NoteColumnField, ButtonComponent>();

	private noteTableEl!: HTMLTableElement;
	private noteTableBodyEl!: HTMLTableSectionElement;

	private projectMap = new Map<string, string>();

	private refreshInterval: number | null = null;
	private collapsedGroups = new Set<string>();  // which groups are collapsed in the table

	constructor(
		target: HTMLDivElement,
		filter: NoteType = "other",
		private app: App,
		private noteManager: NoteManager,
		private projectManager: MyProjectManager,
		private projectPath?: string,

	) {
		super();

		this.container = target;
		this.selectedProject = this.projectManager.getProjectInfoByPath(projectPath)!

		this.filter = filter;
		// this.tableContainer = target.createDiv();

		void this.buildDashboard();

	}


	async selectProject(projectPath: string) {
		const project = this.projectManager.getProjectInfoByPath(projectPath)
		if (project === undefined) {
			throw new Error(`Project not found: ${projectPath}`);
		}
		this.selectedProject = project

		this.container.empty()
		await this.buildDashboard()
		await this.updateNoteRows()

	}

	private async buildDashboard() {
		// await this.updateValues()

		const mainSection = this.container.createEl("section");
		mainSection.addClass("dashboard")
		mainSection.addClass("font-size-12")

		if (!this.selectedProject) {
			const controlSection = mainSection.createEl("section");
			controlSection.addClass('summary-controls');
		}


		const noteSection = mainSection.createEl("section");
		// todoSection.addClass("todo-dashboard")
		this.noteTableEl = noteSection.createEl('table');
		this.noteTableEl.addClass('dashboard-table')

		// create colgroup so we can specify column sizes
		const columns = this.getVisibleCols();
		createTableColGroup(this.noteTableEl, columns);
		this.createNoteTableHeaders(this.noteTableEl, columns);

		this.noteTableBodyEl = this.noteTableEl.createEl('tbody')

			
		}

	private createNoteTableHeaders(
		table: HTMLTableElement,
		columns: Array<[NoteColumnField, TableColumn]>
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
						await this.updateNoteRows();
					});
				this.sortButtons.set(field, button);
			} else {
				header.setText(column.label)
			}
		}
		updateSortButtons(this.sortButtons, this.sortBy, NOTE_COLS);
	}

	async updateNoteRows(): Promise<void> {
		// specifically for updating the rows without touching the headers
		const newBody = createEl('tbody');
		await this.buildNoteTableBody(newBody);
		this.noteTableBodyEl?.replaceWith(newBody);
		this.noteTableBodyEl = newBody;
		// await this.updateSummary();
	}

	// async rebuildIssueTable(): Promise<void> {
	// 	const newTable = createEl('table')
	// 	newTable.addClass('dashboard-table')
	// 	const columns = this.getVisibleCols();
	// 	createTableColGroup(newTable, columns);
	// 	this.createNoteTableHeaders(newTable, columns);
	// 	const newBody = newTable.createEl('tbody')
	// 	await this.buildNoteTableBody(newBody);

	// 	this.noteTableEl.replaceWith(newTable);
	// 	this.noteTableEl = newTable;
	// 	this.noteTableBodyEl = newBody;
	// }
	
	async updateNoteTableRows(): Promise<void> {
		// specifically for updating the rows without touching the headers
		const newBody = createEl('tbody');
		await this.buildNoteTableBody(newBody);
		this.noteTableBodyEl?.replaceWith(newBody);
		this.noteTableBodyEl = newBody;
	}

	async buildNoteTableBody(tbody: HTMLTableSectionElement): Promise<void> {
		// update the body of the table only and return the updated table for actual loading into the ui
		// this.updateGroupByButtons();

		const projects = this.projectManager.getProjects();

		this.projectMap = new Map(
			projects.map(project => [project.file.path, project.name])
		);
		let notes: NoteItem[]
		if (this.selectedProject) {
			notes = await this.noteManager.getProjectNotes(this.filter, this.selectedProject);
		} else {
			notes = await this.noteManager.getAllNotes(this.filter);
		}

		notes = sortItems(
			notes,
			this.sortBy,
			(a, b, field) => this.compareNotes(a, b, field)
		)

		const groups = this.groupNotes(notes)

		for (const group of groups) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			if (this.groupBy !== 'none') {

				if (this.collapsedGroups.has(group.key)) {
					this.renderCollapsedGroupRow(tbody, group);
					continue;  // skip adding rows if the group is collapsed
				}
			}

			for (const [index, note] of group.notes.entries()) {
				let groupPos: GroupPosition = null;
				if (this.groupBy !== 'none') {
					if (index === 0) {
						groupPos = "first";
					} else if (index === group.notes.length - 1) {
						groupPos = "last"
					} else {
						groupPos = "middle"
					}
				}

				this.createNoteRow(tbody, note, groupPos)
			}
		}

		this.createAddNoteRow(tbody)

	}

	async updateValues(): Promise<void> {
		// const activeSessions = await this.timeTracker.getActiveSessions();
		// this.activeSessionMap = new Map(
		// 	activeSessions.map(session => [session.projectPath, session])
		// );
		// this.timeSummaries = await this.timeTracker.getCurrentTimeSummaries();
		// await this.summaryTable.updateSummaryRows()


	}

	private updateSort(field: NoteColumnField) {
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


		updateSortButtons(this.sortButtons, this.sortBy, NOTE_COLS);

	}

	// private updateGroupByButtons(): void {
	// 	for (const [field, button] of this.groupButtons) {
	// 		button.buttonEl.toggleClass(
	// 			"button-selected",
	// 			this.groupBy === field
	// 		)
	// 	}
	// }

	private renderCollapsedGroupRow(target: HTMLTableSectionElement, group: NoteGroup) {
		const groupRow = target.createEl('tr');
		groupRow.addClass("first")
		groupRow.addClass("group-row")

		for (const [field,] of this.getVisibleCols()) {

			const cell = groupRow.createEl("td");

			this.renderCollapsedGroupCell(cell, field, group);
		}


	}

	private compareNotes(
		a: NoteItem,
		b: NoteItem,
		field: NoteColumnField
	): number {
		switch (field) {
			case "filename": {
				const fileA = normalizeWikiLink(a.file.name) ?? "";
				const fileB = normalizeWikiLink(b.file.name) ?? "";
				return fileA.localeCompare(fileB);
			}

			case "project": {
				const projectA = this.noteManager.getProjectSortKey(a);
				const projectB = this.noteManager.getProjectSortKey(b);
				return projectA.localeCompare(projectB);
			}

			case "dateModified": {
				const dateA = a.dateModified
					? a.dateModified.getTime()
					: Infinity;
				const dateB = b.dateModified
					? b.dateModified.getTime()
					: Infinity;
				return dateA - dateB;
			}

			case "date": {
				const dateA = a.date
					? a.date.getTime()
					: Infinity;
				const dateB = b.date
					? b.date.getTime()
					: Infinity;
				return dateA - dateB;
			}

			case "title": {
				const titleA = a.title;
				const titleB = b.title ?? "";
				return titleA.localeCompare(titleB);
			}


			default:
				// we list all the sortable fields here, and if the field isn't sortable return 0 which means the values are equivalent (for this comparison)
				return 0;

		}
	}

	private groupNotes(
		notes: NoteItem[]
	): NoteGroup[] {
		if (this.groupBy === "none") {
			return [{
				key: "all",
				label: "",
				notes
			}];
		}
		const groups = new Map<string, NoteItem[]>();

		for (const note of notes) {
			const key = this.getGroupKey(note);

			if (!groups.has(key)) {
				groups.set(key, []);
			}

			groups.get(key)!.push(note);
		}

		// Get the group labels after the groups are assembled so you only have to get each group label once instead of per item
		return Array.from(groups.entries()).map(
			([key, notes]) => ({
				key,
				label: this.getGroupLabel(key),
				notes
			})
		);
	}

	private getGroupKey(
		note: NoteItem,
	): string {
		// Needs a case statement for each item in types.Todo_Group_Fields to handle returning the group's key, based on the selected grouping
		switch (this.groupBy) {
			case "project":
				return normalizeWikiLink(this.noteManager.getProjectSortKey(note))

			default:
				return "";
		}
	}

	private getGroupLabel(
		key: string
	): string {
		// Needs a case statement for each item in types.Todo_Group_Fields to handle returning the individual group name, based on the selected grouping
		switch (this.groupBy) {
			case "project":
				return key;

			// case "project":
			// 	return key ? this.projectMap.get(key) ?? "Unknown" : "None";

			default:
				return "";
		}
	}

	private getVisibleCols(): Array<
		[NoteColumnField, TableColumn]
	> {
		if (this.selectedProject) {
			this.colOrder = [
				"title",
				"date",
				"dateModified",
				"topic",
				"tags",
				"action"
			]
		} else {
			switch (this.groupBy) {
				case 'project':
					this.colOrder = [
						"collapse",
						"project",
						"title",
						"date",
						"dateModified",
						"people",
						"tags",
						"action"
					]
					break;
				
				case 'none':
					this.colOrder = [
						"project",
						"title",
						"date",
						"dateModified",
						"topic",
						"people",
						"tags",
						"action"
					]
					break;
			}
		}
		return this.colOrder.map(field => [
			field,
			NOTE_COLS[field]
		])
	}

	private createNoteRow(
		target: HTMLTableSectionElement,
		issue: NoteItem,
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

	private createAddNoteRow(
		target: HTMLTableSectionElement
	) {
		const row = target.createEl('tr');
		for (const [field,] of this.getVisibleCols()) {
			const cell = row.createEl("td");

			this.renderAddNoteRowCell(cell, field);
		}

	}

	private renderCell(
		cell: HTMLTableCellElement,
		field: NoteColumnField,
		note: NoteItem,
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
									// .setClass("first")
									.onClick(async () => {
										// group isn't collapsed, collapse it
										const groupKey = this.getGroupKey(note)
										this.collapsedGroups.add(groupKey);
										await this.updateNoteTableRows();
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
	
			case "title":
				{
					new ButtonComponent(cell)
						.setButtonText(note.title)
						.setClass("left-align")
						.onClick(async (event) => {
							event.preventDefault();
							const existingLeaf = this.app.workspace.getLeavesOfType(
								"markdown"
							).find(leaf => {
								const view = leaf.view;
								return view.getState().file === note.file.path;
							});

							if (existingLeaf) {
								void this.app.workspace.revealLeaf(existingLeaf);
							} else {
								void this.app.workspace.getLeaf(false).openFile(note.file);
							}
						});
					break
				}

			case "filename":
				{
					cell.addClass("left-align")
					const groupKey = this.getGroupKey(note)
					new ButtonComponent(cell)
						.setButtonText(`${this.getGroupLabel(groupKey)}`)
						.setClass("left-align")
						.onClick(async () => {
							// group isn't collapsed, collapse it

							this.collapsedGroups.add(groupKey);
							await this.updateNoteTableRows();
						});



					break;
				}

			case "date":
				{
					if (note.date) {
						const dateFormatted = formatDate(note.date, "datetime_short")
						cell.setText(dateFormatted)
					}
					
					break
				}

			case "dateModified":
				{
					if (note.dateModified) {
						const modifiedFormatted = formatDate(note.dateModified)
						cell.setText(modifiedFormatted)
					}
					
					break
				}

			case "project":
				{ 
					cell.addClass("left-align")

					if (note.project) {
						note.project.forEach((project, ) => {
							new ButtonComponent(cell)
								.setButtonText(project.name ?? "none")
								.setClass("left-align")
								.onClick(async (event) => {
									event.preventDefault();
									const existingLeaf = this.app.workspace.getLeavesOfType(
										"markdown"
									).find(leaf => {
										const view = leaf.view;
										return view.getState().file === project.file.path;
									});

									if (existingLeaf) {
										void this.app.workspace.revealLeaf(existingLeaf);
									} else {
										void this.app.workspace.getLeaf(false).openFile(project.file);
									}
								});
						})
					} else {
						cell.setText("None")
					}
					break;
				}

			case "people":
				{  // curly braces needed to avoid warning about "unexpected lexical declaration" because we're defining a const
					cell.addClass("left-align")

					if (note.people) {

						cell.setText(note.people?.join(", "))
					}

					break;
				}

			case "tags":
				{  
					cell.addClass("left-align")

					if (note.tags) {

						cell.setText(note.tags?.join(", "))
					}

					break;
				}
			case "action":
				{
					
					break;
				}
			

		}
	}

	private renderCollapsedGroupCell(
		cell: HTMLTableCellElement,
		field: NoteColumnField,
		group: NoteGroup
	): void {

		const activeCount = group.notes.length;

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
							await this.updateNoteTableRows();
						});
					break;

				}
			
			case "project":
				{
					/*
						Client is being displayed in the Project column because when grouping by client, the client column
						is not included. For the client value to be displayed, it has to get put in a column that IS present, 
						and we're not summarizing the project names so that column is empty anyway
					*/
					// cell.setText(group.label)
					cell.addClass("left-align")
					new ButtonComponent(cell)
						.setButtonText(`${group.label}`)
						.setClass("left-align")
						.onClick(async () => {
							// group is collapsed, uncollapse it
							this.collapsedGroups.delete(group.key);
							await this.updateNoteTableRows();
						});
					break
					/*
										cell.addClass("left-align")
					
										if (this.collapsedGroups.has(group.key)) {
											new ButtonComponent(cell)
												.setButtonText(`[+] ${group.label}`)
												.setClass("left-align")
												.onClick(async () => {
													// group is collapsed, uncollapse it
													this.collapsedGroups.delete(group.key);
													await this.updateProjectTableRows();
												});
										} else {
											new ButtonComponent(cell)
												.setButtonText(`[-] ${group.label}`)
												.setClass("left-align")
												.onClick(async () => {
													// group isn't collapsed, collapse it
													this.collapsedGroups.add(group.key);
													await this.updateProjectTableRows();
												});
										}
										break;
					*/

				}
			case "title":
				cell.setText(`${activeCount} notes`)
				break

			default:
				break

			



		}
	}

	

	private renderAddNoteRowCell(
		cell: HTMLTableCellElement,
		field: NoteColumnField,
	): void {

		cell.addClass('summary-row')

		switch (field) {
			case "project":
				{  // curly braces needed to avoid warning about "unexpected lexical declaration" because we're defining a const
					new ButtonComponent(cell)
						.setButtonText("New note...")
						.setClass("right-align")
						.onClick(async () => {
							await this.addNote();
							await this.updateNoteTableRows();
						});

					break;
				}



			default:

				break;



		}
	}

	async addNote(): Promise<void> {

	}
}


