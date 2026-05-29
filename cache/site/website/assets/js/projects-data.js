let projectsBundlePromise = null;

export async function loadProjectsBundle() {
	if (!projectsBundlePromise) {
		projectsBundlePromise = fetch("projects.json", { cache: "default" })
			.then((response) => {
				if (!response.ok) {
					throw new Error(`Failed to load projects.json (${response.status})`);
				}

				return response.json();
			})
			.then((raw) => {
				if (Array.isArray(raw)) {
					return { projects: raw };
				}

				const projects = Object.entries(raw)
					.filter(([, value]) => value && typeof value === "object" && "id" in value)
					.map(([, value]) => value);

				return { projects };
			});
	}

	return projectsBundlePromise;
}

export async function loadProjectsData() {
	const { projects } = await loadProjectsBundle();
	return projects;
}
