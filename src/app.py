"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os
import json
import hashlib
import secrets
from pathlib import Path
from typing import Optional

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

BEARER_PREFIX = "Bearer "
HASH_ITERATIONS = 100000

# Mount the static files directory
current_dir = Path(__file__).parent

# Load teacher credentials from JSON file
teachers_file = current_dir / "teachers.json"
with open(teachers_file, encoding="utf-8") as f:
    teachers = {t["username"]: t for t in json.load(f)}

# In-memory session store: token -> username
active_sessions: dict[str, str] = {}


class LoginRequest(BaseModel):
    username: str
    password: str


def verify_token(authorization: Optional[str]) -> str:
    """Validate Bearer token and return username, or raise 401."""
    if not authorization or not authorization.startswith(BEARER_PREFIX):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.removeprefix(BEARER_PREFIX).strip()
    if token not in active_sessions:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return active_sessions[token]


app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.post("/login")
def login(request: LoginRequest):
    """Authenticate a teacher and return a session token."""
    teacher = teachers.get(request.username)
    if not teacher:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    expected = hashlib.pbkdf2_hmac(
        "sha256", request.password.encode(), teacher["salt"].encode(), HASH_ITERATIONS
    ).hex()
    if not secrets.compare_digest(expected, teacher["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = secrets.token_urlsafe(32)
    active_sessions[token] = request.username
    return {"token": token, "username": request.username}


@app.post("/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    """Invalidate the current session token."""
    if authorization and authorization.startswith(BEARER_PREFIX):
        token = authorization.removeprefix(BEARER_PREFIX).strip()
        active_sessions.pop(token, None)
    return {"message": "Logged out"}


@app.get("/auth/status")
def auth_status(authorization: Optional[str] = Header(default=None)):
    """Check whether the current token belongs to a valid session."""
    if authorization and authorization.startswith(BEARER_PREFIX):
        token = authorization.removeprefix(BEARER_PREFIX).strip()
        if token in active_sessions:
            return {"authenticated": True, "username": active_sessions[token]}
    return {"authenticated": False}


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, authorization: Optional[str] = Header(default=None)):
    """Sign up a student for an activity (requires teacher login)"""
    verify_token(authorization)
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, authorization: Optional[str] = Header(default=None)):
    """Unregister a student from an activity (requires teacher login)"""
    verify_token(authorization)
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
