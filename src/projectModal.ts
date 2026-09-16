import {
	App,
	// MarkdownView,
	// MarkdownFileInfo,
	// CachedMetadata,
	Modal,
	Notice,
	Setting,
	setIcon
} from 'obsidian';
import {
	CreateProjectRequest,
	ProjectModalOptions
} from "./types";
import {
	AutocompleteInput
} from "./autocomplete"


/*
ProjectInfo {
	file: TFile;
	name: string;
	status: string;
	id?: string;
	client: string;
}

*/

export class ProjectModal extends Modal {
	private projectName = "";
	private selectedClient = "";

	private clientList: string[] | null;
	private collaboratorList: string[] | null;

	private collabListDiv!: HTMLDivElement;
	private nameField!: HTMLInputElement;
	private clientField!: HTMLInputElement;

	constructor(
		app: App,
		private options: ProjectModalOptions

	) {
		super(app);

		this.clientList = options.context.clients;
		this.collaboratorList = options.context.collaborators;

	}

	onOpen() {
		const { contentEl } = this;

		// this.setTitle('Create Issue');
		contentEl.empty();

		contentEl.createEl("h2", {
			text: "Create new project"
		});

		const form = contentEl.createDiv({ cls: "issue-form" });
		this.buildNameField(form);
		this.buildClientField(form);
		this.buildCollaboratorField(form);
		this.buildButtons(form);


	}

	onClose() {
		// const { contentEl } = this;
		this.contentEl.empty();
	}

	buildNameField(parent: HTMLElement): void {
		parent.createEl("label", {
			text: "Project name"
		});
		this.nameField = parent.createEl("input", {
			type: "text"
		});

		this.nameField.addEventListener("input", () => {
			this.projectName = this.nameField.value;
		});
		
	}

	buildClientField(parent: HTMLElement) {
		parent.createEl("label", {
			text: "Primary"
		});
		this.clientField = parent.createEl("input", {
			type: "text",
			// placeholder: "Primary"
		});

		if (this.clientList) {
			this.clientField.addClass("autocomplete-input")
			new AutocompleteInput(
				this.app,
				this.clientField,
				this.clientList
			)
		}
		// const clientDatalist = parent.createEl("datalist", {
		// 	attr: {
		// 		id: "client-options"
		// 	}
		// });

		// if (this.clientList) {
		// 	for (const client of this.clientList) {
		// 		clientDatalist.createEl("option", {
		// 			value: client
		// 		});
		// 	}
		// 	input.setAttribute("list","client-options")
		// }
		
		// input.addEventListener("change", () => {
		// 	this.selectedClient = input.value;
		// });
		
	}

	buildCollaboratorField(parent: HTMLElement): void {
		parent.createEl("label", {
			text: "Collaborators"
		});
		this.collabListDiv = parent.createDiv("collaborator-list")
		
		const addButton = parent.createEl("button", {
			text: "Add collaborator [+]",
			cls: "collaborator-button"
		});

		const addCollab = (value = "") => {
			// in-function method to define a subfunction
			const row = this.collabListDiv.createDiv("collaborator-row");
			const input = row.createEl("input", {
				type: "text",
				value
			});
			if (this.collaboratorList) {
				input.addClass("autocomplete-input")
				new AutocompleteInput(
					this.app,
					input,
					this.collaboratorList
				)
			}
			
			const inputs = this.collabListDiv.querySelectorAll<HTMLInputElement>("input");
			if (inputs.length > 1) {
				// only have the remove button on rows after the first
				const removeButton = row.createEl("button");
				setIcon(removeButton, "circle-x")
				// removeButton.addClass("small-button")
				removeButton.addEventListener("click", () => {
					row.remove();
				})
			}
		}

		addButton.addEventListener("click", () => {
			addCollab();
			const inputs = this.collabListDiv.querySelectorAll<HTMLInputElement>("input");
			inputs[inputs.length - 1]?.focus()
		});

		addCollab();  // start with one field

	}

	buildButtons(parent: HTMLElement) {
		new Setting(parent)
			.addButton(button => {

				button
					.setButtonText("Create")
					.setCta()
					.onClick(async () => {
						// no blank name
						if (!this.projectName) {
							new Notice("Project name cannot be blank.");
							this.nameField.focus()
							return;
						}
						// check that client has been selected
						if (!this.selectedClient) {
							new Notice("Select a client.");
							this.clientField.focus()
							return;
						}
						const collaborators = Array.from(
							this.collabListDiv.querySelectorAll<HTMLInputElement>("input")
						)
							.map(input => input.value.trim())
							.filter(value => value.length > 0);
						// build the IssueData var to pass out
						const request: CreateProjectRequest = {
							name: this.projectName,
							client: this.selectedClient,
							collaborators: collaborators
						};

						await this.options.onSubmit(request);

						this.close();

					});

			})
			.addButton(button => {

				button
					.setButtonText("Cancel")
					.onClick(() => this.close());

			});
	}

}

