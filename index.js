
// .env फ़ाइल से वेरिएबल्स लोड करें
import 'dotenv/config'; 

import express from 'express';
import {
    default as makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    PHONENUMBER_MCC
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal'; // qrcode-terminal for console (not used directly in web response)
import * as fs from 'fs';   // fs मॉड्यूल को ESM के रूप में इम्पोर्ट करें
import * as path from 'path'; // path मॉड्यूल को ESM के रूप में इम्पोर्ट करें


const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_FILE_PATH = 'auth_info_session_generator'; // This folder will store credentials

let waConnect = null; // Store the connection instance
let sessionGenerated = false; // Flag to track if session is generated

// Root route to start generation process
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WhatsApp Session Generator</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background-color: #f4f4f4; color: #333; }
                .container { background-color: #fff; margin: 20px auto; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px; }
                h1 { color: #25D366; }
                pre { background-color: #e8e8e8; padding: 15px; border-radius: 5px; overflow-x: auto; text-align: left; }
                button { background-color: #075E54; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-top: 10px; }
                button:hover { background-color: #128C7E; }
                .qr-code { margin: 20px 0; }
                .error { color: red; font-weight: bold; }
                .success { color: green; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>WhatsApp Session Generator</h1>
                <p>Click the button below to start the session generation process.</p>
                <button onclick="startSession()">Generate Session</button>
                <div id="output"></div>
            </div>

            <script>
                async function startSession() {
                    document.getElementById('output').innerHTML = '<p>Starting session generation... Please wait, this might take a moment.</p>';
                    try {
                        const response = await fetch('/generate-session');
                        const data = await response.json();
                        if (data.status === 'success') {
                            document.getElementById('output').innerHTML = '<p class="success">Session generated successfully!</p>' +
                                                                         '<p>Copy the following SESSION_ID and put it in your main bot\'s `.env` file:</p>' +
                                                                         '<pre>' + data.session_id + '</pre>';
                        } else if (data.status === 'qr_code_pair') {
                            document.getElementById('output').innerHTML = '<p>Scan this QR code with your WhatsApp app on your main phone:</p>' +
                                                                         '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(data.qr_code) + '" alt="QR Code" class="qr-code">' +
                                                                         '<p>Or use this Pairing Code (for mobile number linking):</p>' +
                                                                         '<pre>' + data.pairing_code + '</pre>';
                        } else {
                            document.getElementById('output').innerHTML = '<p class="error">Error: ' + (data.message || 'Unknown error occurred.') + '</p>';
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        document.getElementById('output').innerHTML = '<p class="error">Failed to connect to the session generator server. Check console for details.</p>';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// API endpoint to trigger session generation
app.get('/generate-session', async (req, res) => {
    if (sessionGenerated) {
        return res.json({ status: 'error', message: 'Session already generated. Restart the server to generate a new one.' });
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_FILE_PATH);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    waConnect = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Don't print QR in terminal for web
        auth: state,
        browser: ['WhatsApp Session Generator', 'Chrome', '1.0'],
    });

    waConnect.ev.on('creds.update', saveCreds);

    waConnect.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                // Not automatically reconnecting for a session generator server
                // It should be manually restarted by user if session fails
                if (!sessionGenerated) { // If connection closed before session generated
                    res.json({ status: 'error', message: 'Session generation failed. Restart server.' });
                    waConnect.end(); // End the connection process
                }
            } else {
                console.log('Logged out from WhatsApp. Session invalid.');
                res.json({ status: 'error', message: 'Logged out. Session invalid. Restart server.' });
                waConnect.end(); // End the connection process
            }
        } else if (connection === 'open') {
            console.log('WhatsApp connection opened for session generation!');
            // Once connected, the session is in 'state' object. Convert it to a string.
            // For simplicity, we'll give the user the creds.json content.
            const credsFilePath = path.join(SESSION_FILE_PATH, 'creds.json');
            if (fs.existsSync(credsFilePath)) {
                const creds = fs.readFileSync(credsFilePath, 'utf-8');
                sessionGenerated = true; // Mark session as generated
                res.json({ status: 'success', session_id: `SESSION_ID_START:${creds}:SESSION_ID_END` });
                waConnect.end(); // End the connection after session is generated
                // Clean up session files for security
                fs.rmSync(SESSION_FILE_PATH, { recursive: true, force: true });
            } else {
                 res.json({ status: 'error', message: 'Credentials file not found after connection.' });
                 waConnect.end();
            }
        }

        if (qr) {
            console.log('QR Code generated:', qr);
            // Request a pairing code automatically
            let pairingCode = 'Not Available';
            try {
                pairingCode = await waConnect.requestPairingCode("923001234567"); // Use a dummy number for pairing code generation
                console.log('Pairing Code:', pairingCode);
            } catch (error) {
                console.error('Error generating pairing code:', error);
            }
            // Send both QR and Pairing Code
            res.json({ status: 'qr_code_pair', qr_code: qr, pairing_code: pairingCode });
        }
    });
});


app.listen(PORT, () => {
    console.log(`Session Generator listening on port ${PORT}`);
    console.log(`Access it at http://localhost:${PORT} (or your Vercel URL)`);
});
