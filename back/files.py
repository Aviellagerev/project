import os
import json
from datetime import datetime
from flask import (
    Blueprint, request, jsonify, send_from_directory, current_app, session, render_template
)
from .auth import login_required, permission_required
from .events import add_file_event
from .utils import get_file_list

files_bp = Blueprint('files', __name__, url_prefix='/files')

@files_bp.route('/')
@login_required
def file_manager():
    files = get_file_list(current_app.config['UPLOAD_FOLDER'])
    return render_template('index.html',
                           files=files,
                           user_name=session.get('username'),
                           logged_in=True,
                           permissions=session.get('permissions', ''))

@files_bp.route('/download/<path:filename>')
@login_required
@permission_required('read')
def download_file(filename):
    # **THE FIX**: Use an absolute path to the upload folder
    upload_folder = os.path.abspath(current_app.config['UPLOAD_FOLDER'])
    return send_from_directory(upload_folder, filename, as_attachment=True)

@files_bp.route('/upload', methods=['POST'])
@login_required
@permission_required('write')
def upload():
    if 'file' not in request.files: return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'error': 'No selected file'}), 400
    if file:
        filename = os.path.basename(file.filename)
        # Use an absolute path to save the file as well, ensuring consistency
        upload_folder = os.path.abspath(current_app.config['UPLOAD_FOLDER'])
        filepath = os.path.join(upload_folder, filename)
        
        file.save(filepath)
        meta = {"uploader": session['username'], "upload_time": datetime.now().isoformat()}
        with open(f"{filepath}.meta.json", 'w') as f: json.dump(meta, f)
        
        file_data = {"filename": filename, "upload_time": meta["upload_time"], "size": os.path.getsize(filepath), "uploader": session.get('username')}
        add_file_event('file_added', file_data)
        return jsonify(file_data), 201
    return jsonify({'error': 'Invalid file'}), 400

@files_bp.route('/delete/<path:filename>', methods=['DELETE'])
@login_required
@permission_required('delete')
def delete_file(filename):
    # Use an absolute path here for consistency
    upload_folder = os.path.abspath(current_app.config['UPLOAD_FOLDER'])
    file_path = os.path.join(upload_folder, filename)
    
    if os.path.exists(file_path):
        os.remove(file_path)
        meta_path = f"{file_path}.meta.json"
        if os.path.exists(meta_path): os.remove(meta_path)
        add_file_event('file_deleted', {'filename': filename})
        return jsonify({"success": True})
    return jsonify({"error": "File not found"}), 404