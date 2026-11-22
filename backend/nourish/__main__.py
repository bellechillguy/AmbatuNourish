import logging
import os
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server

from .api import create_app


class ThreadedServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True


class RequestHandler(WSGIRequestHandler):
    def log_message(self, *_):
        # Application emits structured logs without query strings or credentials.
        pass


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    host, port = os.getenv('NOURISH_HOST', '127.0.0.1'), int(os.getenv('NOURISH_PORT', '8081'))
    with make_server(host, port, create_app(), server_class=ThreadedServer, handler_class=RequestHandler) as server:
        logging.getLogger('ambatunourish').info('AmbatuNourish listening on %s:%s', host, port)
        server.serve_forever()
