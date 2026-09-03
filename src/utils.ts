// import {
// 	Editor,
// 	TFile
// } from 'obsidian';
export function formatIssueID(id: number): string {
	return id.toString().padStart(4, "0");
}

export function formatTimestamp(date: Date = new Date()): string {
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0")
	].join("-") + "T" +
	[
		String(date.getHours()).padStart(2, "0"),
		String(date.getMinutes()).padStart(2, "0"),
		String(date.getSeconds()).padStart(2, "0")
	].join(":");
		
}

export type timestampFormat =
	| "date"
	| "time"
	| "datetime"
	| "datetime_long"
	| "datetime_short"


export function formatDate(
	date: Date = new Date(),
	format: timestampFormat = "date"
): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0")

	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");
	const ms = String(date.getMilliseconds()).padStart(3, "0");

	switch (format) { 
		case "date": 
			return `${year}-${month}-${day}`;
		
		case "datetime":
			return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;		
		
		case "time": 
			return `${hours}:${minutes}:${seconds}`

		case "datetime_long": 
			return `${year}-${month}-${day} ${hours}:${minutes}.${ms}`;

		case "datetime_short":
			return `${year}-${month}-${day} ${hours}:${minutes}`;
	}
	
}

export function formatMinutesToDuration(totalMinutes: number, altDisplay: boolean = false): string {
	if (altDisplay && totalMinutes == 0) {
		return `-`
	} else {
		const hours = Math.floor(totalMinutes / 60).toString().padStart(1, '0');
		const minutes = (totalMinutes % 60).toString().padStart(2, '0');
	
		return `${hours}:${minutes}`
	}
	
}

export function normalizeWikiLink(link: string): string {
	if (!link) {
		return "";
	}
	const [path = ""] = link
		.replace(/^\[\[/, "")   // Remove leading [[
		.replace(/\]\]$/, "")   // Remove trailing ]]
		.split("|")             // Keep only the link path, remove any link alias

	return path.trim();
}
