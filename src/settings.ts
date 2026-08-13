import { App, PluginSettingTab, Setting } from 'obsidian';
import ProjectTrackerPlugin from './main';

export interface IssueTrackerSettings {
	nextIssueID: number;
	timeLogPath: string;
}

export const DEFAULT_SETTINGS: IssueTrackerSettings = {
	nextIssueID: 1,
	timeLogPath: 'Project Management/timeLog.json'
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
		/*
		parent.createEl("label", {
			text: "Next serial number"
		});
		const input = parent.createEl("input", {
			type: "text"
		});
		input.set
		// input.style.width = "100%";
		input.value = this.plugin.settings.nextIssueID.toString();
		input.addEventListener("input", () => {
			this.plugin.settings.timeLogPath = input.value;
			this.plugin.saveSettings();
		});*/

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

}
