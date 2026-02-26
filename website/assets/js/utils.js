export const numberFormat = new Intl.NumberFormat();

export function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function formatDescription(value) {
	const normalized = String(value ?? "")
		.replaceAll("\\r\\n", "\n")
		.replaceAll("\\n", "\n");

	return escapeHtml(normalized).replace(/\r?\n/g, "<br>");
}

export function animateNumber(element, target, duration = 700) {
	const parsedTarget = Number(target) || 0;
	const current = Number(element.dataset.current ?? "0") || 0;

	if (current === parsedTarget) {
		element.textContent = numberFormat.format(parsedTarget);
		element.dataset.current = String(parsedTarget);
		return;
	}

	const start = current;
	const startTime = performance.now();

	function step(now) {
		const elapsed = now - startTime;
		const progress = Math.min(elapsed / duration, 1);
		const eased = 1 - Math.pow(1 - progress, 3);
		const value = Math.round(start + (parsedTarget - start) * eased);
		element.textContent = numberFormat.format(value);

		if (progress < 1) {
			requestAnimationFrame(step);
			return;
		}

		element.dataset.current = String(parsedTarget);
	}

	requestAnimationFrame(step);
}
