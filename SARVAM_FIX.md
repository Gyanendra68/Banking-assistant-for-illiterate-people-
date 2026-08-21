# Sarvam integration fix

This build fixes the `[object Object]` error handling and makes Bulbul v3 TTS use a compatible speaker per supported language. TTS output is requested as WAV and returned to the browser with the correct MIME type.

Create `.env` from `.env.example`:

SARVAM_API_KEY=YOUR_SARVAM_API_KEY

Restart the server after changing `.env`:

node server.js

Then open http://localhost:5001
