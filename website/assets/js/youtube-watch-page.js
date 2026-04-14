const form = document.getElementById('videoMetaForm');
const input = document.getElementById('videoUrlInput');
const status = document.getElementById('videoMetaStatus');
const card = document.getElementById('videoMetaCard');
const thumbnail = document.getElementById('videoMetaThumbnail');
const badge = document.getElementById('videoMetaBadge');
const heading = document.getElementById('videoMetaHeading');
const author = document.getElementById('videoMetaAuthor');
const description = document.getElementById('videoMetaDescription');
const videoIdField = document.getElementById('videoMetaId');
const videoLink = document.getElementById('videoMetaLink');
const embedLink = document.getElementById('videoMetaEmbed');
const resolvedAt = document.getElementById('videoMetaResolvedAt');

function setStatus(message, tone = 'neutral') {
	status.textContent = message;
	status.dataset.tone = tone;
}

function setCardHidden(hidden) {
	card.hidden = hidden;
}

function getVideoId(rawValue) {
	const value = String(rawValue ?? '').trim();
	if (!value) {
		return null;
	}

	try {
		const parsed = new URL(value);
		if (parsed.searchParams.get('v')) {
			return parsed.searchParams.get('v');
		}

		if (parsed.hostname === 'youtu.be') {
			return parsed.pathname.replace(/^\//, '').slice(0, 11) || null;
		}

		const shortsMatch = parsed.pathname.match(/^\/shorts\/([\w-]{11})/);
		if (shortsMatch) {
			return shortsMatch[1];
		}
	} catch {
		const directMatch = value.match(/(?:v=|be\/|shorts\/)([\w-]{11})/);
		if (directMatch) {
			return directMatch[1];
		}
	}

	return /^[\w-]{11}$/.test(value) ? value : null;
}

function buildYouTubeUrl(videoId) {
	return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function renderFallback(videoId) {
	const watchUrl = buildYouTubeUrl(videoId);
	thumbnail.src = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg`;
	thumbnail.alt = `Thumbnail for video ${videoId}`;
	badge.textContent = 'Fallback metadata';
	heading.textContent = 'Public metadata could not be fetched';
	author.textContent = 'This usually means the oEmbed endpoint did not return browser-readable data.';
	description.innerHTML = `The page still resolved the video ID and thumbnail. Open the original video or embed below.`;
	videoIdField.textContent = videoId;
	videoLink.href = watchUrl;
	embedLink.href = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
	resolvedAt.textContent = new Date().toLocaleString();
	setCardHidden(false);
	setStatus('Loaded basic video info from the URL.', 'success');
}

async function loadMetadata(videoId) {
	const watchUrl = buildYouTubeUrl(videoId);
	const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

	setStatus('Fetching public video metadata…');
	setCardHidden(true);

	try {
		const response = await fetch(endpoint, {
			headers: {
				accept: 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`Metadata request failed with ${response.status}`);
		}

		const payload = await response.json();
		thumbnail.src = payload.thumbnail_url || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
		thumbnail.alt = payload.title ? `Thumbnail for ${payload.title}` : `Thumbnail for video ${videoId}`;
		badge.textContent = payload.provider_name || 'YouTube';
		heading.textContent = payload.title || 'Untitled video';
		author.textContent = payload.author_name ? `By ${payload.author_name}` : 'Author unavailable';
		description.innerHTML = payload.html
			? `Embed HTML is available for this video. Use the link below to open the official embed.`
			: 'Public metadata resolved successfully.';
		videoIdField.textContent = videoId;
		videoLink.href = watchUrl;
		embedLink.href = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
		resolvedAt.textContent = new Date().toLocaleString();
		setCardHidden(false);
		setStatus('Video info loaded.', 'success');
	} catch (error) {
		console.error(error);
		renderFallback(videoId);
	}
}

function syncInputWithLocation() {
	const params = new URLSearchParams(window.location.search);
	const currentVideoId = params.get('v');
	if (currentVideoId) {
		input.value = buildYouTubeUrl(currentVideoId);
	}
}

async function handleSubmit(event) {
	event.preventDefault();
	const videoId = getVideoId(input.value);
	if (!videoId) {
		setStatus('Enter a valid YouTube video URL or 11-character video ID.', 'error');
		setCardHidden(true);
		return;
	}

	const url = new URL(window.location.href);
	url.searchParams.set('v', videoId);
	history.replaceState({}, '', url);
	await loadMetadata(videoId);
}

form?.addEventListener('submit', handleSubmit);

syncInputWithLocation();

const initialVideoId = new URLSearchParams(window.location.search).get('v');
if (initialVideoId) {
	loadMetadata(initialVideoId);
} else {
	setStatus('Ready. Paste a YouTube link to resolve its public info.');
	setCardHidden(true);
}