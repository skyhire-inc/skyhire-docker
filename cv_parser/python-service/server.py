from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import os
import subprocess
import pathlib

app = FastAPI()

class AnalyzeRequest(BaseModel):
    input_path: str
    output_dir: Optional[str] = "/app/output"
    quiet: Optional[bool] = True

@app.get("/health")
def health():
    return {"ok": True, "service": "cv-python", "status": "ready"}

@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    input_path = req.input_path
    output_dir = req.output_dir or "/app/output"

    # Basic validations
    if not os.path.exists(input_path):
        return {"ok": False, "error": f"Input not found: {input_path}"}
    os.makedirs(output_dir, exist_ok=True)

    base = pathlib.Path(input_path).stem
    output_file = os.path.join(output_dir, f"{base}_analyzed.json")

    cmd = [
        "python", "main.py", input_path,
        "--output-dir", output_dir,
    ]
    if req.quiet:
        cmd.append("--quiet")

    try:
        completed = subprocess.run(cmd, cwd="/app", capture_output=True, text=True, check=True)
        return {
            "ok": True,
            "message": "analysis complete",
            "stdout": completed.stdout[-2000:],
            "stderr": completed.stderr[-2000:],
            "output_file": output_file
        }
    except subprocess.CalledProcessError as e:
        return {
            "ok": False,
            "error": "subprocess failed",
            "returncode": e.returncode,
            "stdout": e.stdout[-2000:] if e.stdout else "",
            "stderr": e.stderr[-2000:] if e.stderr else ""
        }
