import os
import json as _json
from flask import Flask, jsonify

from api_routes import api_bp
from web_routes import web_bp

_APP_DIR = os.path.dirname(os.path.abspath(__file__))


def create_app() -> Flask:
    app = Flask(__name__)
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.register_blueprint(web_bp)
    app.register_blueprint(api_bp)

    @app.route("/api/points-table")
    def points_table():
        path = os.path.join(_APP_DIR, "data", "points-table.json")
        if not os.path.isfile(path):
            return jsonify({"error": "not found", "years": [], "tables": {}}), 404
        with open(path, encoding="utf-8") as f:
            return jsonify(_json.load(f))

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 80))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
