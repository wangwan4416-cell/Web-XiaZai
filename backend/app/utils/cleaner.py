import os
import shutil


def cleanup(*paths: str) -> None:
    """Remove temporary files and directories."""
    for p in paths:
        try:
            if os.path.isfile(p):
                os.remove(p)
            elif os.path.isdir(p):
                shutil.rmtree(p)
        except OSError:
            pass
