import { App, PluginSettingTab, Setting } from 'obsidian';
import ProjectTrackerPlugin from './main';

export interface IssueTrackerSettings {
	nextIssueID: number;
	timeLogPath: string;
	todoLogPath: string;
}

export const DEFAULT_SETTINGS: IssueTrackerSettings = {
	nextIssueID: 1,
	timeLogPath: 'Project Management/timeLog.json',
	todoLogPath: 'Project Management/todoList.json'
};

export class IssueTrackerSettingTab extends PluginSettingTab {
	plugin: ProjectTrackerPlugin;

	constructor(app: App, plugin: ProjectTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		// const form = contentEl.createDiv({ cls: "issue-form" });
		this.buildSerialField(containerEl);
		this.buildTimeLogField(containerEl);
		this.buildTodoLogField(containerEl);

	}

	buildSerialField(parent: HTMLElement): void {
		new Setting(parent)
			.setName('Next serial number')
			.setDesc('Serial number for next issue created')
			.addText((text) =>
				text
					// .setPlaceholder('Enter your secret')
					.setValue(this.plugin.settings.nextIssueID.toString())
					.onChange(async (value) => {
						const id = Number(value);
						if (!isNaN(id)) {
							this.plugin.settings.nextIssueID = id;
							await this.plugin.saveSettings();
						}

					}),
			);

	}

	buildTimeLogField(parent: HTMLElement): void {
		new Setting(parent)
			.setName('Time log path')
			.setDesc('Path to the JSON time log file')
			.addText(text =>
				text.setValue(this.plugin.settings.timeLogPath)
					.onChange(async (value) => {
						this.plugin.settings.timeLogPath = value;
						await this.plugin.saveSettings();
					})
					.inputEl.addClass('wide-setting-input')
			);
	}

	buildTodoLogField(parent: HTMLElement): void {
		new Setting(parent)
			.setName('Todo log path')
			.setDesc('Path to the JSON todo list file')
			.addText(text =>
				text.setValue(this.plugin.settings.todoLogPath)
					.onChange(async (value) => {
						this.plugin.settings.todoLogPath = value;
						await this.plugin.saveSettings();
					})
					.inputEl.addClass('wide-setting-input')
			);
	}
}
