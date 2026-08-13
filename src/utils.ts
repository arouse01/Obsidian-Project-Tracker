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

export function formatDate(date: Date = new Date()): string {
	return[
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0")
	].join("-")
}

export function formatMinutesToDuration(totalMinutes: number): string {
	const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
	const minutes = (totalMinutes % 60).toString().padStart(2, '0');
	return `${hours}:${minutes}`
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
