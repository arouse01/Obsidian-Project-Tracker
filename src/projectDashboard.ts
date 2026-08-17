import {
	ItemView,
	WorkspaceLeaf,
	ButtonComponent,
	TFile
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	IssueContext,
	ProjectInfo,
	IssueModalOptions,
	PRIORITIES
} from "./types";
import {
	formatTimestamp,
	formatMinutesToDuration,
	formatDate
} from './utils';
import { TimeTracker } from './timeTracker';
import { TimeModal } from './timeModal';
import IssueTracker from './issueTracker';
import { IssueModal } from './issueModal';

export class ProjectDashboardView extends ItemView {
	private summaryPeriod: "week" | "month" = "week";  // to drive the summary period selection
	private periodOffset = 0;  // to drive the summary period selection, how far in the past to go

	private projectStatusFilter: "Active" | "All" | "Archived" = "Active";  // to drive the summary period selection

	private projectTableBodyEl!: HTMLTableSectionElement;
	private summaryTableBodyEl!: HTMLTableSectionElement;
	private rangeText!: HTMLElement;

	private activeProjectFilterButton!: ButtonComponent;
	private allProjectFilterButton!: ButtonComponent;
	private archivedProjectFilterButton!: ButtonComponent;

	private refreshInterval: number | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private timeTracker: TimeTracker,
		private projectManager: MyProjectManager,
		private issueTracker: IssueTracker
	) {
		super(leaf);
	}

	getViewType(): string {
		return "project-dashboard";
	}

	getDisplayText(): string {
		return "Project Dashboard";
	}

	async onOpen(): Promise<void> {
		this.registerEvent(
			this.timeTracker.on("time-tracker-updated", () => {
				void this.updateDashboard()
			})
		);

		this.buildDashboard();
		await this.updateDashboard();

		this.refreshInterval = window.setInterval(() => {
			void this.updateDashboard();
		}, 60000);
	}

	async onClose(): Promise<void> {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	private buildDashboard() {

		const projectSection = this.contentEl.createEl("section");
		projectSection.addClass("project-section")
		projectSection.createEl("h3", {
			text: "Projects"
		});

		const controlSection = projectSection.createEl("section");
		controlSection.addClass('project-controls');
		this.activeProjectFilterButton = new ButtonComponent(controlSection)
			.setButtonText("Active")
			.setClass("project-dashboard-button")
			.onClick(async () => {
				this.projectStatusFilter = "Active";
				await this.updateProjects();
			});

		this.allProjectFilterButton = new ButtonComponent(controlSection)
			.setButtonText("All")
			.setClass("project-dashboard-button")
			.onClick(async () => {
				this.projectStatusFilter = "All";
				await this.updateProjects();
			});
		
		this.archivedProjectFilterButton = new ButtonComponent(controlSection)
			.setButtonText("Archived")
			.setClass("project-dashboard-button")
			.onClick(async () => {
				this.projectStatusFilter = "Archived";
				await this.updateProjects();
			});

		new ButtonComponent(controlSection)
			.setButtonText("New project...")
			.setClass("project-dashboard-button")
			.onClick(async () => {
				// TODO
				await this.createProject();
				await this.updateDashboard();
			});


		const projectTableSection = projectSection.createEl("section");
		projectTableSection.addClass('project-dashboard');

		const tableProjectEl = projectTableSection.createEl('table');
		tableProjectEl.addClass("project-table")
		const tableProjectHeaderEl = tableProjectEl.createEl('thead');
		const headerRow1 = tableProjectHeaderEl.createEl('tr');
		headerRow1.createEl('th', { text: '' })
		headerRow1.createEl('th', { text: 'Project',attr: { colspan: 2 } });
		headerRow1.createEl('th', { text: 'Hours worked', attr: { colspan: 2 } });
		headerRow1.createEl('th', { text: 'Session', attr: { colspan: 2 } }); 
		headerRow1.createEl('th', { text: 'Actions', attr: { colspan: 2 } }); 

		const headerRow2 = tableProjectHeaderEl.createEl('tr');
		headerRow2.createEl('th', { text: 'Status' });
		headerRow2.createEl('th', { text: 'Project' });
		headerRow2.createEl('th', { text: 'Client' });
		headerRow2.createEl('th', { text: 'Today' });
		headerRow2.createEl('th', { text: 'This week' });
		headerRow2.createEl('th', { text: '' }); // Start session
		headerRow2.createEl('th', { text: '' }); // Start at
		headerRow2.createEl('th', { text: '' }); // Meeting
		headerRow2.createEl('th', { text: '' }); // Issue

		
		this.projectTableBodyEl = tableProjectEl.createEl('tbody');



		const summarySection = this.contentEl.createEl("section");
		summarySection.createEl("h3", {
			text: "Statistics"
		});

		summarySection.addClass('project-dashboard')

		const summaryControlsTop = summarySection.createDiv();
		summaryControlsTop.addClass('summary-controls')

		summaryControlsTop.createEl('label', {
			text: 'Summarize by:',
			attr: { for: 'period-selector' }
		});
		const periodSelect = summaryControlsTop.createEl('select', {
			cls: 'summary-period-select',
			attr: { id: 'period-selector' }
		});
		periodSelect.createEl('option', {
			value: 'week',
			text: "Week"
		});
		periodSelect.createEl('option', {
			value: 'month',
			text: "Month"
		});
		periodSelect.value = this.summaryPeriod;

		periodSelect.addEventListener("change", () => {
			const value = periodSelect.value;

			if (value === "week" || value === "month") {
				this.summaryPeriod = value;
				void this.updateSummary();
			}
		});

		const summaryControlsBottom = summarySection.createDiv();
		summaryControlsBottom.addClass('summary-controls')
		new ButtonComponent(summaryControlsBottom)
			.setButtonText("⏴")
			.setClass("arrow-button")
			.onClick(async () => {
				this.periodOffset--;
				await this.updateSummary();
			});
		const { start, end } = this.getSummaryPeriod();

		let dateRangeText: string;
		if (this.summaryPeriod === "week") {
			dateRangeText = `${window.moment(start).format("MMM DD")} - ${window.moment(end).format("MMM DD")}`
		} else {
			dateRangeText = window.moment(start).format("MMMM YYYY")
		}
		this.rangeText = summaryControlsBottom.createSpan({
			text: dateRangeText,
			cls: "fixed-width-date-range"
		})

		new ButtonComponent(summaryControlsBottom)
			.setButtonText("⏵")
			.setClass("arrow-button")
			.onClick(async () => {
				this.periodOffset++;
				await this.updateSummary();
			})

		new ButtonComponent(summaryControlsBottom)
			.setButtonText("Now")
			.onClick(async () => {
				this.periodOffset = 0;
				await this.updateSummary();
			})

		// select.style.width = "100%";

		const sectionSummaryTableEl = summarySection.createEl('section');
		sectionSummaryTableEl.addClass('project-dashboard');
		const tableSummaryEl = sectionSummaryTableEl.createEl('table');
		tableSummaryEl.addClass('project-table')
		const tableSummaryHeaderEl = tableSummaryEl.createEl('thead');
		const headerSummaryRowEl = tableSummaryHeaderEl.createEl('tr');
		headerSummaryRowEl.createEl('th', { text: 'Project' });
		headerSummaryRowEl.createEl('th', { text: 'Time' });

		this.summaryTableBodyEl = tableSummaryEl.createEl('tbody');
	}

	private updateFilterButtons(): void {
		this.activeProjectFilterButton.buttonEl.toggleClass(
			"button-selected",
			this.projectStatusFilter === "Active"
		)
		this.allProjectFilterButton.buttonEl.toggleClass(
			"button-selected",
			this.projectStatusFilter === "All"
		)
		this.archivedProjectFilterButton.buttonEl.toggleClass(
			"button-selected",
			this.projectStatusFilter === "Archived"
		)
	}

	async updateDashboard(): Promise<void> {
		await this.updateProjects();
		await this.updateSummary();
	}

	async updateProjects(): Promise<void> {
		this.updateFilterButtons();

		let projects: ProjectInfo[];
		if (this.projectStatusFilter === "Active") {
			projects = this.projectManager.getActiveProjects();
		} else if (this.projectStatusFilter === "Archived") {
			projects = this.projectManager.getArchivedProjects();
		} else {
			projects = this.projectManager.getProjects();
		}
		
		const activeSessions = await this.timeTracker.getActiveSessions();
		const activeSessionMap = new Map(
			activeSessions.map(session => [session.projectPath, session])
		);
		const newBody = createEl('tbody'); // new object to store table before moving it entirely into the window so there's no flicker as the table is rebuilt

		const weekStart = window.moment()
			.startOf("week")
			.toDate();
		const weekEnd = window.moment()
			.endOf("week")
			.toDate();
		const weekSummaryTotals = await this.timeTracker.getTimeSummary(weekStart, weekEnd);
		const weekTimeSumByPath = new Map(
			weekSummaryTotals.map(summary => [summary.projectPath, summary])
		)
		const dayStart = window.moment()
			.startOf("day")
			.toDate();
		const dayEnd = window.moment()
			.endOf("day")
			.toDate();
		const daySummaryTotals = await this.timeTracker.getTimeSummary(dayStart, dayEnd);
		const dayTimeSumByPath = new Map(
			daySummaryTotals.map(summary => [summary.projectPath, summary])
		)
		for (const project of projects) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			const row = newBody.createEl('tr');

			const statusCell = row.createEl('td');
			const projectCell = row.createEl('td');
			const clientCell = row.createEl('td');
			const dailyHoursCell = row.createEl('td');
			const weeklyHoursCell = row.createEl('td');
			
			const startCell = row.createEl('td');
			const startAtCell = row.createEl('td');
			const meetingCell = row.createEl('td');
			const issueCell = row.createEl('td');

			statusCell.addClass("time-dashboard-centered");
			const activeSession = activeSessionMap.get(project.file.path);
			// const isActive = activePaths.has(project.file.path);
			if (activeSession) {
				statusCell.setText("🟢");  //⏲
			} else {
				statusCell.setText("");
			}

			// projectCell.setText(project.name);
			const projectLink = projectCell.createEl("a", { text: project.name });
			projectLink.addEventListener("click", (event) => {
				event.preventDefault();
				const existingLeaf = this.app.workspace.getLeavesOfType(
					"markdown"
				).find(leaf => {
					const view = leaf.view;
					return view.getState().file === project.file.path;
				});

				if (existingLeaf) {
					void this.app.workspace.revealLeaf(existingLeaf);
				} else {
					void this.app.workspace.getLeaf(false).openFile(project.file);
				}
			}
			)

			const file = this.app.vault.getAbstractFileByPath(project.file.path);
			let client: string = '';
			if (file instanceof TFile) {
				client = this.projectManager.getFrontmatterString(file, "Primary").replace(/^\[\[|\]\]$/g, "")
			}
			clientCell.setText(client);

			const dailyTimeSum = dayTimeSumByPath.get(project.file.path);
			const dailyTimeText = formatMinutesToDuration(dailyTimeSum?.totalMinutes ?? 0);
			dailyHoursCell.setText(dailyTimeText);

			const weekTimeSum = weekTimeSumByPath.get(project.file.path);
			const weekTimeText = formatMinutesToDuration(weekTimeSum?.totalMinutes ?? 0);
			weeklyHoursCell.setText(weekTimeText);
			

			startCell.addClass("time-dashboard-centered");
			new ButtonComponent(startCell)
				.setButtonText(activeSession ? "Stop" : "Start")
				.setClass("project-dashboard-button")
				.onClick(async () => {
					if (activeSession) {
						await this.timeTracker.stopProjectSession(project)
					} else {
						await this.timeTracker.startProjectSession(project)
					}
				})

			new ButtonComponent(startAtCell)
				.setButtonText(activeSession ? "Stop at" : "Start at")
				.setClass("project-dashboard-button")
				.onClick(async () => {
					if (activeSession) {
						new TimeModal(this.app, {
							mode: 'stop',
							projectPath: project.file.path,
							sessionStart: activeSession.start,
							onSubmit: async (timestamp: Date) => {
								await this.timeTracker.stopProjectSession(
									project,
									timestamp
								);
							}
						}).open();
					} else {
						new TimeModal(this.app, {
							mode: 'start',
							projectPath: project.file.path,
							onSubmit: async (timestamp: Date) => {
								await this.timeTracker.startProjectSession(
									project,
									timestamp
								);
							}
						}).open();
					}

				})

			new ButtonComponent(meetingCell)
				.setButtonText("New meeting")
				.setClass("project-dashboard-button")
				.onClick(async () => {
					await this.createMeeting(project)
				})

			new ButtonComponent(issueCell)
				.setButtonText("New issue")
				.setClass("project-dashboard-button")
				.onClick(async () => {
					const tempTitle = "";
					const lines = "";
					const sourceFile = project.file;

					// get the project of the current document and its actual file location, if any
					const projectNames = [project.name];
					const projectPaths = [project.file.path];

					/*
					let projectPath: string | null = null;

					if (projectName !== "") {

						const file =
							this.app.metadataCache.getFirstLinkpathDest(
								projectName,
								sourceFile.path
							);

						projectPath = file?.path ?? null;
					}
					*/

					const context: IssueContext = {
						tempTitle: tempTitle,
						selectedText: lines,
						sourceFile: sourceFile,
						line: null,
						projectPaths: projectPaths,
						projectNames: projectNames

					}

					// const selectedText = editor.getLine(editor.getCursor().line);
					const allProjects = this.projectManager.getActiveProjects();
					const currProjectSet = new Set(projectNames);
					const sortedProjects = [...allProjects].sort((a, b) => {
						const aSource = currProjectSet.has(a.file.path);
						const bSource = currProjectSet.has(b.file.path);
						if (aSource !== bSource) {
							return aSource ? -1 : 1;
						}

						return a.name.localeCompare(b.name);
					})

					const options: IssueModalOptions = {
						context: context,
						projects: sortedProjects,
						priorities: PRIORITIES,
						onSubmit: async (request) => {
							const newFile = await this.issueTracker.createIssue(request);
							await this.app.workspace.getLeaf(false).openFile(newFile);
						}

					}
					new IssueModal(
						this.app,
						options
					).open();
				})
		}
		// this.projectTableBodyEl.empty();


		this.projectTableBodyEl.replaceWith(newBody);
		this.projectTableBodyEl = newBody;

	}

	async updateSummary(): Promise<void> {
		
		const { start, end } = this.getSummaryPeriod();

		let dateRangeText: string;
		if (this.summaryPeriod === "week") {
			dateRangeText = `${window.moment(start).format("MMM DD")} - ${window.moment(end).format("MMM DD")}`
		} else {
			dateRangeText = window.moment(start).format("MMMM YYYY")
		}
		this.rangeText.setText(dateRangeText);

		// create temporary body for table, then fill it and swap for the current one instead of clearing the whole thing
		const newBody2 = createEl('tbody')

		const summaryTotals = await this.timeTracker.getTimeSummaryByClient(start, end);
		/*
			summaryTotals are returned as array of TimeSummary objects 
			which is projectPath (string) and totalMinutes (number), so 
			we have to loop through and assign to the table
		*/
		for (const timeSum of summaryTotals) {

			// create row skeleton, and assign values to objects after (for cleaner visual code organization)
			const row = newBody2.createEl('tr');

			const clientCell = row.createEl('td');
			const totalCell = row.createEl('td');

			const clientName = timeSum.client;
			clientCell.setText(clientName);
			
			const durationText = formatMinutesToDuration(timeSum.totalMinutes);
			totalCell.setText(durationText)

		}
		// this.summaryTableBodyEl.empty();
		this.summaryTableBodyEl.replaceWith(newBody2);
		this.summaryTableBodyEl = newBody2;
	}

	async createMeeting(
		project: ProjectInfo
	): Promise<void> {
		let newFile: TFile;

		const currDate = formatDate();
		const projectName = project.name;
		const meetingTitle = `${currDate} ${projectName} Meeting`

		const filename = `${meetingTitle}`
		const path = `Meeting Notes/${filename}.md`
		const creationTS = formatTimestamp();
		const content =
			`---
project: "[[${projectName}]]"
topic: 
date: "${creationTS}"
people:
- 
tags:
- meeting
---

# ${filename}



`;

		newFile = await this.app.vault.create(path, content);

		await this.app.workspace.getLeaf(false).openFile(newFile);

	}

	async createProject(): Promise<void> {


	}

	private getSummaryPeriod(): { start: Date; end: Date } {
		const start = window.moment()
			.add(this.periodOffset, this.summaryPeriod)
			.startOf(this.summaryPeriod)
			.toDate();

		const end = window.moment()
			.add(this.periodOffset, this.summaryPeriod)
			.endOf(this.summaryPeriod)
			.toDate();

		return { start, end };
	}

}

