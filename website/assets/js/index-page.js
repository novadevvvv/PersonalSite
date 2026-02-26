import { renderProjectCard } from "./components.js";
import { loadProjectsData } from "./projects-data.js";
import { animateNumber } from "./utils.js";

const projectsGrid = document.getElementById("projectsGrid");
const projectsCount = document.getElementById("projectsCount");

let lastSignature = "";

function animateVisibleCounts(scope = document) {
	const elements = scope.querySelectorAll(".smooth-count[data-target]");
	elements.forEach((element) => {
		animateNumber(element, Number(element.dataset.target || 0), 800);
	});
}

function buildSignature(projects) {
	return JSON.stringify(projects);
}

function renderProjects(projects) {
	if (!projects.length) {
		projectsGrid.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">No projects found in projects.json.</div></div>';
		animateNumber(projectsCount, 0, 700);
		return;
	}

	projectsGrid.innerHTML = projects.map(renderProjectCard).join("");
	animateVisibleCounts(projectsGrid);
	animateNumber(projectsCount, projects.length, 900);
}

async function refreshProjects() {
	try {
		const projects = await loadProjectsData();
		const signature = buildSignature(projects);

		if (signature !== lastSignature) {
			lastSignature = signature;
			renderProjects(projects);
		}
	} catch (error) {
		projectsGrid.innerHTML = '<div class="col-12"><div class="alert alert-danger mb-0">Could not load projects data.</div></div>';
		console.error(error);
	}
}

refreshProjects();
setInterval(refreshProjects, 3000);
