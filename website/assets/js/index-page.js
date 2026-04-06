import { renderProjectCard } from "./components.js";
import { loadProjectsBundle } from "./projects-data.js";
import { animateNumber } from "./utils.js";

const projectsGrid = document.getElementById("projectsGrid");
const projectsCount = document.getElementById("projectsCount");
const totalVisits = document.getElementById("totalVisits");
const totalFavorites = document.getElementById("totalFavorites");
const totalCheers = document.getElementById("totalCheers");
const totalVisitors = document.getElementById("totalVisitors");

function animateMetric(element, value, duration = 900) {
	if (!element) {
		return;
	}

	animateNumber(element, value, duration);
}

function animateVisibleCounts(scope = document) {
	const elements = scope.querySelectorAll(".smooth-count[data-target]");
	elements.forEach((element) => {
		animateNumber(element, Number(element.dataset.target || 0), 800);
	});
}

function renderProjects(projects) {
	if (!projects.length) {
		projectsGrid.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">No projects found in projects.json.</div></div>';
		animateMetric(projectsCount, 0, 700);
		animateMetric(totalVisits, 0, 800);
		animateMetric(totalFavorites, 0, 800);
		animateMetric(totalCheers, 0, 800);
		animateMetric(totalVisitors, 0, 800);
		return;
	}

	const featuredProjects = projects.filter((project) => project.featured === true);
	const standardProjects = projects.filter((project) => project.featured !== true);
	projectsGrid.innerHTML = [...featuredProjects, ...standardProjects].map(renderProjectCard).join("");
	animateVisibleCounts(projectsGrid);
	animateMetric(projectsCount, projects.length, 900);

	const totals = projects.reduce((acc, project) => {
		if (!project.archived) {
			return acc;
		}

		const stats = project.stats || {};
		acc.visitCount += Number(stats.visitCount || 0);
		acc.favoriteCount += Number(stats.favoriteCount || 0);
		acc.cheerCount += Number(stats.cheerCount || 0);
		acc.visitorCount += Number(stats.visitorCount || 0);
		return acc;
	}, {
		visitCount: 0,
		favoriteCount: 0,
		cheerCount: 0,
		visitorCount: 0,
	});

	animateMetric(totalVisits, totals.visitCount, 1000);
	animateMetric(totalFavorites, totals.favoriteCount, 1000);
	animateMetric(totalCheers, totals.cheerCount, 1000);
	animateMetric(totalVisitors, totals.visitorCount, 1000);
}

async function initializeProjects() {
	try {
		const { projects } = await loadProjectsBundle();
		renderProjects(projects);
	} catch (error) {
		if (error?.name === "AbortError") {
			return;
		}

		projectsGrid.innerHTML = '<div class="col-12"><div class="alert alert-danger mb-0">Could not load projects data.</div></div>';
		console.error(error);
	}
}

initializeProjects();
