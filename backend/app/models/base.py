from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy import Column, Integer

class Base:
    # Generate __tablename__ automatically
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower()
