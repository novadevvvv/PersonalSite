import { renderProjectRow } from "./components.js";
import { loadProjectsData } from "./projects-data.js";
import { animateNumber } from "./utils.js";

const projectsList = document.getElementById("projectsList");

function animateVisibleCounts(scope = document) {
	const elements = scope.querySelectorAll(".smooth-count[data-target]");
	elements.forEach((element) => {
		animateNumber(element, Number(element.dataset.target || 0), 800);
	});
}

function renderProjects(projects) {
	if (!projects.length) {
		projectsList.innerHTML = '<div class="alert alert-secondary mb-0">No projects found in projects.json.</div>';
		return;
	}

	const orderedProjects = [...projects].sort((left, right) => Number(right.featured === true) - Number(left.featured === true));
	projectsList.innerHTML = orderedProjects.map(renderProjectRow).join("");
	animateVisibleCounts(projectsList);
}

async function initializeProjects() {
	try {
		const projects = await loadProjectsData();
		renderProjects(projects);
	} catch (error) {
		if (error?.name === "AbortError") {
			return;
		}

		projectsList.innerHTML = '<div class="alert alert-danger mb-0">Could not load projects data.</div>';
		console.error(error);
	}
}

initializeProjects();
