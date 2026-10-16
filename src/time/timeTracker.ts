import {
	App,
	Events,
	TFile
} from 'obsidian';
import { MyProjectManager } from '@/projects/projectManager';
import {
	ProjectInfo,
	RawTimeSession,
	TimeSummaryStore,
	PeriodicTimeSummary,
	SessionData,
	DateKey,
	SummarySession,
	TimePeriod,
    TimeTarget,
    WeeklyTimePlans,
	WeeklyAllocation,
	NotificationRecord,
    NotificationType,
    CreateAllocRequest
} from '@/utils/types';
import {
	getDateKey,
	dateKeyToDate,
    formatDate
} from '@/utils/utils'
import { IssueTrackerSettings } from '../settings/settings';
// import { SummaryGroup } from '@/utils/tableFunctions';


export class TimeTracker extends Events {
	weeklyTimePlans!: WeeklyTimePlans;
	currWeekAllocations!: WeeklyAllocation;
	private refreshInterval: number | undefined = undefined;

	constructor(
		private app: App,
		private projectManager: MyProjectManager,
		private settings: IssueTrackerSettings,
		// private getTimeLogPath: () => string,
		// private getTimePlanPath: () => string,
		// private getNotificationLogPath: () => string
	) {
		super();
		// console.log("refreshAllocations from timeTracker constructor")
		// void this.refreshAllocations()
		this.refreshInterval = window.setInterval(() => {
			void this.checkTimeLimits();
		}, 60000);

	}

	stopMonitoring(): void {
		if (this.refreshInterval !== undefined) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = undefined;
		}
	}

	async refreshAllocations(): Promise<void> {
		const thisWeek = getDateKey(undefined, true)
		this.weeklyTimePlans = await this._loadWeeklyTimePlans()
		// console.log(this.weeklyTimePlans)
		this.currWeekAllocations = this.getWeeklyAllocations(thisWeek)

	}

	
	private async _loadWeeklyTimePlans(): Promise<WeeklyTimePlans> {
		const path = this.settings.timeAllocPath
		// console.log(JSON.stringify(path))
		const file = this.app.vault.getAbstractFileByPath(path);
		// console.log(file)

		if (!(file instanceof TFile)) {
			return {};
		}

		const json = await this.app.vault.read(file);
		if (json.trim() === "") {
			return {};
		}

		try {
			return JSON.parse(json) as WeeklyTimePlans;
		} catch (error) {
			console.error("Failed to parse weekly time plans: ", error);
			return {};
		}

	}

	private async _saveWeeklyTimePlans(plans: WeeklyTimePlans): Promise<void> {
		const planPath = this.settings.timeAllocPath
		const file = this.app.vault.getAbstractFileByPath(planPath);
		//console.log(file);
		// const rawSessions = sessions.map(formattedSession => this._sessionDataToRaw(formattedSession))
		const timeData = JSON.stringify(plans)

		if (file && (file instanceof TFile)) {
			// timeLog file exists, write to it
			await this.app.vault.modify(file, timeData);
		} else {
			await this.app.vault.create(planPath, timeData);
		}

		this.trigger("time-allocations-updated");  // trigger an update of displays related to time tracking

	}

	async updateWeeklyAllocation(
		project: ProjectInfo | string,
		target: number
	): Promise<void> {
		const thisWeek = getDateKey(undefined, true);
		let projectPath: string
		if (typeof project === "string") {
			projectPath = project
		} else {
			projectPath = project.file.path;
		}

		if (this.weeklyTimePlans[thisWeek] === undefined) {
			this.weeklyTimePlans[thisWeek] = {}
		}
		
		this.weeklyTimePlans[thisWeek][projectPath] = target

		this.currWeekAllocations = this.getWeeklyAllocations(thisWeek)

		await this._saveWeeklyTimePlans(this.weeklyTimePlans);
	}


	getWeeklyAllocations(weekStarting: DateKey): WeeklyAllocation {
		const allocation = this.weeklyTimePlans[weekStarting]
		return allocation ?? {}
		
	}

	async setWeeklyAllocations(request: CreateAllocRequest): Promise<void> {
		const dateKey = request.dateKey;
		const allocations = request.allocations

		if (this.weeklyTimePlans[dateKey] === undefined) {
			this.weeklyTimePlans[dateKey] = {}
		}

		for (const projPath in allocations) {
			this.weeklyTimePlans[dateKey][projPath] = allocations[projPath] ?? 0
		}
		this.currWeekAllocations = this.getWeeklyAllocations(dateKey)

		await this._saveWeeklyTimePlans(this.weeklyTimePlans);
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
		const path = this.settings.timeLogPath;
		// console.log(JSON.stringify(path))
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
		const path = this.settings.timeLogPath;
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

	async getActiveProjectSession(projectPath: string): Promise<SessionData | undefined> {
		// returns true if project has session that is active
		const sessions = await this._loadSessions();
		const activeSessions = this._findActiveSessions(sessions)

		return activeSessions.find(session => session.projectPath === projectPath)

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

	async checkTimeLimits() {
		const timeSummaries = await this.getCurrentTimeSummaries()
		const projects = this.projectManager.getActiveProjects()
		const thisWeek = getDateKey(undefined, true)
		const notifications = await this._loadNotificationLog()
		this.currWeekAllocations = this.getWeeklyAllocations(thisWeek)
		if (this.settings.allowNotifications) {
			for (const project of projects) {

				// Check allocated times first (which can include projects that don't have a standard goal)
				const allocationNotified = this.checkNotificationLog(notifications, project, "allocated", thisWeek)
				if (!allocationNotified) {
					const timePeriod = "allocated"

					const runningTotal = (timeSummaries.week.project.get(project.file.path) ?? 0) / 60 // timeSummaries returns in minutes
					const allocatedTarget = this.currWeekAllocations[project.file.path] ?? Infinity 
					if (runningTotal > allocatedTarget) {
						this.createTimeNotification(project, timePeriod, thisWeek, allocatedTarget)
					}
				}

				// then check project-specific times
				if (project.targetHours && project.targetHours?.period ==="month") {
					const timePeriod = project.targetHours.period
					const timeNotified = this.checkNotificationLog(notifications, project, timePeriod, thisWeek)
					if (!timeNotified) {
						
						const runningTotal = (timeSummaries[timePeriod].project.get(project.file.path) ?? 0) / 60 // timeSummaries returns in minutes
						const standingTarget = project.targetHours.hours ?? Infinity
						if (runningTotal > standingTarget) {
							this.createTimeNotification(project, timePeriod, thisWeek, standingTarget)
						}
					}
				}
			}


			// const weekTotal = timeSummaries.week.project.get(project.file.path) ?? 0
			// const weekTarget = project.targetHours?.get("week") ?? 0
			// if (weekTotal > weekTarget && weekTarget > 0) {
			// 	this.createTimeNotification(project, "week")
			// }
		}
		
	}

	createTimeNotification(
		project: ProjectInfo,
		type: NotificationType,
		periodKey: DateKey,
		target: number
	) {
		let message = ''
		if (type === "allocated") {
			message = `${project.name} has reached its allocated weekly target of ${target}h.`
		} else if (type === "week") {
			message = `${project.name} has reached its weekly target of ${target}h.`
		} else if (type === "month") {
			message = `${project.name} has reached its monthly target of ${target}h.`
		}
		new Notification(`Time met`, { body: message })
		void this.logNotification(project, type, periodKey)
	}

	private checkNotificationLog(
		notifications: NotificationRecord[],
		project: ProjectInfo,
		type: NotificationType,
		periodKey: string
	): boolean {
		return notifications.some(record =>
			record.projectPath === project.file.path &&
			record.type === type &&
			record.periodKey === periodKey
		)


	}

	async logNotification(
		project: ProjectInfo,
		type: NotificationType,
		periodKey: string
	): Promise<void> {
		let notifications = await this._loadNotificationLog();
		/*const activeSessions = this._findActiveSessions(sessions);
		if (!additive && activeSessions.length > 0) {
			// if additive is false, it means we want to close all active sessions before starting a new one
			sessions = this._stopSessions(sessions, timestamp);
		}*/
		notifications.push({
			projectPath: project.file.path,
			type: type,
			periodKey: periodKey,
			notifiedAt: formatDate(undefined, "datetime")
		});

		await this.saveTimeNotification(notifications);
	}

	private async _loadNotificationLog(): Promise<NotificationRecord[]> {
		const logPath = this.settings.notificationLogPath
		const file = this.app.vault.getAbstractFileByPath(logPath);

		if (!(file instanceof TFile)) {
			return [];
		}

		const json = await this.app.vault.read(file);
		try {
			return JSON.parse(json) as NotificationRecord[];
		} catch (error) {
			console.error("Failed to parse weekly time plans: ", error);
			return [];
		}
		
	}

	private async saveTimeNotification(notifications: NotificationRecord[]): Promise<void> {
		const logPath = this.settings.notificationLogPath
		const file = this.app.vault.getAbstractFileByPath(logPath);
		//console.log(file);
		// const rawSessions = sessions.map(formattedSession => this._sessionDataToRaw(formattedSession))
		// const timeData = JSON.stringify(plans)

		//console.log(file);
		// const notifications = sessions.map(formattedSession => this._sessionDataToRaw(formattedSession))
		const notificationData = JSON.stringify(notifications)

		if (file && (file instanceof TFile)) {
			// timeLog file exists, write to it
			await this.app.vault.modify(file, notificationData);
		} else {
			await this.app.vault.create(logPath, notificationData);
		}
	}

	// getWeeklyTargetHours(
	// 	target: TimeTarget
	// ): number {
	// 	switch (target.period) {
	// 		case "day":
	// 			return target.hours * 5;
	// 		case "week": 
	// 			return target.hours;
	// 		case "month":
	// 			return target.hours
	// 	}
	// }
}


