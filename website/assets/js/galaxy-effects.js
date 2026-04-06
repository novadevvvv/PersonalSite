(function () {
	const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const finePointer = window.matchMedia("(pointer: fine)");
	const hoverPointer = window.matchMedia("(hover: hover)");
	const largeScreen = window.matchMedia("(min-width: 992px)");
	const saveData = navigator.connection && navigator.connection.saveData;
	const lowPowerCpu = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
	const allowEnhancedEffects = !prefersReducedMotion.matches && !saveData && !lowPowerCpu && largeScreen.matches;

	if (allowEnhancedEffects) {
		document.body.classList.add("galaxy-enhanced");
	}

	if (!allowEnhancedEffects || !finePointer.matches || !hoverPointer.matches) {
		return;
	}

	const star = document.createElement("div");
	star.className = "shooting-star-cursor";
	document.body.appendChild(star);

	let pointerX = -120;
	let pointerY = -120;
	let currentX = -120;
	let currentY = -120;
	let lastX = -120;
	let lastY = -120;
	let visible = false;
	let frameId = 0;
	let hideTimer = 0;

	const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

	const tick = () => {
		frameId = 0;

		currentX += (pointerX - currentX) * 0.2;
		currentY += (pointerY - currentY) * 0.2;

		const deltaX = currentX - lastX;
		const deltaY = currentY - lastY;
		const speed = Math.hypot(deltaX, deltaY);
		const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
		const trailScale = clamp(speed / 18, 0.25, 1);
		const glow = clamp(0.45 + speed / 24, 0.45, 1);

		star.style.setProperty("--trail-scale", trailScale.toFixed(3));
		star.style.setProperty("--trail-opacity", glow.toFixed(3));
		star.style.transform = `translate3d(${currentX - 88}px, ${currentY - 9}px, 0) rotate(${angle}deg)`;
		star.style.opacity = visible ? "1" : "0";

		lastX = currentX;
		lastY = currentY;

		if (visible || speed > 0.08) {
			frameId = window.requestAnimationFrame(tick);
		}
	};

	const start = () => {
		if (!frameId) {
			frameId = window.requestAnimationFrame(tick);
		}
	};

	const show = () => {
		visible = true;
		window.clearTimeout(hideTimer);
	};

	const hideSoon = () => {
		window.clearTimeout(hideTimer);
		hideTimer = window.setTimeout(() => {
			visible = false;
			start();
		}, 90);
	};

	window.addEventListener("pointermove", (event) => {
		pointerX = event.clientX;
		pointerY = event.clientY;
		show();
		start();
	}, { passive: true });

	window.addEventListener("pointerdown", (event) => {
		pointerX = event.clientX;
		pointerY = event.clientY;
		show();
		star.classList.add("shooting-star-cursor-active");
		window.setTimeout(() => star.classList.remove("shooting-star-cursor-active"), 180);
		start();
	}, { passive: true });

	window.addEventListener("scroll", hideSoon, { passive: true });

	window.addEventListener("pointerleave", () => {
		visible = false;
		start();
	});

	document.addEventListener("visibilitychange", () => {
		if (document.hidden) {
			visible = false;
			star.style.opacity = "0";
		}
	});
})();