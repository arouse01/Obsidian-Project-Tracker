import {
	App,
	Events,
	TFile
} from 'obsidian';
import { MyProjectManager } from './projectManager';
import {
	ProjectInfo,
	RawTimeSession,
	TimeSummary,
	TimeSummaryStore,
	PeriodicTimeSummary,
	SessionData,
	DateKey,
	SummarySession
} from "./types";
import {
	formatDate,
	getDateKey,
	dateKeyToDate
} from './utils'
import { SummaryGroup } from './tableFunctions';


export class TimeTracker extends Events {

	constructor(
		private app: App,
		private projectManager: MyProjectManager,
		private getTimeLogPath: () => string
	) {
		super();
	}

	private _parseSessionfromRaw(data: RawTimeSession): SessionData {
		const startTS = new Date(data.start);
		const endTS = data.end ? new Date(data.end) : null;

		return {
			id: data.id,
			projectPath: data.projectPath,
			start: startTS,
			end: endTS,
			active: endTS === null
		}
	}

	private _sessionDataToRaw(data: SessionData): RawTimeSession {
		const startString = data.start.toISOString();
		const endString = data.end ? data.end.toISOString() : null;

		return {
			id: data.id,
			projectPath: data.projectPath,
			start: startString,
			end: endString
		}
	}

	private async _loadSessions(): Promise<SessionData[]> {
		const path = this.getTimeLogPath();
		const file = this.app.vault.getAbstractFileByPath(path);

		if (!(file instanceof TFile)) {
			return [];
		}

		const json = await this.app.vault.read(file);

		const rawSessions = JSON.parse(json) as RawTimeSession[];

		const sessions = rawSessions.map(rawSession => this._parseSessionfromRaw(rawSession))

		return sessions;
	}

	

	private async _saveSessions(
		sessions: SessionData[]
	): Promise<void> {
		const path = this.getTimeLogPath();
		const file = this.app.vault.getAbstractFileByPath(path);
		//console.log(file);
		const rawSessions = sessions.map(formattedSession => this._sessionDataToRaw(formattedSession))
		const timeData = JSON.stringify(rawSessions)

		if (file && (file instanceof TFile)) {
			// timeLog file exists, write to it
			await this.app.vault.modify(file, timeData);
		} else {
			await this.app.vault.create(path, timeData);
		}

		this.trigger("time-tracker-updated");  // trigger an update of displays related to time tracking

	}

	private _getSummarySessionsInRange(
		sessions: SessionData[],
		rangeStart: Date,
		rangeEnd: Date,
		minDuration: number = 2 * 60 * 1000
	): SummarySession[] {
		// filters whole session array to just those that overlap
		// for active sessions, get the endDate placeholder once at the beginning rather than risk different end timestamps as the function processes the data
		const now = new Date(); 

		return sessions.flatMap(session => {
			const rawEnd = session.end ?? now;

			// minimum duration test but using original timestamps, not rounded ones
			const duration = rawEnd.getTime() - session.start.getTime()
			if (!session.active && duration < minDuration) {
				return [];
			}
			const endNearest = session.end ? 15 : 1;  // for sessions still running, set end time to now rounded to nearest whole minute
			const [startTime, endTime] = this.roundSessionTimes(session.start, 15, rawEnd, endNearest);

			if (
				startTime >= rangeEnd ||
				endTime <= rangeStart
			) {
				return [];
			};

			return [{
				session,
				startTime,
				endTime
			}]
		})
		
	}

	private _findActiveSessions(
		sessions: SessionData[]
	): SessionData[] {
		return sessions.filter(s => s.active)  // return any sessions with an end of null, meaning they're open
	}

	private _stopSessions(
		sessions: SessionData[],
		stopTime: Date,
		projectPath: string | undefined = undefined
	): SessionData[] {
		// if projectPath is null, then stop all running projects, otherwise just stop the ones for the specified project

		return sessions.map(session => {

			const projMatch =
				projectPath === undefined ||
				session.projectPath === projectPath;

			if (projMatch && session.end === null) {
				return {
					...session,
					end: stopTime,
					active: false
				};
			}

			return session;

		});
	}

	private _getSummaryTotalsForDates(
		entries: Map<string, Map<DateKey, number>>,
		dates: Iterable<DateKey>
	): Map<string, number> {
		const totals = new Map<string, number>();

		for (const [key, dailyTotals] of entries) {
			let total = 0;

			for (const date of dates) {
				total += dailyTotals.get(date) ?? 0;
			}

			if (total > 0) {
				totals.set(key, total);
			}
		}

		return totals;

	}

	private _getCurrentWeekDates(
		currentDate: Date
	): Set<DateKey> {
		const start = new Date(currentDate);
		start.setHours(0, 0, 0, 0)  // clear time
		start.setDate(start.getDate() - start.getDay()) // set start date to beginning of week (Sunday)


		const week = new Set<DateKey>();

		for (let i = 0; i < 7; i++) {
			const date = new Date(start);
			date.setDate(start.getDate() + i);
			week.add(getDateKey(date));
		}
		return week
	}

	async getActiveSessions(): Promise<SessionData[]> {

		const sessions = await this._loadSessions();
		return this._findActiveSessions(sessions)

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
		
		// const startTS = timestamp.toISOString();
		let sessions = await this._loadSessions();
		const activeSessions = this._findActiveSessions(sessions);
		if (!additive && activeSessions.length > 0) {
			// if additive is false, it means we want to close all active sessions before starting a new one
			sessions = this._stopSessions(sessions, timestamp);
		}
		sessions.push({
			id: crypto.randomUUID(),
			projectPath: project.file.path,
			start: timestamp,
			end: null,
			active: true
		});

		await this._saveSessions(sessions);

	}

	async stopSessions(
		timestamp: Date = new Date(),
		project?: ProjectInfo
	): Promise<void> {
		/*
		- Get current timestamp
		- Check if there's an open project
			- if so, close it first with timestamp
		- Add entry to json file with project and timestamp
		*/

		let sessions = await this._loadSessions();
		const activeSessions = this._findActiveSessions(sessions);
		let targetSessions: SessionData[];
		if (project) {
			targetSessions = activeSessions.filter(
				session => session.projectPath === project.file.path
			);
		} else {
			targetSessions = activeSessions
		}
		if (targetSessions.length === 0) {
			return; // that project has no active sessions, so no need to do anything
		}

		sessions = this._stopSessions(sessions, timestamp, project?.file.path);


		await this._saveSessions(sessions);

	}

	async addCompleteSession(
		project: ProjectInfo,
		startTimestamp: Date,
		stopTimestamp: Date
	): Promise<void> {
		/*
		- Get current timestamp
		- Check if there's an open project
			- if so, close it first with timestamp
		- Add entry to json file with project and timestamp
		*/

		let sessions = await this._loadSessions();

		sessions.push({
			id: crypto.randomUUID(),
			projectPath: project.file.path,
			start: startTimestamp,
			end: stopTimestamp,
			active: false
		});

		await this._saveSessions(sessions);

	}


	// Summary functions

	async getTimeSummary(
		rangeStart: Date,
		rangeEnd: Date
	): Promise<PeriodicTimeSummary> {
		/* 
		/  Returns PeriodicTimeSummary, which is
		/  days: DateKey[];
		/  projects: Map<string, Map<DateKey, number>>;
		/  clients: Map<string, Map<DateKey, number>>
		*/
		// Get summary of time worked between start and end for all projects and clients

		const projects = this.projectManager.getProjects();

		const clientByProjectPath = new Map(
			projects.map(project => [
				project.file.path,
				project.client.replace(/^\[\[|\]\]$/g, "")
			])
		)

		// initialize the summary table
		const projectSummaries = new Map<string, Map<DateKey, number>>();
		const clientSummaries = new Map<string, Map<DateKey, number>>();
		

		const sessions = await this._loadSessions();
		const filteredSessions = this._getSummarySessionsInRange(sessions, rangeStart, rangeEnd);

		for (const { session, startTime, endTime } of filteredSessions) {

			const project = session.projectPath
			const client = clientByProjectPath.get(project);
			const dateKey = getDateKey(startTime);

			const effectiveStart = startTime > rangeStart ? startTime : rangeStart;

			const effectiveEnd = endTime < rangeEnd ? endTime : rangeEnd;

			const durationMinutes = Math.round(
				(effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60)
			);
			
			// project time
			let projectDays = projectSummaries.get(project);
			if (!projectDays) {
				projectDays = new Map<DateKey, number>();
				projectSummaries.set(project, projectDays)
			}

			projectDays.set(
				dateKey,
				(projectDays.get(dateKey) ?? 0) + durationMinutes
			)

			// client time
			if (client) {
				let clientDays = clientSummaries.get(client);
				if (!clientDays) {
					clientDays = new Map<DateKey, number>();
					clientSummaries.set(client, clientDays)
				}

				clientDays.set(
					dateKey,
					(clientDays.get(dateKey) ?? 0) + durationMinutes
				)
			}
			
		}

		// set days separately and completely so days without sessions don't get skipped
		const days: DateKey[] = [];
		const currentDay = new Date(rangeStart);  // redefine rangeStart as a new Date() so we don't somehow overwrite the original value because TypeScript can do things like that...
		while (currentDay < rangeEnd) {
			days.push(getDateKey(currentDay));
			currentDay.setDate(currentDay.getDate() + 1);
		}

		return {
			days,
			projects: projectSummaries,
			clients: clientSummaries
		}

	}

	async getCurrentTimeSummaries(): Promise<TimeSummaryStore> {
		// get day-by-day breakdown for current month
		const currentDate = new Date();
		const start = window.moment()
			.startOf("month")
			.toDate();
		const end = window.moment()
			.endOf("month")
			.toDate();
		const summary = await this.getTimeSummary(start, end);

		const today = new Set<DateKey>([getDateKey(currentDate)]);
		const thisWeekDates = this._getCurrentWeekDates(currentDate);
		const thisMonthDates = summary.days

		return {
			day: {
				project: this._getSummaryTotalsForDates(summary.projects, today),
				client: this._getSummaryTotalsForDates(summary.clients, today)
			},
			week: {
				project: this._getSummaryTotalsForDates(summary.projects, thisWeekDates),
				client: this._getSummaryTotalsForDates(summary.clients, thisWeekDates)
			},
			month: {
				project: this._getSummaryTotalsForDates(summary.projects, thisMonthDates),
				client: this._getSummaryTotalsForDates(summary.clients, thisMonthDates)
			}
		}
	}

	async getMonthlySummary(
		summary: PeriodicTimeSummary
	): Promise<PeriodicTimeSummary> {
		const months = new Set<DateKey>();
		for (const dateKey of summary.days) {
			const date = dateKeyToDate(dateKey);

			const monthKey = getDateKey(
				new Date(date.getFullYear(), date.getMonth(), 1)
			);

			months.add(monthKey);
		}

		return {
			days: [...months].sort(),
			projects: await this._summarizeByMonth(summary.projects),
			clients: await this._summarizeByMonth(summary.clients)
		};
	}

	private async _summarizeByMonth(
		entries: Map<string, Map<DateKey, number>>
	): Promise<Map<string, Map<DateKey, number>>> {
		const result = new Map<string, Map<DateKey, number>>();

		for (const [key, dailyTotals] of entries) {
			const monthlyTotals = new Map<DateKey, number>();

			for (const [dateKey, minutes] of dailyTotals) {
				const date = dateKeyToDate(dateKey);

				const monthKey = getDateKey(
					new Date(date.getFullYear(), date.getMonth(), 1)
				);

				monthlyTotals.set(
					monthKey,
					(monthlyTotals.get(monthKey) ?? 0) + minutes
				);
			}

			result.set(key, monthlyTotals);
		}

		return result;
	}

	private roundSessionTimes(
		startTime: Date,
		startNearest: number = 15,
		endTime: Date,
		endNearest: number = 15
	): [Date, Date] {
		const startInterval = startNearest * 60 * 1000; // 15 minutes in milliseconds
		const start = new Date(Math.floor(startTime.getTime() / startInterval) * startInterval);
		const endInterval = endNearest * 60 * 1000; // 15 minutes in milliseconds
		const end = new Date(Math.ceil(endTime.getTime() / endInterval) * endInterval);

	return [start, end]
		
	}

}


