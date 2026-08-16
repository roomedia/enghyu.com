from flask import Flask, request, render_template_string, send_file, abort
import zipfile
import io
import os

app = Flask(__name__)

BASE_APK_PATH = 'base.apk'  # expected in same directory

def apply_ktheme(base_apk_bytes, ktheme_zip_bytes):
    """Return new APK bytes with resources from ktheme zip overlaid."""
    # Read base apk as zip
    base_zip = zipfile.ZipFile(io.BytesIO(base_apk_bytes))
    ktheme_zip = zipfile.ZipFile(io.BytesIO(ktheme_zip_bytes))

    new_zip_io = io.BytesIO()
    with zipfile.ZipFile(new_zip_io, 'w', zipfile.ZIP_DEFLATED) as new_zip:
        # Copy all entries from base apk
        for item in base_zip.infolist():
            data = base_zip.read(item.filename)
            # If ktheme has a file with same name, replace data
            if item.filename in ktheme_zip.namelist():
                data = ktheme_zip.read(item.filename)
            new_zip.writestr(item, data)
        # Also add any files that are only in ktheme (should not happen if ktheme only contains existing resources)
        for item in ktheme_zip.infolist():
            if item.filename not in base_zip.namelist():
                new_zip.writestr(item, ktheme_zip.read(item.filename))
    new_zip_io.seek(0)
    return new_zip_io.read()

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        # Check if base.apk exists
        if not os.path.exists(BASE_APK_PATH):
            return f"Base APK not found at {BASE_APK_PATH}. Please place base.apk in the app directory.", 500
        # Get uploaded ktheme file
        if 'ktheme' not in request.files:
            return "No ktheme file uploaded", 400
        file = request.files['ktheme']
        if file.filename == '':
            return "No selected file", 400
        # Read base apk
        with open(BASE_APK_PATH, 'rb') as f:
            base_apk_data = f.read()
        # Read ktheme zip
        ktheme_data = file.read()
        # Apply
        try:
            new_apk = apply_ktheme(base_apk_data, ktheme_data)
        except Exception as e:
            return f"Error processing: {e}", 500
        # Return the new APK as download
        return send_file(
            io.BytesIO(new_apk),
            mimetype='application/vnd.android.package-archive',
            as_attachment=True,
            download_name='themed.apk'
        )
    # GET request: show upload form
    return '''
    <!doctype html>
    <title>ktheme → APK Converter</title>
    <h1>Upload ktheme (zip) to apply to base.apk</h1>
    <form method=post enctype=multipart/form-data>
      <input type=file name=ktheme accept=.zip>
      <input type=submit value=Convert>
    </form>
    '''

if __name__ == '__main__':
    # Run on all interfaces, port 5000
    app.run(host='0.0.0.0', port=5000, debug=False)