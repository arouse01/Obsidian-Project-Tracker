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
	SessionContext
} from "./types";


export class TimeModal extends Modal {

	private sessionAction: SessionAction;
	private timestampInput!: HTMLInputElement;


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
		if (this.sessionAction === "stop") {
			if (this.options.sessionStart) {
				const startTimeString = this.getDateTimeLocalValue(new Date(this.options.sessionStart));
				const labelText = `Session started: ${startTimeString}`
				const startText = form.createDiv({
					text: labelText
				});

				startText.addClass("time-modal-secondary");
			}
		}
		this.buildTimestampField(form);
		this.buildButtons(form);


	}

	onClose() {
		// const { contentEl } = this;
		this.contentEl.empty();
	}

	buildTimestampField(parent: HTMLElement): void {
		let fieldLabel: string;
		if (this.sessionAction === "start") {
			fieldLabel = 'Start at'
		} else {
			fieldLabel = 'Stop at'
		}

		parent.createEl("label", {
			text: fieldLabel,

		});

		this.timestampInput = parent.createEl("input", {
			type: "datetime-local"
		});
		this.timestampInput.value = this.getDateTimeLocalValue(new Date());
		

	}

	

	buildButtons(parent: HTMLElement) {
		new Setting(parent)
			.addButton(button => {

				button
					.setButtonText("OK")
					.setCta()
					.onClick(async () => {
						const timestamp = new Date(this.timestampInput.value)

						// Validate there's a value in the field
						if (Number.isNaN(timestamp.getTime())) {
							new Notice("Please enter a valid date and time.");
							return;
						}
						// For stopping a session, check that the value in the field is greater than the start time
						if (
							this.sessionAction === "stop" &&
							this.options.sessionStart
						) {
							const sessionStart = new Date(this.options.sessionStart);

							if (timestamp <= sessionStart) {
								new Notice(
									"Stop time must be after the session start time."
								);
								return;
							}
						}

						await this.options.onSubmit(timestamp);

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

	

}
