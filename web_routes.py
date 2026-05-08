import os
from flask import Blueprint, render_template, send_from_directory, abort

web_bp = Blueprint("web", __name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


@web_bp.route("/")
def index():
    return render_template("index.html")



@web_bp.route("/data/<path:filename>")
def serve_data(filename):
    """Serve static JSON data files from the /data folder."""
    if not os.path.isfile(os.path.join(DATA_DIR, filename)):
        abort(404)
    return send_from_directory(DATA_DIR, filename)
