"""Local preview server that never lets the browser cache files.

    python3 scripts/serve.py [port]

Serves the repository root, the main portfolio (default port 4184), so edits show up on reload.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4184
    folder = Path(__file__).resolve().parent.parent
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(NoCacheHandler, directory=str(folder)))
    print(f"Serving {folder} at http://localhost:{port}/")
    server.serve_forever()
