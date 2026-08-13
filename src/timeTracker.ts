import {
	App,
	Events,
	TFile
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	ProjectInfo,
	TimeSession,
	TimeSummary,
	ClientTimeSummary
} from "./types";


export class TimeTracker extends Events {

	constructor(
		private app: App,
		private projectManager: MyProjectManager,
		private getTimeLogPath: () => string
	) {
		super();
	}

	async startProjectSession(
		project: ProjectInfo,
		timestamp: Date = new Date(),
		additive: boolean = true
	): Promise<void> {
		/*
		- Get current timestamp
		- Check if there's an open project
			- if so, close it first with timestamp
		- Add entry to json file with project and timestamp
		*/
		const startTS = timestamp.toISOString();
		let sessions = await this.loadSessions();
		const activeSessions = this.findActiveSessions(sessions);
		if (!additive && activeSessions.length > 0) {
			// if additive is false, it means we want to close all active sessions before starting a new one
			sessions = this.stopSessions(sessions, startTS);
		}
		sessions.push({
			id: crypto.randomUUID(),
			projectPath: project.file.path,
			start: startTS,
			end: null
		});

		await this.saveSessions(sessions);

	}

	async stopProjectSession(
		project: ProjectInfo,
		timestamp: Date = new Date()
	): Promise<void> {
		/*
		- Get current timestamp
		- Check if there's an open project
			- if so, close it first with timestamp
		- Add entry to json file with project and timestamp
		*/
		const stopTS = timestamp.toISOString();
		let sessions = await this.loadSessions();
		const activeSessions = this.findActiveSessions(sessions);
		const projectSessions = activeSessions.filter(
			session => session.projectPath === project.file.path
		);
		if (projectSessions.length === 0) {
			return; // that project has no active sessions, so no need to do anything
		}

		sessions = this.stopSessions(sessions, stopTS, project.file.path);


		await this.saveSessions(sessions);

	}

	async stopAllSessions(
		timestamp: Date = new Date()
	): Promise<void> {

		const stopTS = timestamp.toISOString();
		let sessions = await this.loadSessions();
		const activeSessions = this.findActiveSessions(sessions);
		if (activeSessions.length === 0) {
			return;  // no active sessions at all, no need to do anything
		}
		sessions = this.stopSessions(sessions, stopTS);

		await this.saveSessions(sessions);

	}

	

	private stopSessions(
		sessions: TimeSession[],
		stopTime: string,
		projectPath: string | null = null
	): TimeSession[] {
		// if projectPath is null, then stop all running projects, otherwise just stop the ones for the specified project
		return sessions.map(session => {
			const stopBool =
				session.end === null &&
				(projectPath === null || session.projectPath === projectPath);

			if (stopBool) {
				return {
					...session,
					end: stopTime
				};
			}
			return session;
		});
	}

	private async loadSessions(): Promise<TimeSession[]> {
		const path = this.getTimeLogPath();
		const file = this.app.vault.getAbstractFileByPath(path);

		if (!(file instanceof TFile)) {
			return [];
		}

		const json = await this.app.vault.read(file);

		return JSON.parse(json) as TimeSession[];
	}

	private async saveSessions(
		sessions: TimeSession[]
	): Promise<void> {
		const path = this.getTimeLogPath();
		const file = this.app.vault.getAbstractFileByPath(path);
		//console.log(file);
		const timeData = JSON.stringify(sessions)

		if (file && (file instanceof TFile)) {
			// timeLog file exists, write to it
			await this.app.vault.modify(file, timeData);
		} else {
			await this.app.vault.create(path, timeData);
		}

		this.trigger("time-tracker-updated");  // trigger an update of displays related to time tracking

	}

	private findActiveSessions(
		sessions: TimeSession[]
	): TimeSession[] {
		return sessions.filter(s => s.end === null)  // return any sessions with an end of null, meaning they're open
	}


	async getActiveSessions(): Promise<TimeSession[]> {

		const sessions = await this.loadSessions();
		return this.findActiveSessions(sessions)
		
	}

	async getTimeSummary(
		rangeStart: Date,
		rangeEnd: Date
	): Promise<TimeSummary[]> {
		// Get summary of time worked between start and end for all projects
		
		const activeProjects = this.projectManager.getActiveProjects();

		// initialize the summary table
		const summaryArray = new Map<string, number>();

		// initialize the active project rows
		for (const project of activeProjects) {
			summaryArray.set(project.file.path, 0);
		}

		const sessions = await this.loadSessions();

		for (const session of sessions) {

			const rawStart = new Date(session.start);
			const rawEnd = session.end ? new Date(session.end) : new Date();

			const sessionStart = this.roundToNearest(rawStart, 15, true);
			const sessionEnd = session.end
				? this.roundToNearest(rawEnd, 15, false)
				: this.roundToNearest(rawEnd, 1, false);

			if ( sessionStart >= rangeEnd || sessionEnd <= rangeStart ) {
				continue;  // ignore any sessions that start after or end before the target range
			}

			if (
				session.end &&
				rawEnd.getTime() - rawStart.getTime() < 2 * 60 * 1000  // total time less than 2 minutes
			) {
				continue  // filter out sessions less than 2 minutes, which are most likely errors
			} 

			const effectiveStart =
				sessionStart > rangeStart ? sessionStart : rangeStart;

			const effectiveEnd =
				sessionEnd < rangeEnd ? sessionEnd : rangeEnd;

			const durationMinutes = Math.round(
				(effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60)
			);

			const currentTotal = summaryArray.get(session.projectPath) ?? 0;

			summaryArray.set(
				session.projectPath,
				currentTotal + durationMinutes
			);
		}

		const results: TimeSummary[] = [];

		for (const [projectPath, totalMinutes] of summaryArray) {
			results.push({
				projectPath,
				totalMinutes
			});
		}

		return results;

	}

	async getTimeSummaryByClient(
		rangeStart: Date,
		rangeEnd: Date
	): Promise<ClientTimeSummary[]> {
		// Get summary of time worked between start and end for all projects

		const projects = this.projectManager.getProjects();
		const clients = new Set(
			projects.map(project => project.client.replace(/^\[\[|\]\]$/g, ""))
		)
		const clientByProjectPath = new Map(
			projects.map(project => [
				project.file.path,
				project.client.replace(/^\[\[|\]\]$/g, "")
			])
		)

		// initialize the summary table
		const summaryArray = new Map<string, number>();

		// initialize the active project rows
		for (const client of clients) {
			summaryArray.set(client, 0);
		}

		const sessions = await this.loadSessions();

		for (const session of sessions) {

			const rawStart = new Date(session.start);
			const rawEnd = session.end ? new Date(session.end) : new Date();

			const sessionStart = this.roundToNearest(rawStart, 15, true);
			const sessionEnd = session.end
				? this.roundToNearest(rawEnd, 15, false)
				: this.roundToNearest(rawEnd, 1, false);

			if (sessionStart >= rangeEnd || sessionEnd <= rangeStart) {
				continue;  // ignore any sessions that start after or end before the target range
			}

			if (
				session.end &&
				rawEnd.getTime() - rawStart.getTime() < 2 * 60 * 1000  // total time less than 2 minutes
			) {
				continue  // filter out sessions less than 2 minutes, which are most likely errors
			}

			const effectiveStart =
				sessionStart > rangeStart ? sessionStart : rangeStart;

			const effectiveEnd =
				sessionEnd < rangeEnd ? sessionEnd : rangeEnd;

			const durationMinutes = Math.round(
				(effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60)
			);
			let currClient = clientByProjectPath.get(session.projectPath);
			if (!currClient) {
				currClient = '(none)';  // if no client entered, default to "none"
			}
			const currentTotal = summaryArray.get(currClient) ?? 0;

			summaryArray.set(
				currClient,
				currentTotal + durationMinutes
			);
		}

		const results: ClientTimeSummary[] = [];

		for (const [client, totalMinutes] of summaryArray) {
			results.push({
				client,
				totalMinutes
			});
		}

		return results;

	}

	private roundToNearest(date: Date, nearest: number = 15, start: boolean): Date {
		const msInterval = nearest * 60 * 1000; // 15 minutes in milliseconds
		if (start) {
			return new Date(Math.floor(date.getTime() / msInterval) * msInterval);
		} else {
			return new Date(Math.ceil(date.getTime() / msInterval) * msInterval);
		}
		
	}
	
}


