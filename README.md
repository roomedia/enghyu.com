# ktheme → APK Converter

This service takes a base APK and a ktheme ZIP file containing replacement resources, and outputs a new APK with the resources replaced.

## Requirements

- Python 3.11+
- Flask (installed via `pip install flask`)

## Setup

1. Place your base APK named `base.apk` in this directory.
2. Install Flask if not already installed:
   ```bash
   /path/to/venv/bin/pip install flask
   ```
   (If you are using the Hermes Agent venv, use its pip.)

3. Run the app:
   ```bash
   /path/to/venv/bin/python app.py
   ```
   The service will be available at `http://<host>:5000`.

## Usage

- Open the web page in a browser.
- Upload a ktheme ZIP file (should contain the same directory structure as the resources inside the APK, e.g., `res/drawable/icon.png`, `res/values/strings.xml`, etc.).
- The server will return a new APK named `themed.apk` with the resources replaced.

## How it works

The APK is treated as a ZIP file. The service overlays files from the ktheme ZIP onto the base APK, preserving all other files. No re-signing is performed; if you need a signed APK for installation, you must sign it yourself (e.g., using `apksigner`).

## Notes

- The conversion is fast because it avoids Gradle builds; it only copies and replaces files.
- Ensure the ktheme ZIP only contains files that exist in the base APK (or new files will be added).