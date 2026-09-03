import {
	App,
	// MarkdownView,
	// MarkdownFileInfo,
	// CachedMetadata,
	Modal,
	Setting
} from 'obsidian';
import {
	ProjectInfo,
	TodoModalOptions,
	CreateTodoRequest
} from "./types";
import {
	formatDate
} from './utils'


export class TodoModal extends Modal {
	private name = "";
	private notes = "";
	private selectedProject: ProjectInfo | null = null;
	private priority: number;
	private dueDate: Date | undefined;


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
		this.buildNotesField(form);
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

	buildNotesField(parent: HTMLElement): void {
		parent.createEl("label", {
			text: "Notes (optional)"
		});


		const input = parent.createEl("textarea");
		input.rows = 8;

		input.value = this.notes;
		input.addEventListener("input", () => {
			this.notes = input.value;
		});


	}

	buildProjectDropdown(parent: HTMLElement) {
		parent.createEl("label", {
			text: "Project"
		});
		
		const relatedPaths = new Set(this.options.context.projectPaths);
		const relatedProjects = this.options.projects.filter(project =>
			relatedPaths.has(project.file.path)
		);
		const otherProjects = this.options.projects.filter(project =>
			!relatedPaths.has(project.file.path)
		);

		const select = parent.createEl("select");

		if (relatedProjects.length > 0) {
			const relatedGroup = select.createEl("optgroup", {
				attr: { label: "Related Projects" }
			});
			const otherGroup = select.createEl("optgroup", {
				attr: { label: "Other Active Projects" }
			});

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

			this.selectedProject = relatedProjects[0]!;

		} else {
			const generalGroup = select.createEl("optgroup", {
				attr: { label: "Projects" }
			});
			// add a 'none' option in case the todo doesn't have a specific project
			const option = generalGroup.createEl("option");
			option.value = "None";
			option.text = "None";

			for (const project of otherProjects) {
				const option = generalGroup.createEl("option");
				option.value = project.file.path;
				option.text = project.name;
			}

			this.selectedProject = null;

		}


		if (this.selectedProject) {
			select.value = this.selectedProject.file.path;
		} else {
			select.value = "None"
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
		const dueDateRow = parent.createDiv({ cls: "timestamp-row" });
		dueDateRow.createEl("label", {
			text: "Due date (optional)"
		});

		const dueDateInput = dueDateRow.createEl("input", {
			type: "date"
		});
		const dueTimeInput = dueDateRow.createEl("input", {
			type: "time",
			placeholder: "(Time)"
		});
		const updateDueDate = () => {
			if (!dueDateInput.value) {
				this.dueDate = undefined;
				return;
			}

			if (dueTimeInput.value) {
				// time has been entered, build timestamp with time
				this.dueDate = new Date(
					`${dueDateInput.value}T${dueTimeInput.value}`
				);
			} else {
				this.dueDate = new Date(
					`${dueDateInput.value}T00:00`
				);
			}
		}

		// dueDateInput.value = this.getDateTimeLocalValue(this.dueDate);
		dueDateInput.addEventListener("change", updateDueDate);
		dueTimeInput.addEventListener("change", updateDueDate);

	}

	buildButtons(parent: HTMLElement) {
		new Setting(parent)
			.addButton(button => {

				button
					.setButtonText("Create")
					.setCta()
					.onClick(async () => {

						// check that project has been selected
						// if (!this.selectedProject) {
						// 	this.selectedProject = undefined
						// }
						const dueDate = (this.dueDate !== undefined) ? formatDate(this.dueDate) : undefined;
						// build the TodoData var to pass out
						const request: CreateTodoRequest = {
							todoInfo: {
								name: this.name,
								notes: this.notes,
								dueDate: dueDate,
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

	

}
