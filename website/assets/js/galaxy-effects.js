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

	document.body.classList.add("shooting-star-cursor-enabled");

	const star = document.createElement("div");
	star.className = "shooting-star-cursor";
	const gradientId = `shooting-star-gradient-${Math.random().toString(36).slice(2, 10)}`;
	star.innerHTML = `
		<svg class="shooting-star-trail" aria-hidden="true">
			<defs>
				<linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse">
					<stop offset="0%" stop-color="#a0dcff" stop-opacity="0"></stop>
					<stop offset="82%" stop-color="#a0dcff" stop-opacity="0.45"></stop>
					<stop offset="100%" stop-color="#ffffff" stop-opacity="0.95"></stop>
				</linearGradient>
			</defs>
			<path class="shooting-star-trail-path"></path>
		</svg>
		<div class="shooting-star-head"></div>
	`;
	document.body.appendChild(star);

	const trailSvg = star.querySelector(".shooting-star-trail");
	const trailPath = star.querySelector(".shooting-star-trail-path");
	const gradient = star.querySelector("linearGradient");
	const gradientStops = Array.from(star.querySelectorAll("stop"));
	const head = star.querySelector(".shooting-star-head");

	let pointerX = -120;
	let pointerY = -120;
	let currentX = -120;
	let currentY = -120;
	let lastX = -120;
	let lastY = -120;
	let trailPoints = [];
	let visible = false;
	let frameId = 0;
	let hideTimer = 0;
	let tailDecayFrames = 0;
	let hasPointerSample = false;

	const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
	const resetTrail = () => {
		trailPoints = [];
		tailDecayFrames = 0;
		trailPath.setAttribute("d", "");
	};
	const syncPointerState = (x, y) => {
		pointerX = x;
		pointerY = y;
		currentX = x;
		currentY = y;
		lastX = x;
		lastY = y;
		trailPoints = [{ x, y }];
		tailDecayFrames = 0;
		hasPointerSample = true;
	};
	const midpoint = (pointA, pointB) => ({
		x: (pointA.x + pointB.x) / 2,
		y: (pointA.y + pointB.y) / 2,
	});
	const buildTrailPath = (points) => {
		if (points.length < 2) {
			return "";
		}

		let pathData = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

		for (let index = 1; index < points.length - 1; index += 1) {
			const control = points[index];
			const end = midpoint(control, points[index + 1]);
			pathData += ` Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
		}

		const tail = points[points.length - 1];
		pathData += ` Q ${points[points.length - 2].x.toFixed(1)} ${points[points.length - 2].y.toFixed(1)} ${tail.x.toFixed(1)} ${tail.y.toFixed(1)}`;

		return pathData;
	};
	const updateTrailViewport = () => {
		trailSvg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
	};

	trailPath.setAttribute("stroke", `url(#${gradientId})`);
	updateTrailViewport();

	const tick = () => {
		frameId = 0;

		if (!hasPointerSample) {
			return;
		}

		currentX += (pointerX - currentX) * 0.12;
		currentY += (pointerY - currentY) * 0.12;

		const deltaX = currentX - lastX;
		const deltaY = currentY - lastY;
		const speed = Math.hypot(deltaX, deltaY);
		const isMoving = speed > 0.12;
		const trailPointLimit = Math.round(clamp(speed * 2.2 + 12, 12, 56));
		const glow = clamp(speed / 18, 0, 1);
		const strokeWidth = 1.4 + glow * 1.9;

		if (isMoving) {
			trailPoints.unshift({ x: currentX, y: currentY });
			trailPoints = trailPoints.slice(0, trailPointLimit);
			tailDecayFrames = 0;
		} else if (trailPoints.length > 1) {
			tailDecayFrames += 1;
			if (tailDecayFrames >= 4) {
				trailPoints.pop();
				tailDecayFrames = 0;
			}
		}

		const tailStrength = clamp((trailPoints.length - 1) / 22, 0, 1);
		const visibleStrength = Math.max(glow, tailStrength * 0.7);

		const headPoint = trailPoints[0] || { x: currentX, y: currentY };
		const tailPoint = trailPoints[trailPoints.length - 1] || headPoint;

		trailPath.setAttribute("d", buildTrailPath(trailPoints));
		trailPath.setAttribute("stroke-width", strokeWidth.toFixed(2));
		gradient.setAttribute("x1", tailPoint.x.toFixed(1));
		gradient.setAttribute("y1", tailPoint.y.toFixed(1));
		gradient.setAttribute("x2", headPoint.x.toFixed(1));
		gradient.setAttribute("y2", headPoint.y.toFixed(1));
		gradientStops[1].setAttribute("stop-opacity", (visibleStrength * 0.42).toFixed(3));
		gradientStops[2].setAttribute("stop-opacity", clamp(0.2 + visibleStrength * 0.75, 0, 1).toFixed(3));
		head.style.transform = `translate3d(${(currentX - 4).toFixed(1)}px, ${(currentY - 4).toFixed(1)}px, 0)`;
		star.style.opacity = visible || trailPoints.length > 1 || visibleStrength > 0.02 ? "1" : "0";

		lastX = currentX;
		lastY = currentY;

		if (visible || speed > 0.08 || trailPoints.length > 1) {
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
		if (!hasPointerSample) {
			syncPointerState(event.clientX, event.clientY);
		} else {
			pointerX = event.clientX;
			pointerY = event.clientY;
		}
		show();
		start();
	}, { passive: true });

	window.addEventListener("pointerdown", (event) => {
		if (!hasPointerSample) {
			syncPointerState(event.clientX, event.clientY);
		} else {
			pointerX = event.clientX;
			pointerY = event.clientY;
		}
		show();
		star.classList.add("shooting-star-cursor-active");
		window.setTimeout(() => star.classList.remove("shooting-star-cursor-active"), 180);
		start();
	}, { passive: true });

	window.addEventListener("scroll", hideSoon, { passive: true });
	window.addEventListener("resize", updateTrailViewport, { passive: true });

	window.addEventListener("pointerleave", () => {
		visible = false;
		resetTrail();
		start();
	});

	document.addEventListener("visibilitychange", () => {
		if (document.hidden) {
			visible = false;
			resetTrail();
			star.style.opacity = "0";
		}
	});
})();