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
	CreateTodoRequest,
	TodoItem
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
	// only for editing
	private status: boolean = false;
	private dateAdded!: string;
	private completedTS: string | undefined;


	constructor(
		app: App,
		private options: TodoModalOptions,

	) {
		super(app);

		// set the initial values for the items returned at the end
		
		if (options.mode === "edit") {
			this.name = options.todo.name;
			this.notes = options.todo.notes ?? "";
			this.dateAdded = options.todo.dateAdded;
			this.priority = options.todo.priority;
			if (options.todo.dueDate) { this.dueDate = new Date(options.todo.dueDate) }

			// this.selectedProject = options.todo.projectPath ?? null;
			/* We never explicitly set `this.selectedProject` because as part of the project dropdown creation,
			the TodoItem's projectPath is set as the lone related project path, which sets it at the top of the dropdown,
			and then this.selectedProject is set to item 0 of the field. Indirect, so probably not the most ideal, but it works */
			
			this.status = options.todo.status;
			
			this.completedTS = options.todo.completedTS

		} else {
			this.name = options.context.tempTitle;
			this.priority = 0;
		}

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
		if (this.options.mode === "edit") {
			this.buildIDField(form)
		}
		this.buildTitleField(form);
		this.buildNotesField(form);
		this.buildProjectDropdown(form);
		this.buildPriorityDropdown(form);
		this.buildDateFields(form);
		this.buildStatusField(form);
		this.buildButtons(form);


	}

	onClose() {
		// const { contentEl } = this;
		this.contentEl.empty();
	}

	buildIDField(parent: HTMLElement): void {

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
		const select = parent.createEl("select");

		// Create the dropdown options

		// add a 'none' option in case the todo doesn't have a specific project
		const option = select.createEl("option");
		option.value = "None";
		option.text = "None";

		// fill the rest of the options
		let relatedPaths: Set<string>
		if (this.options.mode === "create") {
			relatedPaths = new Set(this.options.context.projectPaths);
		} else {
			relatedPaths = new Set(
				this.options.todo.projectPath !== undefined
					? [this.options.todo.projectPath]
					: []
			);
		}
		// relatedPaths only has a value 
		// if (this.options.mode === "edit") {

		// }
		
		
		const relatedProjects = this.options.projects.filter(project =>
			relatedPaths.has(project.file.path)
		);
		const otherProjects = this.options.projects.filter(project =>
			!relatedPaths.has(project.file.path)
		);

		

		if (relatedProjects.length > 0) {
			// either there are related projects in create mode, or a project for the todo in edit mode
			const relatedLabel = (this.options.mode === "create") ? "Related projects" : "Selected project"
			const relatedGroup = select.createEl("optgroup", {
				attr: { label: relatedLabel }
			});

			for (const project of relatedProjects) {
				const option = relatedGroup.createEl("option");
				option.value = project.file.path;
				option.text = project.name;
			}
			// either way, set the variable to the provided project
			this.selectedProject = relatedProjects[0]!;
		}

		// add the rest of the projects as options
		const generalGroup = select.createEl("optgroup", {
			attr: { label: "Active Projects" }
		});

		for (const project of otherProjects) {
			const option = generalGroup.createEl("option");
			option.value = project.file.path;
			option.text = project.name;
		}

		if (this.selectedProject) {
			/* this.selectedProject was defined while creating the groups, so update the select field to reflect the current value */
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

		dueDateInput.addEventListener("change", updateDueDate);
		dueTimeInput.addEventListener("change", updateDueDate);

		/*if (this.options.mode === "edit") {
			const completedDateRow = parent.createDiv({ cls: "timestamp-row" });
			completedDateRow.createEl("label", {
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

			dueDateInput.addEventListener("change", updateDueDate);
			dueTimeInput.addEventListener("change", updateDueDate);
		}*/

	}

	buildStatusField(parent: HTMLElement): void {

	}

	buildButtons(parent: HTMLElement) {
		new Setting(parent)
			.addButton(button => {

				button
					.setButtonText(this.options.mode === "create" ? "Create" : "Save")
					.setCta()
					.onClick(async () => {
						
						// check that project has been selected
						// if (!this.selectedProject) {
						// 	this.selectedProject = undefined
						// }
						const dueDate = (this.dueDate !== undefined) ? formatDate(this.dueDate) : undefined;
						if (this.options.mode === "create") {
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

							
						} else {
							const updatedTodo: TodoItem = {
								id: this.options.todo.id,
								name: this.name,
								notes: this.notes,
								dateAdded: this.dateAdded,
								priority: this.priority,
								projectPath: this.selectedProject?.file.path,
								status: this.status,
								completedTS: this.completedTS
								

							}
							await this.options.onSubmit(updatedTodo);
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

	

}
