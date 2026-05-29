(() => {
	const renderSinglePage = () => {
		document.body.className = "single-page-body";
		document.body.innerHTML = [
			'<main class="single-page-shell">',
			'<h1 class="single-page-title">is this better</h1>',
			"</main>"
		].join("");
		document.documentElement.classList.remove("single-page-pending");
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", renderSinglePage, { once: true });
	} else {
		renderSinglePage();
	}

	if ("serviceWorker" in navigator) {
		window.addEventListener(
			"load",
			() => {
				navigator.serviceWorker.register("/sw.js").catch(() => {});
			},
			{ once: true }
		);
	}
})();