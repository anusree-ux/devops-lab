import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import mysql.connector
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_UPLOAD_BYTES", 50 * 1024 * 1024))
CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})


def db_config():
    return {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "file_manager"),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", "file_manager"),
    }


def connection():
    return mysql.connector.connect(**db_config())


def init_db():
    conn = connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """CREATE TABLE IF NOT EXISTS files (
                id CHAR(36) PRIMARY KEY,
                original_name VARCHAR(255) NOT NULL,
                stored_name VARCHAR(255) NOT NULL UNIQUE,
                mime_type VARCHAR(255) NOT NULL,
                size BIGINT UNSIGNED NOT NULL,
                uploaded_at DATETIME NOT NULL
            )"""
        )
        conn.commit()
    finally:
        conn.close()


def file_json(row):
    return {
        "id": row[0],
        "name": row[1],
        "mimeType": row[2],
        "size": row[3],
        "uploadedAt": row[4].replace(tzinfo=timezone.utc).isoformat() if row[4] else None,
        "viewUrl": f"/api/files/{row[0]}/view",
        "downloadUrl": f"/api/files/{row[0]}/download",
    }


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "file-manager"})


@app.get("/api/db-status")
def db_status():
    try:
        conn = connection()
        conn.close()
        return jsonify({"status": "ok"})
    except mysql.connector.Error as exc:
        return jsonify({"status": "error", "message": str(exc)}), 503


@app.get("/api/files")
def list_files():
    try:
        conn = connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, original_name, mime_type, size, uploaded_at "
            "FROM files ORDER BY uploaded_at DESC"
        )
        files = [file_json(row) for row in cur.fetchall()]
        conn.close()
        return jsonify(files)
    except mysql.connector.Error as exc:
        return jsonify({"error": "Unable to list files", "detail": str(exc)}), 503


@app.post("/api/files")
def upload_file():
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "A file is required"}), 400
    original_name = secure_filename(uploaded.filename)
    if not original_name:
        return jsonify({"error": "Invalid filename"}), 400
    file_id = str(uuid.uuid4())
    extension = Path(original_name).suffix
    stored_name = f"{file_id}{extension}"
    target = UPLOAD_DIR / stored_name
    uploaded.save(target)
    try:
        conn = connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO files (id, original_name, stored_name, mime_type, size, uploaded_at) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (file_id, original_name, stored_name, uploaded.mimetype or "application/octet-stream",
             target.stat().st_size, datetime.now(timezone.utc).replace(tzinfo=None)),
        )
        conn.commit()
        cur.execute(
            "SELECT id, original_name, mime_type, size, uploaded_at FROM files WHERE id = %s",
            (file_id,),
        )
        result = file_json(cur.fetchone())
        conn.close()
        return jsonify(result), 201
    except mysql.connector.Error as exc:
        target.unlink(missing_ok=True)
        return jsonify({"error": "Unable to save file metadata", "detail": str(exc)}), 503


def find_file(file_id):
    conn = connection()
    cur = conn.cursor()
    cur.execute("SELECT id, original_name, stored_name, mime_type FROM files WHERE id = %s", (file_id,))
    row = cur.fetchone()
    conn.close()
    return row


@app.get("/api/files/<file_id>/<action>")
def serve_file(file_id, action):
    if action not in ("view", "download"):
        return jsonify({"error": "Not found"}), 404
    try:
        row = find_file(file_id)
    except mysql.connector.Error as exc:
        return jsonify({"error": "Database unavailable", "detail": str(exc)}), 503
    if not row:
        return jsonify({"error": "File not found"}), 404
    stored_name, original_name, mime_type = row[2], row[1], row[3]
    path = UPLOAD_DIR / stored_name
    if not path.is_file():
        return jsonify({"error": "File content not found"}), 404
    return send_from_directory(
        str(UPLOAD_DIR), stored_name, mimetype=mime_type,
        as_attachment=action == "download", download_name=original_name,
    )


@app.delete("/api/files/<file_id>")
def delete_file(file_id):
    try:
        row = find_file(file_id)
        if not row:
            return jsonify({"error": "File not found"}), 404
        conn = connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM files WHERE id = %s", (file_id,))
        conn.commit()
        conn.close()
        (UPLOAD_DIR / row[2]).unlink(missing_ok=True)
        return jsonify({"message": "File deleted"})
    except mysql.connector.Error as exc:
        return jsonify({"error": "Unable to delete file", "detail": str(exc)}), 503


@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": "File exceeds the configured upload limit"}), 413


if __name__ == "__main__":
    try:
        init_db()
    except mysql.connector.Error as exc:
        app.logger.warning("Database initialization skipped: %s", exc)
    app.run(host=os.getenv("FLASK_HOST", "0.0.0.0"), port=int(os.getenv("FLASK_PORT", "5000")), debug=False)
