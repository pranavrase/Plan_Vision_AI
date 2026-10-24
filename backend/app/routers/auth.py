# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from datetime import timedelta
# pyrefly: ignore [missing-import]
from fastapi.security import OAuth2PasswordRequestForm

from app.core.database import get_db
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import UserCreate, User as UserSchema, Token
from app.core.dependencies import get_current_user

router = APIRouter()


def get_or_create_admin(db: Session) -> User:
    admin_user = db.query(User).filter(
        (User.email == settings.ADMIN_USERNAME) | (User.email == "admin")
    ).first()

    if not admin_user:
        admin_user = User(
            email=settings.ADMIN_USERNAME,
            hashed_password=security.get_password_hash(settings.ADMIN_PASSWORD),
            full_name="Administrator",
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
    else:
        # Sync password hash if ADMIN_PASSWORD environment setting is updated
        if not security.verify_password(settings.ADMIN_PASSWORD, admin_user.hashed_password):
            admin_user.hashed_password = security.get_password_hash(settings.ADMIN_PASSWORD)
            admin_user.email = settings.ADMIN_USERNAME
            db.commit()
            db.refresh(admin_user)

    return admin_user


@router.post("/register", response_model=UserSchema)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Registration is disabled. Only the single administrative account is allowed.",
    )


@router.post("/login", response_model=Token)
def login(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    admin_user = get_or_create_admin(db)

    input_username = form_data.username.strip()
    input_password = form_data.password

    # Validate against configured admin username or 'admin' or admin_user email
    is_valid_username = (
        input_username.lower() == settings.ADMIN_USERNAME.lower()
        or input_username.lower() == "admin"
        or input_username.lower() == admin_user.email.lower()
    )

    if not is_valid_username or not security.verify_password(input_password, admin_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect User ID or password.",
        )

    if not admin_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=admin_user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserSchema)
def read_user_me(current_user: User = Depends(get_current_user)):
    return current_user
