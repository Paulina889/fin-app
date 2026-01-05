import os
import sqlite3
import uuid
from datetime import datetime, timedelta

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash
import jwt

DATABASE_PATH = os.environ.get("FIN_APP_DB", os.path.join(os.path.dirname(__file__), "fin_app.db"))
JWT_SECRET = os.environ.get("FIN_APP_SECRET", "dev-secret")
JWT_ISSUER = "fin-app"

app = Flask(__name__, static_folder="../frontend/static", template_folder="../frontend/templates")


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    side_hustle TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    category TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL NOT NULL,
    target_date TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS hold_items (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    added_date TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS priorities (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    month TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
"""


KNOWLEDGE_BASE = [
    {
        "title": "Oszczędzanie krok po kroku",
        "summary": "Tworzenie poduszki finansowej i planowanie wydatków.",
        "tags": ["oszczędzanie", "budżet"],
    },
    {
        "title": "Podstawy inwestowania",
        "summary": "Różnice między funduszami, obligacjami i akcjami.",
        "tags": ["inwestowanie"],
    },
    {
        "title": "Spłata długów z głową",
        "summary": "Metody śnieżnej kuli i lawiny oraz unikanie spirali zadłużenia.",
        "tags": ["długi"],
    },
    {
        "title": "Budżetowanie 50/30/20",
        "summary": "Model budżetu, który pomaga odzyskać kontrolę nad pieniędzmi.",
        "tags": ["budżetowanie"],
    },
]


def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.commit()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", ("demo@finapp.local",)).fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            ("demo@finapp.local", generate_password_hash("demo1234")),
        )
    conn.commit()
    conn.close()


def generate_token(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "iss": JWT_ISSUER,
        "exp": datetime.utcnow() + timedelta(hours=8),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_user_id_from_request():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "", 1)
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], issuer=JWT_ISSUER)
            return int(payload["sub"])
        except jwt.PyJWTError:
            return None
    return 1


@app.before_request
def ensure_db():
    if not os.path.exists(DATABASE_PATH):
        init_db()


@app.route("/")
def index():
    return send_from_directory(app.template_folder, "index.html")


@app.route("/api/knowledge")
def knowledge():
    return jsonify(KNOWLEDGE_BASE)


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(force=True)
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, generate_password_hash(password)),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email already registered"}), 400
    finally:
        conn.close()
    return jsonify({"token": generate_token(get_user_id_by_email(email))})


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    conn = get_db()
    user = conn.execute("SELECT id, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401
    return jsonify({"token": generate_token(user["id"]), "userId": user["id"]})


@app.route("/api/auth/change-password", methods=["POST"])
def change_password():
    user_id = get_user_id_from_request()
    data = request.get_json(force=True)
    current_password = data.get("currentPassword")
    new_password = data.get("newPassword")
    if not user_id or not current_password or not new_password:
        return jsonify({"error": "Unauthorized"}), 401
    conn = get_db()
    user = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], current_password):
        conn.close()
        return jsonify({"error": "Invalid credentials"}), 401
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (generate_password_hash(new_password), user_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})


def get_user_id_by_email(email: str) -> int:
    conn = get_db()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    return user["id"] if user else 1


@app.route("/api/transactions", methods=["GET", "POST"])
def transactions():
    user_id = get_user_id_from_request()
    if request.method == "POST":
        data = request.get_json(force=True)
        transaction_id = str(uuid.uuid4())
        conn = get_db()
        conn.execute(
            """
            INSERT INTO transactions (id, user_id, amount, type, category, description, date, side_hustle)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                transaction_id,
                user_id,
                float(data.get("amount", 0)),
                data.get("type", "expense"),
                data.get("category", "Inne"),
                data.get("description", ""),
                data.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
                data.get("sideHustle", ""),
            ),
        )
        conn.commit()
        conn.close()
        return jsonify({"id": transaction_id}), 201

    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC",
        (user_id,),
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route("/api/transactions/<transaction_id>", methods=["DELETE"])
def delete_transaction(transaction_id):
    user_id = get_user_id_from_request()
    conn = get_db()
    conn.execute(
        "DELETE FROM transactions WHERE id = ? AND user_id = ?",
        (transaction_id, user_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "deleted"})


@app.route("/api/events", methods=["GET", "POST"])
def events():
    user_id = get_user_id_from_request()
    if request.method == "POST":
        data = request.get_json(force=True)
        event_id = str(uuid.uuid4())
        conn = get_db()
        conn.execute(
            """
            INSERT INTO events (id, user_id, title, start_date, end_date, category)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                user_id,
                data.get("title", "Nowe wydarzenie"),
                data.get("start", datetime.utcnow().strftime("%Y-%m-%d")),
                data.get("end"),
                data.get("category", "Inne"),
            ),
        )
        conn.commit()
        conn.close()
        return jsonify({"id": event_id}), 201

    conn = get_db()
    rows = conn.execute(
        "SELECT id, title, start_date as start, end_date as end, category FROM events WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route("/api/categories")
def categories():
    user_id = get_user_id_from_request()
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT category FROM transactions WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    conn.close()
    categories_list = [row["category"] for row in rows]
    default_categories = ["Stałe", "Jedzenie", "Transport", "Oszczędności", "Inne"]
    return jsonify(sorted(set(categories_list + default_categories)))


@app.route("/api/goals", methods=["GET", "POST"])
def goals():
    user_id = get_user_id_from_request()
    if request.method == "POST":
        data = request.get_json(force=True)
        goal_id = str(uuid.uuid4())
        conn = get_db()
        conn.execute(
            """
            INSERT INTO goals (id, user_id, name, target_amount, current_amount, target_date)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                goal_id,
                user_id,
                data.get("name", "Cel oszczędnościowy"),
                float(data.get("targetAmount", 0)),
                float(data.get("currentAmount", 0)),
                data.get("targetDate", datetime.utcnow().strftime("%Y-%m-%d")),
            ),
        )
        conn.commit()
        conn.close()
        return jsonify({"id": goal_id}), 201

    conn = get_db()
    rows = conn.execute("SELECT * FROM goals WHERE user_id = ?", (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route("/api/hold-items", methods=["GET", "POST"])
def hold_items():
    user_id = get_user_id_from_request()
    if request.method == "POST":
        data = request.get_json(force=True)
        item_id = str(uuid.uuid4())
        conn = get_db()
        conn.execute(
            """
            INSERT INTO hold_items (id, user_id, name, price, added_date)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                item_id,
                user_id,
                data.get("name", "Nowy zakup"),
                float(data.get("price", 0)),
                data.get("addedDate", datetime.utcnow().strftime("%Y-%m-%d")),
            ),
        )
        conn.commit()
        conn.close()
        return jsonify({"id": item_id}), 201

    conn = get_db()
    rows = conn.execute("SELECT * FROM hold_items WHERE user_id = ?", (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route("/api/priorities", methods=["GET", "POST"])
def priorities():
    user_id = get_user_id_from_request()
    if request.method == "POST":
        data = request.get_json(force=True)
        item_id = str(uuid.uuid4())
        conn = get_db()
        conn.execute(
            """
            INSERT INTO priorities (id, user_id, title, month)
            VALUES (?, ?, ?, ?)
            """,
            (
                item_id,
                user_id,
                data.get("title", "Priorytet"),
                data.get("month", datetime.utcnow().strftime("%Y-%m")),
            ),
        )
        conn.commit()
        conn.close()
        return jsonify({"id": item_id}), 201

    conn = get_db()
    rows = conn.execute("SELECT * FROM priorities WHERE user_id = ?", (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route("/api/budgets", methods=["GET", "POST"])
def budgets():
    user_id = get_user_id_from_request()
    if request.method == "POST":
        data = request.get_json(force=True)
        budget_id = str(uuid.uuid4())
        conn = get_db()
        conn.execute(
            """
            INSERT INTO budgets (id, user_id, month, amount)
            VALUES (?, ?, ?, ?)
            """,
            (
                budget_id,
                user_id,
                data.get("month", datetime.utcnow().strftime("%Y-%m")),
                float(data.get("amount", 0)),
            ),
        )
        conn.commit()
        conn.close()
        return jsonify({"id": budget_id}), 201

    conn = get_db()
    rows = conn.execute("SELECT * FROM budgets WHERE user_id = ?", (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route("/api/summary")
def summary():
    user_id = get_user_id_from_request()
    conn = get_db()
    totals = conn.execute(
        """
        SELECT
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE user_id = ?
        """,
        (user_id,),
    ).fetchone()
    conn.close()
    income = totals["income"] or 0
    expense = totals["expense"] or 0
    return jsonify({"income": income, "expense": expense, "balance": income - expense})


@app.route("/api/analysis")
def analysis():
    user_id = get_user_id_from_request()
    conn = get_db()
    rows = conn.execute(
        """
        SELECT category, SUM(amount) as total
        FROM transactions
        WHERE user_id = ? AND type = 'expense'
        GROUP BY category
        """,
        (user_id,),
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route("/api/currency")
def currency_rates():
    return jsonify(
        {
            "base": "PLN",
            "rates": {
                "EUR": 4.32,
                "USD": 3.98,
                "GBP": 5.05,
            },
            "updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M")
        }
    )


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)