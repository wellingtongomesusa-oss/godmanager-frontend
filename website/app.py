import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

import base64
import csv
import io
import re
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask_sqlalchemy import SQLAlchemy
from flask_session import Session
import bcrypt
from urllib.parse import urlparse

import requests as req

# Initialize extensions
db = SQLAlchemy()
sess = Session()


def hash_password(raw_password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(raw_password.encode("utf-8"), salt).decode("utf-8")


def is_password_strong(password: str) -> bool:
    """Validate password strength."""
    if len(password) < 8:
        return False
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(not c.isalnum() for c in password)
    return has_upper and has_lower and has_digit and has_special


def generate_session_token() -> str:
    """Generate secure session token."""
    import secrets
    return secrets.token_urlsafe(32)


def login_required(f):
    """Decorator to require login."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Decorator to require admin privileges."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id:
            return redirect(url_for("login"))
        user = User.query.get(user_id)
        if not user or not user.is_admin:
            flash("Access denied. Admin privileges required.", "danger")
            return redirect(url_for("index"))
        return f(*args, **kwargs)
    return decorated_function


# Database Models
class User(db.Model):
    __tablename__ = "users"
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(80))
    last_name = db.Column(db.String(80))
    is_admin = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)
    email_verified = db.Column(db.Boolean, default=False)
    two_factor_enabled = db.Column(db.Boolean, default=False)
    two_factor_secret = db.Column(db.String(255), nullable=True)

    def __repr__(self):
        return f"<User {self.username}>"


class UserSession(db.Model):
    __tablename__ = "user_sessions"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_token = db.Column(db.String(255), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)

    user = db.relationship("User", backref="sessions")


class AccountRequest(db.Model):
    __tablename__ = "account_requests"
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    status = db.Column(db.String(20), default="pending", index=True)
    admin_notes = db.Column(db.Text)
    processed_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    processed_at = db.Column(db.DateTime)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)


def create_app():
    """Application factory."""
    app = Flask(__name__)
    
    # Configuration
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL",
        "postgresql://user:password@db:5432/secure_website"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    
    # Redis session configuration
    redis_url = os.getenv("REDIS_URI", "")
    if redis_url:
        app.config["SESSION_TYPE"] = "redis"
        app.config["SESSION_REDIS"] = redis_url
    else:
        app.config["SESSION_TYPE"] = "filesystem"
        app.config["SESSION_REDIS"] = None
    app.config["SESSION_COOKIE_SECURE"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_PERMANENT"] = False
    
    # Initialize extensions
    db.init_app(app)
    sess.init_app(app)
    
    # Register routes
    register_routes(app)
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    return app


def _normalize_source(s):
    if not s: return ""
    return re.sub(r'\s+', ' ', str(s).strip())

def _parse_agencia_date(val):
    if not val: return None
    s = str(val).strip()
    if not s: return None
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError: continue
    return None

def _parse_agencia_number(val):
    if val is None or val == '': return Decimal('0')
    s = str(val).strip().replace(',', '').replace(' ', '')
    s = re.sub(r'[^\d.\-]', '', s)
    try: return Decimal(s) if s else Decimal('0')
    except: return Decimal('0')

def _format_agencia_currency(val):
    if val is None: return "$ 0,00"
    d = float(val)
    s = f"{d:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"$ {s}"

def get_client_ip():
    """Get client IP address."""
    if request.headers.get("X-Forwarded-For"):
        return request.headers.get("X-Forwarded-For").split(",")[0].strip()
    return request.remote_addr or "unknown"


def get_user_agent():
    """Get user agent string."""
    return request.headers.get("User-Agent", "unknown")


def current_user():
    """Get current logged-in user."""
    user_id = session.get("user_id")
    if not user_id:
        return None
    return User.query.get(user_id)


def register_routes(app):
    """Register all application routes."""
    
    @app.route("/")
    def index():
        user = current_user()
        return render_template("index.html", user=user)
    
    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            username = request.form.get("username", "").strip().lower()
            password = request.form.get("password", "")
            
            user = User.query.filter_by(username=username).first()
            if user and user.is_active:
                if bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8")):
                    session["user_id"] = user.id
                    user.last_login = datetime.utcnow()
                    user.failed_login_attempts = 0
                    db.session.commit()
                    flash("Login successful!", "success")
                    return redirect(url_for("dashboard"))
            
            flash("Invalid username or password", "danger")
        
        return render_template("login.html")
    
    @app.route("/logout")
    @login_required
    def logout():
        session.clear()
        flash("You have been logged out.", "info")
        return redirect(url_for("index"))
    
    @app.route("/check_username", methods=["GET"])
    def check_username():
        """AJAX endpoint to check username availability."""
        username = request.args.get("username", "").strip().lower()
        if not username:
            return jsonify({"available": False})
        
        exists = User.query.filter_by(username=username).first() is not None
        return jsonify({"available": not exists})

    @app.route("/api/ramp/transactions")
    def ramp_transactions():
        client_id = os.environ.get("RAMP_CLIENT_ID")
        client_secret = os.environ.get("RAMP_CLIENT_SECRET")
        if not client_id or not client_secret:
            return jsonify({"error": "Ramp credentials not configured"}), 500
        creds = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        token_res = req.post(
            "https://api.ramp.com/developer/v1/token",
            headers={
                "Authorization": f"Basic {creds}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials", "scope": "transactions:read"},
        )
        token = token_res.json().get("access_token")
        params = {"page_size": 100}
        from_date = request.args.get("from_date")
        if from_date:
            params["from_date"] = from_date
        tx_res = req.get(
            "https://api.ramp.com/developer/v1/transactions",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
        )
        return jsonify(tx_res.json())

    @app.route("/api/ramp/cards")
    def ramp_cards():
        client_id = os.environ.get("RAMP_CLIENT_ID")
        client_secret = os.environ.get("RAMP_CLIENT_SECRET")
        if not client_id or not client_secret:
            return jsonify({"error": "Ramp credentials not configured"}), 500
        creds = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        token_res = req.post(
            "https://api.ramp.com/developer/v1/token",
            headers={
                "Authorization": f"Basic {creds}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials", "scope": "cards:read"},
        )
        token = token_res.json().get("access_token")
        cr_res = req.get(
            "https://api.ramp.com/developer/v1/cards",
            headers={"Authorization": f"Bearer {token}"},
            params={"page_size": 100},
        )
        return jsonify(cr_res.json())
    
    @app.route("/request_account", methods=["POST"])
    def request_account():
        """Handle account request submission."""
        username = request.form.get("username", "").strip().lower()
        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")
        
        # Validation
        if not username or not first_name or not last_name or not email or not password:
            flash("All fields are required.", "danger")
            return redirect(url_for("login"))
        
        if password != confirm_password:
            flash("Passwords do not match.", "danger")
            return redirect(url_for("login"))
        
        if not is_password_strong(password):
            flash("Password does not meet strength requirements.", "danger")
            return redirect(url_for("login"))
        
        if User.query.filter_by(username=username).first():
            flash("Username already exists.", "danger")
            return redirect(url_for("login"))
        
        if User.query.filter_by(email=email).first():
            flash("Email already registered.", "danger")
            return redirect(url_for("login"))
        
        # Create account request
        request_obj = AccountRequest(
            username=username,
            first_name=first_name,
            last_name=last_name,
            email=email,
            password_hash=hash_password(password),
            ip_address=get_client_ip(),
            user_agent=get_user_agent(),
            status="pending"
        )
        
        db.session.add(request_obj)
        db.session.commit()
        
        flash("Account request submitted successfully. An admin will review your request.", "success")
        return redirect(url_for("login"))
    
    @app.route("/dashboard")
    @login_required
    def dashboard():
        user = current_user()
        return render_template("dashboard.html", user=user)
    
    @app.route("/admin")
    @admin_required
    def admin():
        user = current_user()
        pending_requests = AccountRequest.query.filter_by(status="pending").order_by(AccountRequest.created_at.desc()).all()
        users = User.query.order_by(User.created_at.desc()).all()
        return render_template("admin.html", user=user, pending=pending_requests, users=users)
    
    @app.route("/admin/users")
    @admin_required
    def admin_users():
        user = current_user()
        users = User.query.order_by(User.created_at.desc()).all()
        return render_template("admin_users.html", user=user, users=users)
    
    @app.route("/admin/approve_request/<int:request_id>", methods=["POST"])
    @admin_required
    def approve_request(request_id):
        request_obj = AccountRequest.query.get_or_404(request_id)
        if request_obj.status != "pending":
            flash("Request already processed.", "warning")
            return redirect(url_for("admin"))
        
        # Check if username already exists
        if User.query.filter_by(username=request_obj.username).first():
            flash("Username already exists. Cannot approve request.", "danger")
            request_obj.status = "rejected"
            db.session.commit()
            return redirect(url_for("admin"))
        
        # Create user account
        new_user = User(
            username=request_obj.username,
            email=request_obj.email,
            password_hash=request_obj.password_hash,
            first_name=request_obj.first_name,
            last_name=request_obj.last_name,
            is_admin=False,
            is_active=True,
            email_verified=True
        )
        
        db.session.add(new_user)
        request_obj.status = "approved"
        request_obj.processed_by = current_user().id
        request_obj.processed_at = datetime.utcnow()
        db.session.commit()
        
        flash("Account request approved successfully.", "success")
        return redirect(url_for("admin"))
    
    @app.route("/admin/reject_request/<int:request_id>", methods=["POST"])
    @admin_required
    def reject_request(request_id):
        request_obj = AccountRequest.query.get_or_404(request_id)
        if request_obj.status != "pending":
            flash("Request already processed.", "warning")
            return redirect(url_for("admin"))
        
        request_obj.status = "rejected"
        request_obj.processed_by = current_user().id
        request_obj.processed_at = datetime.utcnow()
        db.session.commit()
        
        flash("Account request rejected.", "info")
        return redirect(url_for("admin"))
    
    @app.route("/admin/create_user", methods=["POST"])
    @admin_required
    def create_user():
        username = request.form.get("username", "").strip().lower()
        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        is_admin = bool(request.form.get("is_admin"))
        
        # Validation
        if not username or not email or not password:
            flash("Username, email, and password are required.", "danger")
            return redirect(url_for("admin_users"))
        
        if not is_password_strong(password):
            flash("Password does not meet strength requirements.", "danger")
            return redirect(url_for("admin_users"))
        
        if User.query.filter_by(username=username).first():
            flash("Username already exists.", "danger")
            return redirect(url_for("admin_users"))
        
        if User.query.filter_by(email=email).first():
            flash("Email already registered.", "danger")
            return redirect(url_for("admin_users"))
        
        # Create user
        new_user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            is_admin=is_admin,
            is_active=True,
            email_verified=True
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        flash("User created successfully.", "success")
        return redirect(url_for("admin_users"))
    
    @app.route("/admin/update_user/<int:user_id>", methods=["POST"])
    @admin_required
    def update_user(user_id):
        user = User.query.get_or_404(user_id)
        
        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "").strip()
        is_admin = bool(request.form.get("is_admin"))
        is_active = bool(request.form.get("is_active"))
        
        # Update fields (username is read-only)
        user.first_name = first_name
        user.last_name = last_name
        user.email = email
        user.is_admin = is_admin
        user.is_active = is_active
        
        # Update password if provided
        if password:
            if not is_password_strong(password):
                flash("Password does not meet strength requirements.", "danger")
                return redirect(url_for("admin_users"))
            user.password_hash = hash_password(password)
        
        # Check email uniqueness
        existing = User.query.filter_by(email=email).first()
        if existing and existing.id != user.id:
            flash("Email already registered to another user.", "danger")
            return redirect(url_for("admin_users"))
        
        db.session.commit()
        flash("User updated successfully.", "success")
        return redirect(url_for("admin_users"))
    
    @app.route("/admin/delete_user/<int:user_id>", methods=["POST"])
    @admin_required
    def delete_user(user_id):
        user = User.query.get_or_404(user_id)
        
        # Prevent deleting yourself
        if user.id == current_user().id:
            flash("You cannot delete your own account.", "danger")
            return redirect(url_for("admin_users"))
        
        db.session.delete(user)
        db.session.commit()
        
        flash("User deleted successfully.", "success")
        return redirect(url_for("admin_users"))


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
