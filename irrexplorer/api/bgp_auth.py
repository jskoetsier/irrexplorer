"""
Authentication and Authorization for BGP Monitoring System.
Provides JWT-based authentication with bcrypt password hashing.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import jwt
from databases import Database
from starlette.requests import Request
from starlette.responses import JSONResponse

from irrexplorer.storage.tables import bgp_users

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(user_id: int, is_admin: bool = False) -> str:
    """Create a JWT access token."""
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": user_id, "admin": is_admin, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None


async def get_current_user(request: Request) -> Optional[dict]:
    """Get the current authenticated user from JWT token."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "")
    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    db: Database = request.app.state.database
    query = bgp_users.select().where(bgp_users.c.id == user_id)
    user = await db.fetch_one(query)

    if not user or not user["is_active"]:
        return None

    return dict(user)


async def require_auth(request: Request) -> Optional[dict]:
    """Require authentication, return None if not authenticated."""
    user = await get_current_user(request)
    if not user:
        return None
    return user


async def require_admin(request: Request) -> Optional[dict]:
    """Require admin authentication, return None if not admin."""
    user = await get_current_user(request)
    if not user:
        return None
    if not user.get("is_admin"):
        return None
    return user


# Authentication endpoints
async def register(request: Request):
    """Register a new user."""
    try:
        data = await request.json()
        email = data.get("email")
        password = data.get("password")
        full_name = data.get("full_name")

        if not email or not password:
            return JSONResponse(
                {"error": "Email and password are required"}, status_code=400
            )

        if len(password) < 8:
            return JSONResponse(
                {"error": "Password must be at least 8 characters"}, status_code=400
            )

        db: Database = request.app.state.database

        # Check if user exists
        check_query = bgp_users.select().where(bgp_users.c.email == email)
        existing_user = await db.fetch_one(check_query)

        if existing_user:
            return JSONResponse({"error": "Email already registered"}, status_code=400)

        # Create user
        password_hash = hash_password(password)
        insert_query = bgp_users.insert().values(
            email=email, password_hash=password_hash, full_name=full_name
        )
        user_id = await db.execute(insert_query)

        # Create access token
        access_token = create_access_token(user_id, is_admin=False)

        return JSONResponse(
            {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": user_id,
                    "email": email,
                    "full_name": full_name,
                    "is_admin": False,
                },
            }
        )

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def login(request: Request):
    """Login a user."""
    try:
        data = await request.json()
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return JSONResponse(
                {"error": "Email and password are required"}, status_code=400
            )

        db: Database = request.app.state.database

        # Find user
        query = bgp_users.select().where(bgp_users.c.email == email)
        user = await db.fetch_one(query)

        if not user:
            return JSONResponse({"error": "Invalid credentials"}, status_code=401)

        # Verify password
        if not verify_password(password, user["password_hash"]):
            return JSONResponse({"error": "Invalid credentials"}, status_code=401)

        if not user["is_active"]:
            return JSONResponse({"error": "Account is inactive"}, status_code=403)

        # Create access token
        access_token = create_access_token(user["id"], user["is_admin"])

        return JSONResponse(
            {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "full_name": user["full_name"],
                    "is_admin": user["is_admin"],
                },
            }
        )

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def me(request: Request):
    """Get current user information."""
    user = await get_current_user(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    return JSONResponse(
        {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "is_admin": user["is_admin"],
            "is_active": user["is_active"],
            "created_at": user["created_at"].isoformat()
            if user["created_at"]
            else None,
        }
    )


async def change_password(request: Request):
    """Change user password."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        data = await request.json()
        current_password = data.get("current_password")
        new_password = data.get("new_password")

        if not current_password or not new_password:
            return JSONResponse(
                {"error": "Current and new password are required"}, status_code=400
            )

        if len(new_password) < 8:
            return JSONResponse(
                {"error": "Password must be at least 8 characters"}, status_code=400
            )

        # Verify current password
        if not verify_password(current_password, user["password_hash"]):
            return JSONResponse(
                {"error": "Current password is incorrect"}, status_code=400
            )

        # Update password
        new_password_hash = hash_password(new_password)
        db: Database = request.app.state.database
        update_query = (
            bgp_users.update()
            .where(bgp_users.c.id == user["id"])
            .values(password_hash=new_password_hash, updated_at=datetime.utcnow())
        )
        await db.execute(update_query)

        return JSONResponse({"message": "Password changed successfully"})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
