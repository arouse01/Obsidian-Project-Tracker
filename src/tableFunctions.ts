import {
	ButtonComponent
} from 'obsidian';

import {
	SortDirection
} from './types'

// Time summary functions
export type SummaryPeriod = "week" | "month";  // to drive the summary period selection

export function getSummaryPeriod(periodOffset: number, summaryPeriod: SummaryPeriod): { start: Date; end: Date } {
	const start = window.moment()
		.add(periodOffset, summaryPeriod)
		.startOf(summaryPeriod)
		.toDate();

	const end = window.moment()
		.add(periodOffset, summaryPeriod)
		.endOf(summaryPeriod)
		.toDate();

	return { start, end };
}

// Grouping and sorting
export interface TableColumn {
	label: string;
	sortable?: boolean;
	groupable?: boolean;
	width?: string;
	centered?: boolean;
}

export interface ColSort<Field> {
	field: Field;
	dir: SortDirection;
}

export function sortItems<Item, Field>(
	items: Item[],
	sorts: ColSort<Field>[],
	compare: (a: Item, b: Item, field: Field) => number
): Item[] {
	return items.sort((a, b) => {
		for (const sort of sorts) {
			const result = compare(a, b, sort.field);
			if (result !== 0) {
				return sort.dir === "asc"
					? result : -result;
			}
		}
		return 0;
	});
}



export interface GroupDefs<field, T> {
	field: field;
	getKey: (item: T) => string;
	getLabel: (key: string) => string;
}

export interface SortableColumn<Field> {
	label: string;
	sortField: Field;
}





// export type sortButtons:
// export function updateGroupByButtons<>(groupButtonMap: Map<ProjectGroupField, ButtonComponent>): void {
// 	for(const [field, button] of groupButtonMap) {
// 		button.buttonEl.toggleClass(
// 			"button-selected",
// 			this.groupBy === field
// 		)
// 	}
// }

export function updateSortButtons<
	Field extends string,
	Columns extends Record<Field, TableColumn>
>(
	sortButtons: Map<Field, ButtonComponent>,
	sortBy: ColSort<Field>[],
	columns: Columns
): void {
	// from projectDashboard: priavte sortButtons = new Map<ProjectColumn, ButtonComponent>();
	// type ProjectColumn = TableColumn<ProjectColumnField, ProjectSortField>

	for (const [field, button] of sortButtons) {
		const sortIndex = sortBy.findIndex(s => s.field === field);
		const sort = sortIndex >= 0
			? sortBy[sortIndex] : undefined;
	
		let text = columns[field].label;
		if (sort?.dir === "asc") {
			text += " ▲"
		} else if (sort?.dir === "desc") {
			text += " ▼"
		}
		if (sort?.dir) {
			text += (sortIndex + 1)
		}

		button.setButtonText(text);
	}
}

type GroupableFields<
	Columns extends Record<string, TableColumn>
> = {
	[K in keyof Columns]:
	Columns[K]["groupable"] extends true ? K : never
	}[keyof Columns];

export function getGroupOptions<
	Columns extends Record<string, TableColumn>
>(
	columns: Columns
): { value: "none" | GroupableFields<Columns>; label: string }[] {
	return [
		{ value: "none", label: "None" },
		...Object.entries(columns)
			.filter(([, column]) => column.groupable)
			.map(([field, column]) => ({
				value: field as GroupableFields<Columns>,
				label: column.label
			}))
	];
}
