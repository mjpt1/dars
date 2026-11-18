from __future__ import annotations

import argparse

from passlib.context import CryptContext
from sqlalchemy import select

from packages.exam_builder.database import SessionLocal
from packages.exam_builder.models import User


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update an admin/reviewer user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="Reviewer")
    args = parser.parse_args()
    context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    with SessionLocal() as session:
        user = session.scalar(select(User).where(User.email == args.email))
        if user is None:
            user = User(email=args.email, display_name=args.name, password_hash=context.hash(args.password))
            session.add(user)
            action = "created"
        else:
            user.display_name = args.name
            user.password_hash = context.hash(args.password)
            action = "updated"
        session.commit()
    print(f"User {args.email} {action}.")


if __name__ == "__main__":
    main()
