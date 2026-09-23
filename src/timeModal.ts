import {
	App,
	// MarkdownView,
	// MarkdownFileInfo,
	// CachedMetadata,
	Modal,
	Notice,
	Setting
} from 'obsidian';
import {
	SessionAction,
	SessionContext,
} from "./types";
import {
	formatMinutesToDuration
} from "./utils"



export class TimeModal extends Modal {

	private sessionAction: SessionAction;
	private timestampStartInput!: HTMLInputElement;
	private timestampStopInput!: HTMLInputElement;
	private durationInput!: HTMLInputElement;

	private startTime: Date | undefined;

	constructor(
		app: App,
		private options: SessionContext

	) {
		super(app);

		// set the initial values for the items returned at the end
		

		this.sessionAction = options.mode;


	}

	onOpen() {
		const { contentEl } = this;

		// this.setTitle('Create Issue');
		contentEl.empty();

		const form = contentEl.createDiv({ cls: "issue-form" });
		form.addClass('font-size-12')
		if (this.options.mode === "stop" ||
			this.options.mode === "stopAll") {
			const infoText = form.createDiv();
			this.buildStartTimeDisplay(infoText)
		}
		this.buildTimestampField(form);

		this.buildButtons(form);


	}

	onClose() {
		// const { contentEl } = this;
		this.contentEl.empty();
	}

	buildStartTimeDisplay(infoText: HTMLDivElement): void {
		if (this.options.mode === "stop") {
			infoText.addClass("time-modal-secondary");
			infoText.setText(`Session started at:`)
			infoText.createEl("br");
			this.startTime = new Date(this.options.session.startTime);
			const localStartTime = this.getDateTimeLocalValue(this.startTime)

			infoText.appendText(`${localStartTime} (${this.options.session.projectName})`)
		} else if (this.options.mode === "stopAll") {
			infoText.addClass("time-modal-secondary");
			infoText.setText(`Sessions started at:`)

			const tableEl = infoText.createEl('table');
			tableEl.addClass('summary-section')
			const tableHeaderEl = tableEl.createEl('thead');
			const headerRowEl = tableHeaderEl.createEl('tr');
			headerRowEl.createEl('th', { text: 'Project' });
			headerRowEl.createEl('th', { text: 'Time' });

			const tableBodyEl = tableEl.createEl('tbody');
			for (const session of this.options.sessions) {
				const row = tableBodyEl.createEl('tr');

				const projectCell = row.createEl('td');
				const timeCell = row.createEl('td');


				projectCell.setText(session.projectName);
				timeCell.setText(this.getDateTimeLocalValue(new Date(session.startTime)))
			}
		} else {
			return
		}

		
		

	
	}

	buildTimestampField(parent: HTMLElement): void {
		switch (this.options.mode) {
			case "start":
				this.timestampStartInput = this.createTimestampField(parent, "start", true)
				break;
			case "stop":
				this.timestampStopInput = this.createTimestampField(parent, "stop", true)
				this.durationInput = this.createDurationField(parent, true)!
				this.updateDurationFromStopTimestamp()
				break;
			case "stopAll":
				this.timestampStopInput = this.createTimestampField(parent, "stop", true)
				break;
			case "add":
				this.timestampStartInput = this.createTimestampField(parent, "start");
				this.timestampStopInput = this.createTimestampField(parent, "stop");
				this.durationInput = this.createDurationField(parent, true)!
				this.updateDurationFromStopTimestamp()
				break;
		}
	}

	createTimestampField(parent: HTMLElement, mode: "start" | "stop", fillCurrent: boolean = false): HTMLInputElement {
		const fieldDiv = parent.createDiv();
		let labelText: string
		switch (mode) {
			case "start":
				labelText = "Start at"
				break;
			case "stop":
				labelText = "Start at"
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
				this.updateDurationFromStopTimestamp()
			})
		}
		if (mode === "stop") {
			// in Add mode, update this.startTime every time the start timestamp field is updated
			field.addEventListener("change", () => {
				this.updateDurationFromStopTimestamp()
			})
		}

		// new Setting(fieldDiv)
		// 	.addButton(button => {

		// 		button
		// 			.setButtonText("Cancel")
		// 			.onClick(() => this.close());

		// 	});
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

		// new Setting(fieldDiv)
		// 	.addButton(button => {

		// 		button
		// 			.setButtonText("Cancel")
		// 			.onClick(() => this.close());

		// 	});
		return field
	}

	private durationStringtoMs(value: string): number | null {
		const [hoursString, minutesString] = value.split(":")
		const hours = Number(hoursString)
		const minutes = Number(minutesString)
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
		if (this.startTime) {
			// this.startTime = new Date(this.durationInput.value)
			const endTime = new Date(this.timestampStopInput.value)

			const durationMinutes = (endTime.getTime() - this.startTime.getTime()) / (60 * 1000)
			this.durationInput.value = formatMinutesToDuration(durationMinutes)
		}
	}

	buildTimeButtons(parent: HTMLElement, mode: "start" | "stop"): void {
		


	}

	buildButtons(parent: HTMLElement) {
		new Setting(parent)
			.addButton(button => {
				button
					.setButtonText("OK")
					.setCta()
					.onClick(async () => {
						switch (this.options.mode) {
							case "start": {
								const timestamp = new Date(this.timestampStartInput.value)
								// Validate there's a value in the field
								if (Number.isNaN(timestamp.getTime())) {
									new Notice("Please enter a valid date and time.");
									return;
								}

								await this.options.onSubmit(timestamp);
								break;
							}
							case "stop": {
								const timestamp = new Date(this.timestampStopInput.value)
								// Validate there's a value in the field
								if (Number.isNaN(timestamp.getTime())) {
									new Notice("Please enter a valid date and time.");
									return;
								}

								let tooLong: boolean = false;
								// if we're stopping a session(s), sessionStart has to have a value. Can't stop a session with no start time!
								
								const sessionStart = new Date(this.options.session.startTime);
								if (timestamp <= sessionStart) {
									new Notice(
										"Stop time must be after the session start time."
									);
									return;
								}
								// 12 hours * 60 min/hr * 60 sec/min * 1000 ms/sec
								if (timestamp.getTime() - sessionStart.getTime() > (12 * 60 * 60 * 1000)) {
									tooLong = true;
								}
								
								if (tooLong) {
									const approved = await this.confirmLongSession()
									if (!approved) {
										return;
									}
								}
								await this.options.onSubmit(timestamp);
								break;
							}
							case "stopAll": {
								const timestamp = new Date(this.timestampStopInput.value)
								// Validate there's a value in the field
								if (Number.isNaN(timestamp.getTime())) {
									new Notice("Please enter a valid date and time.");
									return;
								}

								let tooLong = 0;
								// if we're stopping a session(s), sessionStart has to have a value. Can't stop a session with no start time!
								for (const session of this.options.sessions) {
									const sessionStart = new Date(session.startTime);
									if (timestamp <= sessionStart) {
										new Notice(
											"Stop time must be after the session start time."
										);
										return;
									}
									// 12 hours * 60 min/hr * 60 sec/min * 1000 ms/sec
									if (timestamp.getTime() - sessionStart.getTime() > (12 * 60 * 60 * 1000)) {
										tooLong++
									}
								}
								if (tooLong > 0) {
									const approved = await this.confirmLongSession()
									if (!approved) {
										return;
									}
								}
								await this.options.onSubmit(timestamp);

								break;
							}

							case "add": {
								const startTime = new Date(this.timestampStartInput.value)
								const stopTime = new Date(this.timestampStopInput.value)

								// Validate there's a value in the field
								if (Number.isNaN(startTime.getTime())) {
									new Notice("Please enter a valid start date and time.");
									return;
								}
								if (Number.isNaN(stopTime.getTime())) {
									new Notice("Please enter a valid end date and time.");
									return;
								}

								await this.options.onSubmit(startTime, stopTime);
								break;
							}

						}
						

						this.close();

					});

			})
			.addButton(button => {

				button
					.setButtonText("Cancel")
					.onClick(() => this.close());

			});
	}

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
	}

}
