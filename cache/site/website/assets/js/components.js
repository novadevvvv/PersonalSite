import { buildExternalRedirectUrl, escapeHtml, formatDescription } from "./utils.js";

export function renderProjectCard(project) {
	const isComingSoon = project.comingSoon === true;
	const isArchived = project.archived === true;
	const isFeatured = project.featured === true;
	const stats = project.stats || {};
	const cheerCount = Number(stats.cheerCount || 0);
	const favoriteCount = Number(stats.favoriteCount || 0);
	const visitCount = Number(stats.visitCount || 0);
	const visitorCount = Number(stats.visitorCount || 0);
	const safeImageUrl = project.imageUrl || "comingSoon.jpg";
	const title = escapeHtml(project.title || "Untitled Project");
	const description = formatDescription(
		isComingSoon
			? (project.description || "Still in progress - updates coming soon.")
			: (project.description || "No description added yet.")
	);
	const status = escapeHtml(project.status || (isArchived ? "Archived" : (isComingSoon ? "Concept" : "Project")));
	const note = project.note ? formatDescription(project.note) : "";
	const snapshotDate = escapeHtml(project.snapshotDate || "");
	const columnClass = isFeatured ? "col-12" : "col-12 col-lg-6";
	const cta = project.cta && typeof project.cta === "object" ? project.cta : null;
	const ctaLabel = cta?.label ? escapeHtml(cta.label) : "";
	const ctaUrl = cta?.url ? escapeHtml(buildExternalRedirectUrl(cta.url)) : "";
	const imageLoading = isFeatured ? "eager" : "lazy";
	const imageFetchPriority = isFeatured ? "high" : "low";

	return `
		<div class="${columnClass}">
			<div class="card project-card h-100 border-0 glass-card ${isComingSoon ? "coming-soon-card" : ""} ${isFeatured ? "featured-project-card" : ""}">
				<img src="${escapeHtml(safeImageUrl)}" class="card-img-top" alt="${title}" loading="${imageLoading}" decoding="async" fetchpriority="${imageFetchPriority}">
				<div class="card-body d-flex flex-column">
					<div class="d-flex flex-wrap gap-2 align-items-center mb-3">
						<span class="project-status-badge">${status}</span>
						${snapshotDate ? `<span class="project-meta-pill">Snapshot ${snapshotDate}</span>` : ""}
					</div>
					<h5 class="card-title">${title}</h5>
					<p class="card-text text-secondary project-description mb-3">${description}</p>
					${note ? `<p class="project-note mb-3">${note}</p>` : ""}
					${isArchived
						? `<div class="d-flex flex-wrap gap-2 mt-auto mb-3 stats-badges">
							<span class="badge text-bg-primary-subtle"><i class="fa-solid fa-star me-1"></i><span class="smooth-count" data-target="${cheerCount}">0</span> Cheers</span>
							<span class="badge text-bg-info-subtle"><i class="fa-solid fa-heart me-1"></i><span class="smooth-count" data-target="${favoriteCount}">0</span> Favorites</span>
							<span class="badge text-bg-success-subtle"><i class="fa-solid fa-chart-line me-1"></i><span class="smooth-count" data-target="${visitCount}">0</span> Visits</span>
							<span class="badge text-bg-secondary"><i class="fa-solid fa-users me-1"></i><span class="smooth-count" data-target="${visitorCount}">0</span> Players</span>
						 </div>
						 <div class="mt-auto"><button class="btn btn-outline-secondary btn-sm" type="button" disabled>Unavailable After June 2026</button></div>`
						: `${ctaUrl
							? `<div class="d-flex flex-wrap gap-2 mt-auto"><a href="${ctaUrl}" class="btn btn-primary btn-sm" target="_self" rel="noopener noreferrer">${ctaLabel}</a></div>`
							: `<div class="mt-auto"><button class="btn btn-outline-secondary btn-sm" type="button" disabled>${isComingSoon ? "In Planning" : "Private Project"}</button></div>`}`}
				</div>
			</div>
		</div>
	`;
}

export function renderProjectRow(project) {
	const isComingSoon = project.comingSoon === true;
	const isArchived = project.archived === true;
	const isFeatured = project.featured === true;
	const stats = project.stats || {};
	const cheerCount = Number(stats.cheerCount || 0);
	const favoriteCount = Number(stats.favoriteCount || 0);
	const visitCount = Number(stats.visitCount || 0);
	const visitorCount = Number(stats.visitorCount || 0);
	const safeImageUrl = project.imageUrl || "comingSoon.jpg";
	const title = escapeHtml(project.title || "Untitled Project");
	const description = formatDescription(
		isComingSoon
			? (project.description || "Still in progress - updates coming soon.")
			: (project.description || "No description added yet.")
	);
	const status = escapeHtml(project.status || (isArchived ? "Archived" : (isComingSoon ? "Concept" : "Project")));
	const note = project.note ? formatDescription(project.note) : "";
	const snapshotDate = escapeHtml(project.snapshotDate || "");
	const cta = project.cta && typeof project.cta === "object" ? project.cta : null;
	const ctaLabel = cta?.label ? escapeHtml(cta.label) : "";
	const ctaUrl = cta?.url ? escapeHtml(buildExternalRedirectUrl(cta.url)) : "";

	return `
		<article class="glass-card p-4 project-row-card ${isComingSoon ? "coming-soon-card" : ""} ${isFeatured ? "featured-project-row" : ""}">
			<div class="row g-4 align-items-start">
				<div class="col-lg-4">
					<img src="${escapeHtml(safeImageUrl)}" alt="${title}" class="project-image" loading="lazy" decoding="async" fetchpriority="low">
				</div>
				<div class="col-lg-8">
					<div class="d-flex flex-wrap gap-2 align-items-center mb-3">
						<span class="project-status-badge">${status}</span>
						${snapshotDate ? `<span class="project-meta-pill">Snapshot ${snapshotDate}</span>` : ""}
					</div>
					<h3 class="mb-3">${title}</h3>
					<p class="text-secondary project-description-full mb-3">${description}</p>
					${note ? `<p class="project-note mb-3">${note}</p>` : ""}
					${isArchived
						? `<div class="d-flex flex-wrap gap-2 mb-3 stats-badges">
							<span class="badge text-bg-primary-subtle"><i class="fa-solid fa-star me-1"></i><span class="smooth-count" data-target="${cheerCount}">0</span> Cheers</span>
							<span class="badge text-bg-info-subtle"><i class="fa-solid fa-heart me-1"></i><span class="smooth-count" data-target="${favoriteCount}">0</span> Favorites</span>
							<span class="badge text-bg-success-subtle"><i class="fa-solid fa-chart-line me-1"></i><span class="smooth-count" data-target="${visitCount}">0</span> Visits</span>
							<span class="badge text-bg-secondary"><i class="fa-solid fa-users me-1"></i><span class="smooth-count" data-target="${visitorCount}">0</span> Players</span>
						 </div>
						 <button class="btn btn-outline-secondary" type="button" disabled>Unavailable After June 2026</button>`
						: `${ctaUrl
							? `<div class="d-flex flex-wrap gap-2"><a href="${ctaUrl}" class="btn btn-primary" target="_self" rel="noopener noreferrer">${ctaLabel}</a></div>`
							: `<button class="btn btn-outline-secondary" type="button" disabled>${isComingSoon ? "In Planning" : "Private Project"}</button>`}`}
				</div>
			</div>
		</article>
	`;
}

export function renderApiCard(api) {
	const title = escapeHtml(api.name || "Untitled API");
	const summary = escapeHtml(api.description || "No description provided.");
	const endpoints = Array.isArray(api.endpoints) ? api.endpoints : [];
	const repositories = Array.isArray(api.repositories) ? api.repositories : [];

	const endpointHtml = endpoints.length
		? endpoints.map((endpoint) => {
			const method = escapeHtml((endpoint.method || "GET").toUpperCase());
			const route = escapeHtml(endpoint.path || "/");
			const details = escapeHtml(endpoint.description || "");

			return `
				<li class="api-endpoint-item">
					<span class="api-method">${method}</span>
					<code class="api-route">${route}</code>
					${details ? `<small class="text-secondary d-block mt-1">${details}</small>` : ""}
				</li>
			`;
		}).join("")
		: '<li class="api-endpoint-item"><small class="text-secondary">No endpoints listed yet.</small></li>';

	const repoHtml = repositories.length
		? repositories.map((repo) => {
			const repoName = escapeHtml(repo.name || "Repository");
			const repoUrl = escapeHtml(buildExternalRedirectUrl(repo.url || "#"));
			return `<a href="${repoUrl}" class="badge text-bg-secondary text-decoration-none" target="_self" rel="noopener noreferrer"><i class="fa-brands fa-github me-1"></i>${repoName}</a>`;
		}).join(" ")
		: '<span class="badge text-bg-secondary">No repo linked</span>';

	return `
		<div class="col-12 col-lg-6">
			<article class="glass-card h-100 api-card">
				<h3 class="h5 mb-2">${title}</h3>
				<p class="text-secondary mb-3">${summary}</p>
				<div class="api-section mb-3">
					<p class="api-label mb-2"><i class="fa-solid fa-link me-2"></i>Endpoints</p>
					<ul class="api-endpoints list-unstyled mb-0">${endpointHtml}</ul>
				</div>
				<div class="api-section">
					<p class="api-label mb-2"><i class="fa-brands fa-github me-2"></i>Repositories</p>
					<div class="d-flex flex-wrap gap-2">${repoHtml}</div>
				</div>
			</article>
		</div>
	`;
}
