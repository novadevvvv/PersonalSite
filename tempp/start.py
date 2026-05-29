import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import uuid

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

HTML = """
<!doctype html>
<html>
<head><title>Uploader</title></head>
<body>
    <h2>Upload files</h2>
    <form method="POST" enctype="multipart/form-data">
        <input name="files" type="file" multiple>
        <button type="submit">Upload</button>
    </form>
</body>
</html>
"""

def parse_multipart(body, boundary):
    boundary = b"--" + boundary
    parts = body.split(boundary)

    files = []

    for part in parts:
        if b"Content-Disposition" not in part:
            continue

        try:
            headers, content = part.split(b"\r\n\r\n", 1)
        except ValueError:
            continue

        content = content.rstrip(b"\r\n--")

        # Extract filename
        filename = None
        for line in headers.split(b"\r\n"):
            if b"filename=" in line:
                filename = line.split(b"filename=")[1].strip(b'"')

        if filename:
            files.append((filename.decode(errors="ignore"), content))

    return files


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        self.wfile.write(HTML.encode())

    def do_POST(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self.send_error(400, "Invalid form")
            return

        boundary = content_type.split("boundary=")[-1].encode()

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        files = parse_multipart(body, boundary)

        if not files:
            self.send_error(400, "No files uploaded")
            return

        for original_name, data in files:
            safe_name = original_name or f"upload_{uuid.uuid4().hex}"
            path = os.path.join(UPLOAD_DIR, safe_name)

            counter = 1
            base, ext = os.path.splitext(safe_name)
            final_path = path

            while os.path.exists(final_path):
                final_path = os.path.join(UPLOAD_DIR, f"{base}_{counter}{ext}")
                counter += 1

            with open(final_path, "wb") as f:
                f.write(data)

        self.send_response(303)
        self.send_header("Location", "/")
        self.end_headers()


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 5000), Handler)
    print("Running on http://localhost:5000")
    server.serve_forever()