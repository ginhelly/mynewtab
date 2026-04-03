#!/usr/bin/env python3
import http.server
import socketserver
import os
from socketserver import ThreadingMixIn

PORT = 8000

class ThreadingTCPServer(ThreadingMixIn, socketserver.TCPServer):
    """Многопоточный TCP сервер"""
    allow_reuse_address = True
    daemon_threads = True

class CORSHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def log_message(self, format, *args):
        # Уменьшаем шум в консоли
        if args[0] != 'GET' or (args[1] != '/favicon.ico' and not args[1].endswith('.webp')):
            print(f"[{self.address_string()}] {args[0]} {args[1]} - {args[2]}")

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with ThreadingTCPServer(("", PORT), CORSHandler) as httpd:
    print(f"Сервер на http://localhost:{PORT}")
    print("Многопоточный режим включен")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен")