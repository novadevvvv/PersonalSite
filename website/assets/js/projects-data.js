export async function loadProjectsData() {
	const response = await fetch(`projects.json?t=${Date.now()}`, { cache: "no-store" });
	if (!response.ok) {
		throw new Error(`Failed to load projects.json (${response.status})`);
	}

	const raw = await response.json();
	return Array.isArray(raw) ? raw : Object.values(raw);
}
