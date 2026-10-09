import {
	AbstractInputSuggest,
	App
} from "obsidian";



export class AutocompleteInput extends AbstractInputSuggest<string> {
	private options: string[]
	private isEditing = false;

	private selectedIndex = -1;

	constructor(
		app: App,
		inputEl: HTMLInputElement,
		options: string[]
	) {
		super(app, inputEl);

		this.options = [...options].sort((a, b) =>
			a.localeCompare(b)
		);

		inputEl.addEventListener("focus", () => {
			// user has just clicked in, show full list regardless of current value
			this.isEditing = false;
		})
		inputEl.addEventListener("input", () => {
			// user entering, filter list to input
			this.isEditing = true;
		})
		
	}

	getSuggestions(inputStr: string): string[] {
		if (!this.isEditing) {
			return this.options;
		}

		const input = inputStr.toLowerCase();

		return this.options.filter(option =>
			option.toLowerCase().includes(input)
		);
	}

	renderSuggestion(
		option: string,
		el: HTMLElement
	): void {
		el.setText(option)
	}

	selectSuggestion(
		option: string,
		evt: MouseEvent | KeyboardEvent
	): void {
		this.setValue(option);
		this.close()
	}
}


