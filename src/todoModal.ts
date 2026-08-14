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
	SessionAction,
	SessionContext,
	TodoData,
	TodoModalOptions,
	CreateTodoRequest
} from "./types";


export class TodoModal extends Modal {
	private name = "";
	private selectedProject: ProjectInfo | null = null;
	private priority: number;
	private dueDate!: Date;


	constructor(
		app: App,
		private options: TodoModalOptions,

	) {
		super(app);

		// set the initial values for the items returned at the end
		this.name = options.context.tempTitle;
		this.priority = 0;


	}

	onOpen() {
		const { contentEl } = this;

		// this.setTitle('Create Issue');
		contentEl.empty();

		const form = contentEl.createDiv({ cls: "issue-form" });

		/*
		Name
		Project
		Priority
		Date Added
		Due Date
		buttons
		*/
		this.buildTitleField(form);
		this.buildProjectDropdown(form);
		this.buildPriorityDropdown(form);
		this.buildDateFields(form);
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
		input.value = this.name;
		input.addEventListener("input", () => {
			this.name = input.value;
		});

		
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
		
	}


	buildDateFields(parent: HTMLElement): void {

		parent.createEl("label", {
			text: "Due date (optional)"
		});

		const dueDateInput = parent.createEl("input", {
			type: "datetime-local"
		});

		// this.dueDate = new Date();

		// dueDateInput.value = this.getDateTimeLocalValue(this.dueDate);
		dueDateInput.addEventListener("change", () => {
			this.dueDate = new Date(dueDateInput.value);
		})
		

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
						
						// build the TodoData var to pass out
						const request: CreateTodoRequest = {
							todoInfo: {
								name: this.name,
								dueDate: this.dueDate?.toISOString(),
								project: this.selectedProject,
								priority: this.priority
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

	private getDateTimeLocalValue(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");

		return `${year}-${month}-${day}T${hours}:${minutes}`;
	}

	

}
