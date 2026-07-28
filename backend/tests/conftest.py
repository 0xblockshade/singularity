import os
import sys

# Make `app` importable when tests run from the backend/ dir.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from app import db as db_module


@pytest.fixture()
def conn(tmp_path):
    path = str(tmp_path / "test.db")
    c = db_module.connect(path)
    db_module.init_db(c)
    yield c
    c.close()
