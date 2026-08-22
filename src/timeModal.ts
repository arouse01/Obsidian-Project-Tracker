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
		form.addClass('time-dashboard')
		if (this.options.mode === "stop") {

			const infoText = form.createDiv();
			infoText.addClass("time-modal-secondary");
			if (this.options.sessions.length > 1) {
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
				infoText.setText(`Session started at:`)
				infoText.createEl("br");
				const session = this.options.sessions[0]!
				const localStartTime = this.getDateTimeLocalValue(new Date(session.startTime))
				infoText.appendText(`${localStartTime} (${session.projectName})`)
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
						if (this.options.mode === "stop") {
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
							// const sessionStart = new Date(this.options.sessionStart!);

							// if (timestamp <= sessionStart) {
							// 	new Notice(
							// 		"Stop time must be after the session start time."
							// 	);
							// 	return;
							// }
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
