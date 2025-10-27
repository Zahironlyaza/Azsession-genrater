
# WhatsApp Session Generator

This is a simple Node.js Express server to generate a WhatsApp session ID using Baileys.
You can deploy this to platforms like Vercel.

## How to use:

1.  **Clone or create this project:**
    Create a folder, then create `package.json` and `index.js` inside it with the provided code.
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure `.env` (optional for this project):**
    You can create a `.env` file if you want to set the PORT, but generally Vercel sets this automatically.
4.  **Deploy to Vercel (recommended):**
    *   Create a new GitHub repository for this project.
    *   Connect your GitHub repository to Vercel.
    *   Vercel will automatically detect the Node.js project and deploy it.
5.  **Access the deployed URL:**
    *   Once deployed, go to the URL provided by Vercel.
    *   Click "Generate Session".
    *   The page will display a QR Code and a Pairing Code.
    *   Scan the QR code with your main phone's WhatsApp app (Linked Devices -> Link a Device).
    *   After successful scanning/pairing, the page will refresh and display a long `SESSION_ID_START:...:SESSION_ID_END` string.
6.  **Copy the generated SESSION_ID:**
    Copy the entire string starting with `SESSION_ID_START:` and ending with `:SESSION_ID_END`.
7.  **Put it in your main bot's `.env`:**
    Now, take this copied string and put it in the `SESSION_ID` variable in the `.env` file of your *main AZ BOTMD project*.
    Example: `SESSION_ID="SESSION_ID_START:...:SESSION_ID_END"`

## Important Notes:

-   This server is meant to be run only *once* to generate a session. If you need a new session, you'll need to redeploy or restart it.
-   **Security:** Handle the generated session ID with extreme care. Anyone with this ID can control your WhatsApp account.
-   **Account Ban Risk:** Using Baileys is unofficial and carries a risk of your WhatsApp account being banned.
