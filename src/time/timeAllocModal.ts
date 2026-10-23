import {
	App,
	Modal,
	Setting
} from 'obsidian';
import {
	ProjectInfo,
	WeeklyAllocation,
	TimeAllocModalOptions,
	CreateAllocRequest
} from '@/utils/types';
import {
	TIME_ALLOC_COLS,
	TimeAllocColumnField
} from '@/utils/tableConstants'
import {
	createTableColGroup,
	TableColumn
} from '../utils/tableFunctions';


interface AllocationRow {
	project: ProjectInfo,
	input: HTMLInputElement
}

type AllocationState = "low" | "normal" | "high";

export class TimeAllocModal extends Modal {

	
	private allocRows: AllocationRow[] = [];
	private totalField!: HTMLTableCellElement
	private projects: ProjectInfo[]

	constructor(
		app: App,
		private options: TimeAllocModalOptions

	) {
		super(app);

		// set the initial values for the items returned at the end
		this.projects = this.options.projects



	}

	onOpen() {
		const { contentEl } = this;

		// this.setTitle('Create Issue');
		contentEl.empty();

		const form = contentEl.createDiv({ cls: 'font-size-14' });
		// form.addClass('issue-form')
		void this.buildLayout(form)

	}

	onClose() {
		// const { contentEl } = this;
		this.contentEl.empty();
	}
	async buildLayout(parent: HTMLElement) {
		/*
		┌───────────────────────────────────────┐
		│            Target hours               │
		│                                       │
		│ Project 1   10h/week     [____]       │
		│                                       │
		│ Project 2   45h/mo       [____]       │
		│                                       │
		│ Project 3   12h/week     [____]       │
		│                                       │
		├──────────────────                     │
		│ Total hours              ______       │
		│                                       │
		├───────────────────────────────────────┤
		│       [ Cancel ]       [ OK ]         │
		└───────────────────────────────────────┘
		*/
		const tableDiv = parent.createDiv()
		const tableMainEl = tableDiv.createEl('table', {cls: "dashboard-table"});
		// tableMainEl.addClass("dashboard-table")

		const timeCols = this.getVisibleCols()
		createTableColGroup(tableMainEl, timeCols)
		this.createHeaders(tableMainEl, timeCols)
		
		// row.createEl('th');
		const tableBody = tableMainEl.createEl('tbody');
		await this.buildTable(tableBody)
		
		// create summary row
		this.buildButtons(parent);
	}

	private getVisibleCols(): Array<
		[TimeAllocColumnField, TableColumn]
	> {
		const colOrder: TimeAllocColumnField[] = [
			"project",
			"target",
			"weekGoal"
		]

		return colOrder.map(field => [
			field,
			TIME_ALLOC_COLS[field]
		])

	}

	private createHeaders(
		table: HTMLTableElement,
		columns: Array<[TimeAllocColumnField, TableColumn]>
	): void {
		const thead = table.createEl('thead');
		const row = thead.createEl('tr');

		for (const [, column] of columns) {
			const header = row.createEl('th');

			if (!column.centered) {
				header.addClass("left-align")
			}

			header.setText(column.label)
		}
/*
			if (column.sortable) {
				const button = new ButtonComponent(header)
					.onClick(async () => {
						// group is collapsed, uncollapse it
						this.updateSort(field);
						await this.updateTimeRows();
					});
				this.sortButtons.set(field, button);
			} else {
				header.setText(column.label)
			}
		}
		updateSortButtons(this.sortButtons, this.sortBy, TIME_COLS);*/
	}
	async buildTable(tbody: HTMLTableSectionElement): Promise<void> {
		// build body rows
		await this.buildBody(tbody)
		// build summary row
		await this.createSummaryRow(tbody)

		this.updateTotalField()
	}

	async buildBody(target: HTMLTableSectionElement): Promise<void> {
		// build row per project
		for (const project of this.projects) {
			// create each row
			const row = target.createEl('tr')

			const projCell = row.createEl("td", {cls: "left-align"});
			projCell.createEl("label", { text: project.name });

			const targetCell = row.createEl("td");
			let targetText: string;
			if (project.targetHours) {
				let period: string
				if (project.targetHours?.period === "month") {
					period = "h/mo"
				} else if (project.targetHours?.period === "week") {
					period = "h/wk"
				} else {
					period = "h/day"
				}
				targetText = `${project.targetHours?.hours} ${period}`
			} else {
				targetText = ''
			}
			targetCell.createEl("label", { text: targetText });

			const weekGoalCell = row.createEl("td");
			const weekGoalInput = weekGoalCell.createEl('input', { type: "number" })
			weekGoalInput.setCssStyles({width: '60px', textAlign: 'center'})
			const prevValue = this.options.previousAlloc[project.file.path]
			weekGoalInput.value = `${prevValue}`

			// if (fillCurrent) {
			// 	field.value = this.getDateTimeLocalValue(new Date());
			// }
			weekGoalInput.addEventListener("change", () => {
				this.updateTotalField()
			});

			const allocRow: AllocationRow = {
				project,
				input: weekGoalInput
			}
			this.allocRows.push(allocRow)
		}

		
	}

	async createSummaryRow(target: HTMLTableSectionElement): Promise<void> {
		const row = target.createEl('tr');
		const projCell = row.createEl('td', {cls: 'summary-row left-align'})

		projCell.createEl("label", { text: "Total time" });

		row.createEl("td", {cls: 'summary-row'});

		this.totalField = row.createEl("td", { cls: 'summary-row allocation-total' });

		 // = weekGoalCell.createDiv()
		// this.totalField.setCssStyles({width:"60px", height:"32px"})

	}

	updateTotalField() {
		const total = this.allocRows.reduce(
			(sum, row) => sum + (Number(row.input.value) || 0),
			0
		)
		this.totalField.setText(`${total}`)

		const state: AllocationState =
			total < 10 ? "low" :
				total > 40 ? "high" :
					"normal";

		this.totalField.dataset.state = state;

	}

	private getAllocations(): WeeklyAllocation {
		return Object.fromEntries(
			this.allocRows.map(({ project, input }) => [
				project.file.path,
				Number(input.value) || 0,
			])
		);
	}



	buildButtons(parent: HTMLElement) {
		new Setting(parent)
			.addButton(button => {
				button
					.setButtonText("OK")
					.setCta()
					.onClick(async () => {
						const returnData: CreateAllocRequest = {
							dateKey: this.options.dateKey,
							allocations: this.getAllocations()
						}

						await this.options.onSubmit(returnData);
					
						this.close();

					});

			})
			.addButton(button => {

				button
					.setButtonText("Cancel")
					.onClick(() => this.close());

			});
	}

/*
	private async confirmLongSession(): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);

			modal.titleEl.setText("Long session");

			modal.contentEl.createEl("p", {
				text: "One or more sessions is over 12 hours long. Are you sure you want to continue?"
			});

			const buttonContainer = modal.contentEl.createDiv({
				cls: "modal-button-container"
			});

			buttonContainer.createEl("button", {
				text: "Cancel"
			}).addEventListener("click", () => {
				resolve(false);
				modal.close();
			});

			buttonContainer.createEl("button", {
				text: "OK",
				cls: "mod-cta"
			}).addEventListener("click", () => {
				resolve(true);
				modal.close();
			});

			modal.onClose = () => {
				// Treat closing the modal with X/Escape as Cancel
				resolve(false);
			};

			modal.open();
		});
	}
*/
}
