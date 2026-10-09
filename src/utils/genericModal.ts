import {
	App,
	// MarkdownView,
	// MarkdownFileInfo,
	// CachedMetadata,
	Modal,
	// Notice,
	Setting
} from 'obsidian';
import {
	// SessionAction,
	// SessionContext,
	ModalItem,
	CreateGenericModalOptions,
	// ModalContext,
    CreateModalRequest
} from '@/utils/types';
import {
	// formatMinutesToDuration
} from '@/utils/utils'



export class GenericModal extends Modal {

	// private sessionAction: SessionAction;
	private inputs!: HTMLInputElement[];

	constructor(
		app: App,
		private options: CreateGenericModalOptions

	) {
		super(app);

		// set the initial values for the items returned at the end
		

	}

	onOpen() {
		const { contentEl } = this;

		// this.setTitle('Create Issue');
		contentEl.empty();

		const form = contentEl.createDiv({ cls: "issue-form" });
		form.addClass('font-size-12')
		this.inputs = []
		const items = this.options.context.items
		for (const item of items) {
			const field = this.createField(form, item)
			this.inputs.push(field)
		}

		this.buildButtons(form);


	}

	onClose() {
		// const { contentEl } = this;
		this.contentEl.empty();
	}

	createField(parent: HTMLDivElement, item: ModalItem): HTMLInputElement {
		parent.createEl("label", { text: item.text });
		let field: HTMLInputElement
		if (item.type === "number") {
			field = parent.createEl("input", { type: "number" });
		} else {
			field = parent.createEl("input", { type: "text" });
		}
		
		return field
		
	}

	

	// buildTimestampField(parent: HTMLElement): void {
	// 	switch (this.options.mode) {
	// 		case "start":
	// 			this.timestampStartInput = this.createTimestampField(parent, "start", true)
	// 			break;
	// 		case "stop":
	// 			this.timestampStopInput = this.createTimestampField(parent, "stop", true)
	// 			this.durationInput = this.createDurationField(parent, true)!
	// 			this.updateDurationFromStopTimestamp()
	// 			break;
	// 		case "stopAll":
	// 			this.timestampStopInput = this.createTimestampField(parent, "stop", true)
	// 			break;
	// 		case "add":
	// 			this.timestampStartInput = this.createTimestampField(parent, "start");
	// 			this.timestampStopInput = this.createTimestampField(parent, "stop");
	// 			this.durationInput = this.createDurationField(parent, true)!
	// 			this.updateDurationFromStopTimestamp()
	// 			break;
	// 	}
	// }

	/*createTimestampField(parent: HTMLElement, mode: "start" | "stop", fillCurrent: boolean = false): HTMLInputElement {
		// mode is whether to create the Start field or the End field
		// this.options.mode is whether the modal window being created is for 

		const fieldDiv = parent.createDiv();
		let labelText: string
		switch (mode) {
			case "start":
				labelText = "Start at"
				break;
			case "stop":
				labelText = "Stop at"
				break;
		}

		fieldDiv.createEl("label", { text: labelText });
		const field = fieldDiv.createEl("input", { type: "datetime-local" });
		if (fillCurrent) {
			field.value = this.getDateTimeLocalValue(new Date());
		}

		if (this.options.mode === "add" && mode === "start") {
			// in Add mode, update this.startTime every time the start timestamp field is updated
			field.addEventListener("change", () => {
				this.startTime = new Date(field.value)
				this.updateDurationFromStopTimestamp()
			})
		}
		if (mode === "stop") {
			// in Stop mode, update this.startTime every time the start timestamp field is updated
			field.addEventListener("change", () => {
				this.updateDurationFromStopTimestamp()
			})
		}

		 return field
	}

	createDurationField(parent: HTMLElement, fillCurrent: boolean = false): HTMLInputElement | null {
		// duration field only created for "stop" and "add" modes
		if (this.options.mode !== "stop" &&
			this.options.mode !== "add") {
			return null
		}

		const fieldDiv = parent.createDiv();

		fieldDiv.createEl("label", { text: "Duration" });
		const field = fieldDiv.createEl("input", { type: "text" });
		// if (fillCurrent) {
		// 	field.value = this.getDateTimeLocalValue(new Date());
		// }
		field.addEventListener("change", () => {
			this.updateStopTimestampFromDuration()			
		});

		return field
	}

	private durationStringtoMs(value: string): number | null {
		const [hoursString, minutesString] = value.split(":")
		const rawHours = Number(hoursString)
		const rawMinutes = Number(minutesString)
		// if user entered a number without a colon, coerce to just number of minutes
		// rawMinutes would be NaN because the value would be entirely in rawHours
		let hours: number;
		let minutes: number;
		if (isNaN(rawMinutes)) {
			hours = 0;
			minutes = rawHours
		} else {
			hours = rawHours
			minutes = rawMinutes
		}

		// also coerce to nearest whole minute
		minutes = Math.round(minutes)
		
		if (
			!Number.isInteger(hours) ||
			!Number.isInteger(minutes) ||
			hours < 0 ||
			minutes < 0 ||
			minutes >= 60
		) {
			return null;
		}
		return (hours * 60 + minutes) * 60 * 1000;
	}

	private updateStopTimestampFromDuration(): void {
		if (this.startTime) {
			const durationMs = this.durationStringtoMs(this.durationInput.value)
			if (durationMs === null) {
				return;
			}
			const stopTimestamp = this.startTime.getTime() + durationMs

			this.timestampStopInput.value = this.getDateTimeLocalValue(new Date(stopTimestamp))
		}
	}

	private updateDurationFromStopTimestamp(): void {
		const endTime = new Date(this.timestampStopInput.value)
		if (
			this.startTime &&
			!isNaN(endTime.getTime())
		) {
			const durationMinutes = Math.round((endTime.getTime() - this.startTime.getTime()) / (60 * 1000)) // round to nearest minute so duration doesn't return fractions
			this.durationInput.value = formatMinutesToDuration(durationMinutes)
		}
	}

	
	buildTimeButtons(parent: HTMLElement, mode: "start" | "stop"): void {
		


	}*/

	buildButtons(parent: HTMLElement) {
		new Setting(parent)
			.addButton(button => {
				button
					.setButtonText("OK")
					.setCta()
					.onClick(async () => {

						const output: CreateModalRequest = {responses: []}
						for (const field of this.inputs) {
							const value = field.value;
							output.responses.push(value);

						}

						await this.options.onSubmit(output);
							
						

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
	private getDateTimeLocalValue(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");

		return `${year}-${month}-${day}T${hours}:${minutes}`;
	}

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
	}*/

}
