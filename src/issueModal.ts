import {
	App,
	// MarkdownView,
	// MarkdownFileInfo,
	// CachedMetadata,
	Modal,
	Notice,
	Setting,
	TFile
} from 'obsidian';
import {
	ProjectInfo,
	CreateIssueRequest,
	IssueModalOptions
} from "./types";

export class IssueModal extends Modal {
	private title = "";
	private description: string;
	private selectedProject: ProjectInfo | null = null;
	private priority: number;
	private source: TFile;


	// onSubmit: (data: IssueData) => void;

	constructor(
		app: App,
		private options: IssueModalOptions

	) {
		super(app);

		// set the initial values for the items returned at the end
		this.title = options.context.tempTitle;
		this.description = options.context.selectedText;
		this.priority = 0;
		this.source = options.context.sourceFile;

		// this.selectedProject = this.options.projects.find(
		// 		p => p.file.path === options.context.projectPaths
		// 	) ?? null;
		// if (this.selectedProject === null) {
		// 	this.selectedProject = options.projects[0] ?? null;
		// }


	}

	onOpen() {
		const { contentEl } = this;

		// this.setTitle('Create Issue');
		contentEl.empty();

		contentEl.createEl("h2", {
			text: "Create new issue"
		});

		const form = contentEl.createDiv({ cls: "issue-form" });
		this.buildTitleField(form);
		this.buildProjectDropdown(form);
		this.buildDescriptionField(form);
		this.buildPriorityDropdown(form);
		this.buildButtons(form);


	}

	onClose() {
		// const { contentEl } = this;
		this.contentEl.empty();
	}

	buildTitleField(parent: HTMLElement): void {
		parent.createEl("label", {
			text: "Title"
		});
		const input = parent.createEl("input", {
			type: "text"
		});
		// input.style.width = "100%";
		input.value = this.title;
		input.addEventListener("input", () => {
			this.title = input.value;
		});

		/*
		new Setting(parent)
			.setName("Title")
			.addText(text => {
				text.setValue(this.title);
				text.onChange(value => {
					this.title = value;
				});
			});
		*/
	}

	buildProjectDropdown(parent: HTMLElement) {
		parent.createEl("label", {
			text: "Project"
		});
		const select = parent.createEl("select");
		const relatedGroup = select.createEl("optgroup", {
			attr: { label: "Related Projects" }
		});
		const otherGroup = select.createEl("optgroup", {
			attr: { label: "Other Active Projects" }
		});
		const relatedPaths = new Set(this.options.context.projectPaths);
		const relatedProjects = this.options.projects.filter(project =>
			relatedPaths.has(project.file.path)
		);
		const otherProjects = this.options.projects.filter(project =>
			!relatedPaths.has(project.file.path)
		);
		for (const project of relatedProjects) {
			const option = relatedGroup.createEl("option");
			option.value = project.file.path;
			option.text = project.name;
		}

		for (const project of otherProjects) {
			const option = otherGroup.createEl("option");
			option.value = project.file.path;
			option.text = project.name;
		}
		// 

		// for (const project of this.options.projects) {
		// 	const group = relatedPaths.has(project.file.path)
		// 		? relatedGroup
		// 		: otherGroup;

		// 	const option = group.createEl("option");

		// 	option.value = project.file.path;
		// 	option.text = project.name;
		// }


		if (relatedProjects.length > 0) {
			this.selectedProject = relatedProjects[0]!;
		} else {
			this.selectedProject = otherProjects[0] ?? null;
		}
		if (this.selectedProject) {
			select.value = this.selectedProject.file.path;
		}
		select.addEventListener("change", () => {

			this.selectedProject =
				this.options.projects.find(
					p => p.file.path === select.value
				) ?? null;

		});
		/*
		new Setting(parent)
			.setName("Project")
			.addDropdown(dropdown => {
				// assign the values to the dropdown
				this.options.projects.forEach((project, index) => {
					dropdown.addOption(index.toString(),
						project.name
					);
				});
				// select the default value
				if (this.options.projects.length > 0) {
					dropdown.setValue("0");
					this.selectedProject = this.options.projects[0] ?? null;
				}

				// Update the selectedProject var if dropdown is changed
				dropdown.onChange(value => {
					const index = Number(value);
					this.selectedProject = this.options.projects[index] ?? null;
				});
			});
			*/
	}

	buildDescriptionField(parent: HTMLElement) {
		parent.createEl("label", {
			text: "Description"
		});
		const textarea = parent.createEl("textarea");
		// textarea.style.width = "100%";
		textarea.rows = 8;
		textarea.value = this.description;

		textarea.addEventListener("input", () => {
			this.description = textarea.value;
		});
		// new Setting(parent)
		// 	.setName("Description")
		// 	.addTextArea(text => {
		// 		text.inputEl.style.width = "100%";
		// 		text
		// 			.setValue(this.description)
		// 			.onChange(value => {
		// 				this.description = value;
		// 		});
		// 	});
	}

	buildPriorityDropdown(parent: HTMLElement) {
		parent.createEl("label", {
			text: "Priority"
		});
		const select = parent.createEl("select");
		// select.style.width = "100%";
		for (const priority of this.options.priorities) {
			const option = select.createEl("option");

			option.value = priority.value.toString();
			option.text = priority.label;
		}


		select.value = "0";


		select.addEventListener("change", () => {
			this.priority = Number(select.value);

		});
		/*
		new Setting(parent)
			.setName("Priority")
			.addDropdown(dropdown => {
				// assign the values to the dropdown
				this.options.priorities.forEach(priority => {
					dropdown.addOption(priority.value.toString(),
						priority.label
					);
				});
				
				// select the default value
				dropdown.setValue("0");
					

				// Update the selectedProject var if dropdown is changed
				dropdown.onChange(value => {
					
					this.priority = Number(value);
				});
			});
			*/
	}

	buildButtons(parent: HTMLElement) {
		new Setting(parent)
			.addButton(button => {

				button
					.setButtonText("Create")
					.setCta()
					.onClick(async () => {

						// check that project has been selected
						if (!this.selectedProject) {
							new Notice("Select a project.");
							return;
						}

						// build the IssueData var to pass out
						const request: CreateIssueRequest = {
							issue: {
								title: this.title,
								project: this.selectedProject,
								description: this.description,
								priority: this.priority,
								sourceFile: this.source
							},
							context: this.options.context

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

