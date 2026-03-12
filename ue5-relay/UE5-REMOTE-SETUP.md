# Fix: "PythonScriptLibrary cannot be accessed remotely"

When the relay sends code to Unreal Engine 5, you may see:

```text
UE5 returned 400: { "errorMessage": "Object Default__PythonScriptLibrary cannot be accessed remotely, check remote control project settings." }
```

That means your **UE5 project** is not allowing the Python Script object to be called over Web Remote Control. Do the following in your Unreal Engine project.

---

## 1. Enable the required plugins

1. In Unreal Editor: **Edit → Plugins**.
2. Search for and **enable**:
   - **Remote Control API** (under *Messaging*)
   - **Python Script Plugin** (under *Scripting*)
3. Restart the editor when asked.

---

## 2. Start the Web Remote Control server

1. Open the **Output Log** or **Console** (Window → Developer Tools → Output Log, or ~ key for console).
2. Run:
   ```text
   WebControl.StartServer
   ```
3. The server usually listens on **port 30010** (same as the relay’s default).

---

## 3. Expose Python for remote access (fix the 400 error)

The 400 error happens because `Default__PythonScriptLibrary` is not exposed to Remote Control. Expose it via a **Remote Control Preset**:

1. **Create a preset**
   - In the Content Browser: right‑click → **Miscellaneous → Remote Control Preset**.
   - Name it (e.g. `GrandStudioPython`).

2. **Expose the Python execution function**
   - Open the new preset (double‑click).
   - In the preset window, use **+ Expose** (or **Add**).
   - Expose a **Function**.
   - Set the **source object** to the **Python Script Library** (e.g. search for `PythonScriptLibrary` or pick the object path `PythonScriptPlugin.Default__PythonScriptLibrary` if your editor shows it).
   - Expose the **ExecutePythonCommand** function (single string parameter `PythonCommand`).
   - Save the preset.

3. **Alternative: expose via Blueprint**
   - If your editor does not list the engine object directly, create a **Blueprint Function Library** (or Actor Blueprint).
   - Add a function that calls **Execute Python Command** (from the Python Script Plugin).
   - In the same Remote Control Preset, expose that Blueprint’s function instead.
   - Save the preset.

After the preset is set up and the function is exposed, the **/remote/object/call** API can be allowed to use that object in some setups. If your engine still blocks the default engine object path, use the **preset** HTTP API to call the exposed function (see Remote Control API docs for your engine version).

---

## 4. Optional: check Web Remote Control port

- **Project Settings → Plugins → Web Remote Control** (or “Remote Control”).
- Confirm the **HTTP server port** (default **30010**). The relay uses this port.

---

## 5. Run the relay again

With the server running (`WebControl.StartServer`) and Python exposed for remote access (preset or Blueprint), run:

```bash
python relay.py
```

Then send code from Grand Studio again. If the 400 persists, double‑check that the preset is saved and that the exposed function is the one that runs Python (ExecutePythonCommand or your Blueprint wrapper).
