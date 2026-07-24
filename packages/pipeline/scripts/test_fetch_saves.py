# Test pur de l'auto-découverte (aucune dépendance : paramiko est importé
# paresseusement dans fetch-saves.py). Lancé avec python3 système.
import importlib.util
import os

_spec = importlib.util.spec_from_file_location(
    "fetch_saves", os.path.join(os.path.dirname(__file__), "fetch-saves.py")
)
fetch_saves = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fetch_saves)


def test_pick_single_world():
    assert fetch_saves.pick_world_dir(["A5F3C0000000000000000000000000000"]) == "A5F3C0000000000000000000000000000"


def test_pick_zero_raises():
    try:
        fetch_saves.pick_world_dir([])
        raise AssertionError("aurait dû lever")
    except ValueError:
        pass


def test_pick_many_raises():
    try:
        fetch_saves.pick_world_dir(["W1", "W2"])
        raise AssertionError("aurait dû lever")
    except ValueError:
        pass


if __name__ == "__main__":
    test_pick_single_world()
    test_pick_zero_raises()
    test_pick_many_raises()
    print("OK")
