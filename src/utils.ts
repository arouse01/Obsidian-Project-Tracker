import {
	TFile,
	MetadataCache,
	App
} from 'obsidian';
import {
	DateKey
} from './types';

export function formatIssueID(id: number): string {
	return id.toString().padStart(4, "0");
}

// export function formatTimestamp(date: Date = new Date()): string {
// 	return [
// 		date.getFullYear(),
// 		String(date.getMonth() + 1).padStart(2, "0"),
// 		String(date.getDate()).padStart(2, "0")
// 	].join("-") + "T" +
// 	[
// 		String(date.getHours()).padStart(2, "0"),
// 		String(date.getMinutes()).padStart(2, "0"),
// 		String(date.getSeconds()).padStart(2, "0")
// 	].join(":");
		
// }

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
			return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;

		case "datetime_short":
			return `${year}-${month}-${day}T${hours}:${minutes}`;
	}
	
}

export function parseDateString(string: string): Date | undefined {

	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;
	const dateTime = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?:\.(\d{1,3}))?$/;

	// input has date only
	let match = string.match(dateOnly)
	if (match !== null) {
		const [, year, month, day] = match;
		if (
			year === undefined ||
			month === undefined ||
			day === undefined
		) {
			return undefined
		}
		return new Date(
			Number(year),
			Number(month) - 1,
			Number(day)
		)
	}

	match = string.match(dateTime)
	if (match !== null) {
		const [, year, month, day, hour, minute, second, millisecond] = match;
		if (
			year === undefined ||
			month === undefined ||
			day === undefined ||
			hour === undefined ||
			minute === undefined
		) {
			return undefined
		}
		return new Date(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			second === undefined ? 0 : Number(second),
			millisecond === undefined ? 0 : Number(millisecond)
		)
	}
	// try regular automatic parsing, like ISO formatted
	const timestamp = Date.parse(string);
	if (Number.isNaN(timestamp)) {
		return undefined
	}

	return new Date(timestamp)

}

export function getDateKey(
	date: Date = new Date()
): DateKey {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0")

	return `${year}-${month}-${day}`;

}
export function dateKeyToDate(
	dateKey: DateKey
): Date {
	const parts = dateKey.split("-").map(Number)

	const year = Number(parts[0]);
	const month = Number(parts[1]) - 1;
	const day = Number(parts[2]);

	return new Date(year, month, day)
}

export function formatMinutesToDuration(totalMinutes: number, format?: "alt" | "hours"): string {
	if (format === "alt" && totalMinutes == 0) {
		return `-`
	} else if (format === "hours") {
		const hours = Number((totalMinutes / 60).toFixed(2) )  // rounded to two decimal places

		return `${hours}`
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

function getFrontmatterValue(
	// So we can access without worrying about spaces
	metadataCache: MetadataCache,
	file: TFile,
	property: string
): unknown {
	const cache = metadataCache.getFileCache(file);
	const frontmatter = cache?.frontmatter
	if (frontmatter === undefined) {
		return undefined;
	}
	// robust against case inconsistency
	const propertyLower = property.toLowerCase();

	const key = Object.keys(frontmatter).find(
		key => key.toLowerCase() === propertyLower
	);

	
	return key === undefined
		? undefined
		: frontmatter[key]
}

export function getFrontmatterString(
	metadataCache: MetadataCache,
	file: TFile,
	property: string
): string {
	const value =
		getFrontmatterValue(metadataCache, file, property);

	return typeof value === "string"
		? value
		: "";
}

export function getFrontmatterStringArray(
	metadataCache: MetadataCache,
	file: TFile,
	property: string
): string[] {
	const value =
		getFrontmatterValue(metadataCache, file, property);
	if (value === undefined) {
		return []
	}
	
	// const value: unknown = frontmatter[property];

	if (typeof value === "string") {
		return [value.replace(/^\[\[|\]\]$/g, "")];
	}

	if (Array.isArray(value)) {
		return value
			.filter((v): v is string => typeof v === "string")
			.map(v => v.replace(/^\[\[|\]\]$/g, ""));
	}

	return [];
}

export function getFrontmatterNumber(
	metadataCache: MetadataCache,
	file: TFile,
	property: string
): number {
	const value =
		getFrontmatterValue(metadataCache, file, property);

	return typeof value === "number"
		? value
		: NaN;
}

export async function setFrontmatterValue(
	// So we can access without worrying about spaces
	// fileManager: FileManager,
	app: App,
	file: TFile,
	property: string,
	value: number | string
): Promise<void> {
	
	// robust against case inconsistency
	
	await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, number | string>) => {
		const propertyLower = property.toLowerCase();

		const key = Object.keys(frontmatter).find(
			key => key.toLowerCase() === propertyLower
		);
		
		if (key) {
			frontmatter[key] = value
		} else {
			frontmatter[property] = value
		 }
		
	})
}

export async function deleteFrontmatterValue(
	// So we can access without worrying about spaces
	// fileManager: FileManager,
	app: App,
	file: TFile,
	property: string
): Promise<void> {

	// robust against case inconsistency

	await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, number | string>) => {
		const propertyLower = property.toLowerCase();

		const key = Object.keys(frontmatter).find(
			key => key.toLowerCase() === propertyLower
		);

		if (key) {
			delete frontmatter[key]
		} else {
			delete frontmatter[property]
		}

	})
}

export interface HSV {
	h: number; // 0 - 360
	s: number; // 0 - 1
	v: number; // 0 - 1
}

export function hexToHsv(hex: string): HSV {
	hex = hex.replace(/^#/, '');

	let r = parseInt(hex.substring(0, 2), 16);
	let g = parseInt(hex.substring(2, 4), 16);
	let b = parseInt(hex.substring(4, 6), 16);

	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;

	let h = 0;
	const s = max === 0 ? 0 : d / max;
	const v = max;

	if (max !== min) {
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return { h: h * 360, s, v };
}

export function hsvToHex(h: number, s: number, v: number): string {
	// Normalize saturation and value to 0-1
	// s /= 100;
	// v /= 100;

	const k = (n: number) => (n + h / 60) % 6;
	const f = (n: number) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));

	const r = Math.round(255 * f(5));
	const g = Math.round(255 * f(3));
	const b = Math.round(255 * f(1));

	// Convert RGB components to 2-digit hex values
	const toHex = (component: number) => component.toString(16).padStart(2, '0');

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function gradientanator(base: HSV): [ SVGRadialGradientElement, gradientID: string ] {
	const stops = [
		{ offset: 0, v: 1.25, s: 1 },
		{ offset: 0.15, v: 1.15 },
		{ offset: 0.40, v: 1.05 },
		{ offset: 0.65, v: 0.95 },
		{ offset: 0.85, v: 0.80 },
		{ offset: 1, v: 0.70 }
	];
	const gradient = document.createElementNS(SVG_NS, "radialGradient")
	const gradientId = `project-status-${crypto.randomUUID()}`;
	gradient.setAttribute("id", gradientId)
	gradient.setAttribute("cx", "70%")
	gradient.setAttribute("cy", "30%")
	gradient.setAttribute("r", "80%")

	for (const gradStop of stops) {
		const stop = document.createElementNS(SVG_NS, "stop")
		const offset = gradStop.offset.toString()
		const color = hsvToHex(
			base.h,
			base.s,
			Math.min(1, base.v * gradStop.v)

		)
		stop.setAttribute("offset", offset);
		stop.setAttribute("stop-color", color);

		gradient.append(stop)
	}
	return [gradient, gradientId]
}

export function createStatusIcon(active: boolean, baseColor: string = '#6CD900'): SVGSVGElement {
	const radius = 40
	const radiusPlus = radius * 1.1;
	/*const cx = radiusPlus;  // center, x
	const cy = radiusPlus;  // center, y*/

	const base = hexToHsv(baseColor)
	// const base = {
	// 	h: 90,
	// 	s: 1.0,
	// 	v: 0.85
	// };
	const [gradient, gradientId] = gradientanator(base)
	// const stops = [
	// 	{ offset: 0, v: 1.25, s:1 },
	// 	{ offset: 0.15, v: 1.15 },
	// 	{ offset: 0.40, v: 1.05 },
	// 	{ offset: 0.65, v: 0.95 },
	// 	{ offset: 0.85, v: 0.80 },
	// 	{ offset: 1, v: 0.70 }
	// ];

	// technically documentation suggests using `document.createSvg` and the like instead but it doesn't work for some reason
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", `0 0 ${2 * radiusPlus} ${2 * radiusPlus}`);

	const defs = document.createElementNS(SVG_NS, "defs")

	defs.appendChild(gradient)
	if (active) {
		svg.appendChild(defs)
	}
	const circle = document.createElementNS(SVG_NS, "circle");
	circle.setAttribute("cx", `${radiusPlus}`);
	circle.setAttribute("cy", `${radiusPlus}`);
	circle.setAttribute("r", `${radius}`);
	circle.setAttribute("fill", active ? `url(#${gradientId})` : "#d9d9d9");

	svg.appendChild(circle);

	return svg;
}

export function createProgressWheel(p: number): SVGSVGElement {
	const radius = 40;
	const radiusPlus = radius * 1.1;
	const cx = radiusPlus;  // center, x
	const cy = radiusPlus;  // center, y
	// const circumference = 2 * Math.PI * radius;
	// const percent = circumference * (1 - proportion)

	// technically documentation suggests using `document.createSvg` and the like instead but it doesn't work for some reason
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", `0 0 ${2 * radiusPlus} ${2 * radiusPlus}`);

	const track = document.createElementNS(SVG_NS, "circle");
	track.setAttribute("cx", `${radiusPlus}`)
	track.setAttribute("cy", `${radiusPlus}`)
	track.setAttribute("r", `${radius}`)
	
	track.setAttribute("class", "progress-track")

	
	// fill.style.strokeDashoffset = `${percent}`
	svg.appendChild(track)
	

	// calculate wedge path
	const fill = document.createElementNS(SVG_NS, "path");
	fill.setAttribute("class", "progress-fill")
	
	let baseColor: string;
	if (p <= 0) {
		fill.setAttribute("d", "");
		baseColor = "#f2f2f2"
		track.setAttribute("stroke", `black`)
		track.setAttribute("strokewidth", `0.1px`)
	} else if (p >= 1) {
		fill.setAttribute(
			"d",
			`M ${cx} ${cy - radius}
             A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}
             A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}
             Z`
		);
		fill.setAttribute("class", "progress-max")
		baseColor = "#f2f200"
	} else {
		fill.setAttribute("class", "progress-fill")

		const startAngle = -Math.PI / 2;
		const endAngle = startAngle + p * 2 * Math.PI;

		const x1 = cx + radius * Math.cos(startAngle);
		const y1 = cy + radius * Math.sin(startAngle);

		const x2 = cx + radius * Math.cos(endAngle);
		const y2 = cy + radius * Math.sin(endAngle);

		const largeArcFlag = p > 0.5 ? 1 : 0;

		fill.setAttribute(
			"d",
			`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`
		);
		baseColor = "#108510"
		track.setAttribute("stroke", `black`)
		track.setAttribute("strokewidth", `0.1px`)
	}
	const defs = document.createElementNS(SVG_NS, "defs")
	const base = hexToHsv(baseColor)
	const [gradient, gradientId] = gradientanator(base)
	defs.appendChild(gradient)

		svg.appendChild(defs)
	fill.setAttribute("fill", `url(#${gradientId})`);
	svg.appendChild(fill)

	return svg;
}
/*
export function createProgressWheel(container: HTMLElement, percentage: number): HTMLElement {
	// technically documentation suggests using `document.createSvg` and the like instead but it doesn't work for some reason
	// const svg = document.createElementNS(SVG_NS, "svg");
	// svg.setAttribute("viewBox", "0 0 20 20");

	// 1. Create the base container
	const wheelContainer = container.createDiv({ cls: "progress-wheel-container" });

	// 2. Define SVG layout variables
	const radius = 12;
	const circumference = 2 * Math.PI * radius;
	// Calculate how much of the border to hide based on progress
	const strokeDashoffset = circumference - (percentage) * circumference;


	

	// 3. Inject the SVG structure
	wheelContainer.innerHTML = `
        <svg class="progress-wheel-svg" width="24" height="24" viewBox="0 0 24 24">
            <!-- Background circle -->
            <circle class="progress-wheel-bg" cx="12" cy="12" r="${radius}" />
            <!-- Animated foreground progress circle -->
            <circle class="progress-wheel-bar" cx="12" cy="12" r="${radius}" 
                    stroke-dasharray="${circumference}" 
                    stroke-dashoffset="${strokeDashoffset}" />
        </svg>
        <!-- Central Percentage Text -->
        <span class="progress-wheel-text">${percentage}%</span>
    `;

	return wheelContainer;
}
*/
