# Local preview server for the OmniVora site that tells the browser never to cache,
# so every reload shows the latest files:
#   python execution/serve.py        -> http://localhost:8765
import http.server, functools, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
http.server.ThreadingHTTPServer(('', port), functools.partial(NoCache, directory=ROOT)).serve_forever()
