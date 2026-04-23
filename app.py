import os
from flask import Flask

from api_routes import api_bp
from web_routes import web_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.register_blueprint(web_bp)
    app.register_blueprint(api_bp)
    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 80))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
