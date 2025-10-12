import time
import json
from flask import Blueprint, Response, session
import threading

events_bp = Blueprint('events', __name__, url_prefix='/events')

file_event_queue, admin_event_queue, user_event_queues = [], [], {}
file_event_lock, admin_event_lock, user_event_lock = threading.Lock(), threading.Lock(), threading.Lock()

def add_event(queue, lock, event, max_size=50):
    with lock:
        queue.append(event)
        if len(queue) > max_size:
            queue.pop(0)

def add_file_event(event_type, file_data=None):
    add_event(file_event_queue, file_event_lock, {'type': event_type, 'file': file_data, 'timestamp': time.time()})

def add_admin_event(event_type, data=None):
    add_event(admin_event_queue, admin_event_lock, {'type': event_type, 'data': data, 'timestamp': time.time()})

def add_user_event(username, event_type, data=None):
    with user_event_lock:
        if username not in user_event_queues:
            user_event_queues[username] = []
        add_event(user_event_queues[username], threading.Lock(), {'type': event_type, 'data': data, 'timestamp': time.time()}, 10)

@events_bp.route('/')
def stream():
    if 'logged_in' not in session:
        return Response(status=204)

    username = session.get('username')
    is_admin = session.get('permissions') == 'admin'

    def generate():
        last_checks = {'file': time.time(), 'admin': time.time(), 'user': time.time()}
        try:
            while True:
                with file_event_lock:
                    file_events = [e for e in file_event_queue if e['timestamp'] > last_checks['file']]
                if file_events:
                    last_checks['file'] = time.time()
                    for event in file_events:
                        yield f"data: {json.dumps(event)}\n\n"
                
                if is_admin:
                    with admin_event_lock:
                        admin_events = [e for e in admin_event_queue if e['timestamp'] > last_checks['admin']]
                    if admin_events:
                        last_checks['admin'] = time.time()
                        for event in admin_events:
                            yield f"data: {json.dumps(event)}\n\n"

                if username:
                    with user_event_lock:
                        user_queue = user_event_queues.get(username, [])
                        user_events = [e for e in user_queue if e['timestamp'] > last_checks['user']]
                    if user_events:
                        last_checks['user'] = time.time()
                        for event in user_events:
                            yield f"data: {json.dumps(event)}\n\n"
                
                time.sleep(1)
        except GeneratorExit:
            pass

    return Response(generate(), mimetype="text/event-stream")