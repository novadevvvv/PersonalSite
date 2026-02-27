import { loadProjectsBundle } from "./projects-data.js";
import { numberFormat } from "./utils.js";

const statsTitle = document.getElementById("statsTitle");
const statsSubtitle = document.getElementById("statsSubtitle");
const currentVisits = document.getElementById("currentVisits");
const totalGrowth = document.getElementById("totalGrowth");
const avgDailyGrowth = document.getElementById("avgDailyGrowth");
const statsError = document.getElementById("statsError");
const chartCanvas = document.getElementById("visitsChart");

function parseProjectId() {
	const params = new URLSearchParams(window.location.search);
	const id = params.get("id");
	if (!id) {
		throw new Error("Missing project id.");
	}
	return String(id);
}

function normalizeHistory(project) {
	const history = Array.isArray(project.visitHistory) ? project.visitHistory : [];
	const points = history
		.filter((entry) => entry && typeof entry === "object" && entry.date && entry.visitCount !== undefined)
		.map((entry) => ({ date: String(entry.date), visitCount: Number(entry.visitCount || 0) }))
		.sort((a, b) => a.date.localeCompare(b.date));

	if (!points.length) {
		const fallbackVisits = Number(project?.stats?.visitCount || 0);
		return [{ date: "Today", visitCount: fallbackVisits }];
	}

	return points;
}

function updateSummary(points, project) {
	const lastPoint = points[points.length - 1];
	const firstPoint = points[0];
	const totalDelta = Math.max(0, lastPoint.visitCount - firstPoint.visitCount);
	const days = Math.max(points.length - 1, 1);
	const averageDelta = Math.round(totalDelta / days);

	currentVisits.textContent = numberFormat.format(Number(project?.stats?.visitCount || lastPoint.visitCount || 0));
	totalGrowth.textContent = numberFormat.format(totalDelta);
	avgDailyGrowth.textContent = numberFormat.format(averageDelta);
}

function renderChart(points) {
	const labels = points.map((point) => point.date);
	const data = points.map((point) => point.visitCount);

	new window.Chart(chartCanvas, {
		type: "line",
		data: {
			labels,
			datasets: [
				{
					label: "Visits",
					data,
					borderColor: "rgba(34, 211, 238, 0.95)",
					backgroundColor: "rgba(34, 211, 238, 0.18)",
					fill: true,
					tension: 0.3,
					pointRadius: 3,
					pointHoverRadius: 5,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: false,
				},
			},
			scales: {
				x: {
					ticks: {
						color: "rgba(233, 237, 245, 0.7)",
					},
					grid: {
						color: "rgba(255,255,255,0.08)",
					},
				},
				y: {
					beginAtZero: true,
					ticks: {
						color: "rgba(233, 237, 245, 0.7)",
						callback(value) {
							return numberFormat.format(Number(value));
						},
					},
					grid: {
						color: "rgba(255,255,255,0.08)",
					},
				},
			},
		},
	});
}

async function init() {
	try {
		const projectId = parseProjectId();
		const { projects } = await loadProjectsBundle();
		const project = projects.find((item) => String(item.id) === projectId);

		if (!project) {
			throw new Error(`Project not found for id ${projectId}.`);
		}

		statsTitle.textContent = `${project.title || "Project"} • Visits`;
		statsSubtitle.textContent = "Saved once per day from live room stats.";

		const points = normalizeHistory(project);
		updateSummary(points, project);
		renderChart(points);
	} catch (error) {
		statsError.classList.remove("d-none");
		statsError.textContent = error instanceof Error ? error.message : "Could not load stats.";
		console.error(error);
	}
}

init();
