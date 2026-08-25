#!/usr/bin/env bash
set -euo pipefail

VENV_DIR=".venv"

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtual environment in $VENV_DIR ..."
  python3 -m venv "$VENV_DIR"
else
  echo "Virtual environment already exists."
fi

echo "Activating virtual environment and installing dependencies ..."
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install -e ".[test]"

echo ""
echo "Setup complete. To activate the environment, run:"
echo "  source $VENV_DIR/bin/activate"
