# SBI Voice Banking Assistant — Fixed Working Prototype

## Run it

This version intentionally uses **Node's built-in HTTP server** and the browser's Speech Recognition/Speech Synthesis APIs, so you do not need React, npm packages, Bhashini credentials, or an `.env` file just to run the demo.

### Windows

1. Extract this ZIP.
2. Open the extracted folder in VS Code.
3. Open Terminal.
4. Run:

```bash
node server.js
```

5. Open **http://localhost:5001** in Chrome or Edge.
6. Allow microphone access.
7. Select a language and press the microphone button.

If `node` is not recognized, install Node.js first.

## What was fixed

- Removed broken/mismatched imports such as `../controllers/...` and `../services/...`.
- Added all missing runtime files.
- Removed the dependency on a missing React `App.js`.
- Added one complete server + frontend that runs from the same command.
- Added browser-based multilingual voice input/output.
- Added text fallback, so the assistant still works when speech recognition is unavailable.
- Added intent matching with many real-world banking customer problems.
- Added safer responses for PIN/OTP/CVV/password/fraud questions.
- Fixed the incorrect idea that every account has a ₹5,000 or other universal maximum balance.
- Added mock balance, account suffix, mini statement, branch/ATM, IFSC and account-status data.
- Added UPI failed/pending/not-received, ATM cash-not-received, lost card, PIN, KYC, nominee, cheque, cash deposit/withdrawal, transfer limits, charges, interest, FD, loan, EMI, password, fraud and complaint intents.
- Added example question buttons so you can demonstrate many supported cases quickly.

## Important

This is a **prototype**, not a real banking system. It does not access a real SBI account and does not perform real transactions.

The demo intentionally uses mock data:
- Balance: ₹25,400
- Account suffix: 1234
- Demo transactions
- Demo branch/ATM
- Demo IFSC

For a production SIH project, replace mock services with authenticated bank APIs and an official Bhashini integration. Never put banking secrets, API keys, OTPs, PINs or customer credentials in frontend code.

## Test questions

Hindi:
- मेरा balance कितना है?
- मेरा account number बताओ
- mini statement दिखाओ
- मेरा UPI payment pending है
- UPI payment fail हो गया
- पैसा कट गया लेकिन सामने वाले को नहीं मिला
- मेरा ATM card खो गया
- ATM ने पैसा नहीं दिया लेकिन account से कट गया
- मेरा PIN भूल गया
- KYC कैसे update करूं?
- नजदीकी ATM कहाँ है?
- बैंक कब तक खुला रहेगा?
- account में maximum कितना balance रख सकता हूँ?
- minimum balance कितना है?
- IFSC code बताओ
- cheque book चाहिए
- cash deposit कैसे करूं?
- loan की जानकारी चाहिए
- मेरी transaction fraud है
- complaint कैसे करूं?

English:
- What is my balance?
- My UPI payment is pending
- My card is lost
- ATM did not dispense cash but my account was debited
- How do I update KYC?
- What is the minimum balance?
- How much balance can I keep?
- Show my mini statement
- Where is the nearest ATM?
- I see an unauthorized transaction


## Languages
The language menu now includes English plus all 22 languages listed in the Eighth Schedule of the Constitution: Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu and Urdu.

Important: the browser Web Speech API does not guarantee recognition or a native voice for every Indian language. The UI therefore shows all language choices, uses the correct language code where supported, and falls back to text input when a browser voice is unavailable. For guaranteed multilingual STT/TTS across Indian languages, integrate an official multilingual speech provider such as Bhashini in the backend.


## Regression testing added

The project now includes `tests/test_cases.json` with 260 realistic banking questions covering Hindi, Hinglish and English variations, and `tests/run-tests.js` for repeatable intent regression testing.

Run the server:

```bash
node server.js
```

In another terminal:

```bash
node tests/run-tests.js
```

The intent detector was specifically hardened against collisions such as:
- current balance vs maximum balance
- UPI failed vs UPI pending vs recipient not received
- card lost vs card expiry vs activation vs unblock
- loan information vs loan EMI
- bank timing vs holiday vs Saturday/Sunday
- cash deposit vs cash-deposit machine
- account status vs account opening
- cheque book/deposit vs cheque stop-payment vs cheque bounce

## Multilingual voice limitation

This ZIP does **not** pretend that browser Web Speech supports every Indian language. The language menu contains Indian language choices, but actual recognition/voice availability depends on Chrome/Edge and installed OS voice packs.

Common demo responses now have native-language text for Marathi, Bengali, Gujarati, Punjabi, Tamil, Telugu and Kannada. Other intents safely fall back to English rather than inventing a translation.

For production-grade Indian-language STT/TTS, connect the backend to an authenticated BHASHINI pipeline. BHASHINI's official documentation describes pipeline inference and the `https://dhruva-api.bhashini.gov.in/services/inference/pipeline` callback endpoint; the pipeline configuration response supplies the inference API key/header and task configurations. Do not copy example credentials from documentation into the project. Use your own BHASHINI credentials in environment variables.

BHASHINI is suitable for this architecture because its platform supports multilingual speech/text workflows and conversational assistants.

## Sarvam AI voice setup

This version integrates Sarvam AI on the backend for voice input and voice output. The API key is never exposed to the browser.

1. Copy `.env.example` to `.env`.
2. Put your key in `.env`:
   `SARVAM_API_KEY=your_sarvam_api_key_here`
3. Start the app with `node server.js` or `npm start`.
4. Open `http://localhost:5001`.
5. Allow microphone access.

Voice input uses Sarvam Saaras v3 STT. Voice output uses Sarvam Bulbul v3 TTS for its supported 11 languages. The remaining language choices keep a browser-TTS fallback so the existing UI remains usable.

The browser records short WebM/Opus clips, sends them to the local backend, and the backend forwards them to Sarvam. This keeps the subscription key server-side.
