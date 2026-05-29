import { loadApisData } from "./api-data.js";
import { escapeHtml } from "./utils.js";

const endpointContent = document.getElementById("endpointContent");
const endpointTitle = document.getElementById("endpointTitle");
const endpointSubtitle = document.getElementById("endpointSubtitle");

function toApiSlug(value) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function renderJsonBlock(value) {
	if (value === null || value === undefined) {
		return '<small class="text-secondary">No data available.</small>';
	}

	return `<pre class="api-code-block mb-0">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function parseRouteInfo() {
	const parts = window.location.pathname.split("/").filter(Boolean);
	const apisIndex = parts.indexOf("apis");
	if (apisIndex === -1) {
		return null;
	}

	const apiSlug = parts[apisIndex + 1] || "";
	const endpointIndexRaw = parts[apisIndex + 2] || "";
	const endpointIndex = Number(endpointIndexRaw) - 1;

	if (!apiSlug || Number.isNaN(endpointIndex) || endpointIndex < 0) {
		return null;
	}

	return { apiSlug, endpointIndex };
}

function renderNotFound(message) {
	endpointTitle.textContent = "Endpoint not found";
	endpointSubtitle.textContent = message;
	endpointContent.innerHTML = '<div class="alert alert-warning mb-0">Unable to resolve this endpoint from api.json.</div>';
}

async function initEndpointPage() {
	if (!endpointContent) {
		return;
	}

	const routeInfo = parseRouteInfo();
	if (!routeInfo) {
		renderNotFound("The URL format should be /apis/{api}/{number}/");
		return;
	}

	try {
		const apis = await loadApisData();
		const api = apis.find((item) => toApiSlug(item.name) === routeInfo.apiSlug);
		if (!api) {
			renderNotFound("That API does not exist in api.json.");
			return;
		}

		const endpoint = (api.endpoints || [])[routeInfo.endpointIndex];
		if (!endpoint) {
			renderNotFound("That endpoint number does not exist for this API.");
			return;
		}

		const method = escapeHtml((endpoint.method || "GET").toUpperCase());
		const path = escapeHtml(endpoint.path || "/");
		const description = escapeHtml(endpoint.description || "No description provided.");

		endpointTitle.innerHTML = `${escapeHtml(api.name || "API")} • Endpoint ${routeInfo.endpointIndex + 1}`;
		endpointSubtitle.innerHTML = `<span class="api-method">${method}</span><code class="api-route">${path}</code>`;

		endpointContent.innerHTML = `
			<article class="glass-card api-card">
				<p class="text-secondary mb-3">${description}</p>
				<div class="api-section mb-3">
					<p class="api-label mb-2">Parameters</p>
					${renderJsonBlock(endpoint.parameters || {})}
				</div>
				<div class="api-section">
					<p class="api-label mb-2">Example Response</p>
					${renderJsonBlock(endpoint.responseExample ?? null)}
				</div>
			</article>
		`;
	} catch (error) {
		endpointTitle.textContent = "Failed to load endpoint";
		endpointSubtitle.textContent = "Could not read api.json.";
		endpointContent.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(String(error?.message || "Unknown error"))}</div>`;
	}
}

initEndpointPage();
