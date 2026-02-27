import os
import json
import urllib.error
import urllib.request

def _to_percent(value) -> float:
    if value is None:
        return 100.0

    if isinstance(value, str):
        cleaned = value.strip().replace("%", "")
        if not cleaned:
            return 100.0
        parsed = float(cleaned)
    else:
        parsed = float(value)

    if 0 <= parsed <= 1:
        return parsed * 100

    return parsed


def getEarnings(room_token: str) -> int:
    token = os.getenv("RECROOMACCESSTOKEN") or os.getenv("RecRoomAccessToken")
    if not token:
        raise RuntimeError("RECROOMACCESSTOKEN (or RecRoomAccessToken) not set")

    token = token.strip()

    url = f"https://data.rec.net/commonQuery/creatorstats/roomDetailsRoomTokenMetrics/{room_token}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
    }

    req = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            metrics = json.loads(resp.read().decode())
    except urllib.error.HTTPError as error:
        message = error.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {error.code} for room token {room_token}: {message}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Network error for room token {room_token}: {error.reason}") from error

    if not isinstance(metrics, list):
        raise RuntimeError(f"Unexpected earnings payload for room token {room_token}: {metrics}")

    total = 0
    for item in metrics:
        if not isinstance(item, dict):
            continue
        room_total = int(item.get("all_time_tokens_earned", 0))
        distribution_percent = _to_percent(item.get("earnings_distribution"))
        my_earned = round(room_total * (distribution_percent / 100))
        total += int(my_earned)

    return int(total)