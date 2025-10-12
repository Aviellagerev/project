from flask import Blueprint, request, jsonify, render_template, session
from .auth import login_required, permission_required
from .database import get_db
from .events import add_user_event, add_admin_event

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@admin_bp.route('/')
@login_required
@permission_required('admin')
def panel():
    return render_template('admin.html', user_name=session.get('username'))

@admin_bp.route('/api/users')
@login_required
@permission_required('admin')
def get_users():
    db = get_db()
    users = db.execute('SELECT id, username, permissions FROM users').fetchall()
    return jsonify([dict(user) for user in users])

@admin_bp.route('/api/update_permission', methods=['POST'])
@login_required
@permission_required('admin')
def update_permission():
    data = request.get_json()
    user_id, new_permission = data.get('id'), data.get('permission')
    if not user_id or new_permission not in ['read', 'write', 'delete', 'admin']:
        return jsonify({'error': 'Invalid data provided'}), 400
    db = get_db()
    user_to_edit = db.execute('SELECT username FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user_to_edit: return jsonify({'error': 'User not found'}), 404
    if user_to_edit['username'] == session.get('username'):
        return jsonify({'error': "Cannot change your own permissions."}), 403
    db.execute('UPDATE users SET permissions = ? WHERE id = ?', (new_permission, user_id))
    db.commit()
    add_user_event(user_to_edit['username'], 'permission_updated', {'new_permission': new_permission})
    return jsonify({'success': True})

@admin_bp.route('/api/delete_user/<int:user_id>', methods=['DELETE'])
@login_required
@permission_required('admin')
def delete_user(user_id):
    db = get_db()
    user_to_delete = db.execute('SELECT username FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user_to_delete: return jsonify({'error': 'User not found'}), 404
    if user_to_delete['username'] == session.get('username'):
        return jsonify({'error': "You cannot delete yourself."}), 403
    db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()
    add_admin_event('user_deleted', {'id': user_id})
    return jsonify({'success': True})