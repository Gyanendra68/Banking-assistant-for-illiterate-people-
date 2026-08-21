# SBI Voice Banking Assistant — Fix & Regression Report

## Root cause of the intermittent "I don't understand your question"

The project did not have a single backend crash causing the message. The main reliability problem was in the frontend request lifecycle:

1. Multiple text/voice requests could overlap because only the microphone button checked `busy`; the text form could submit another request while the previous request was still running.
2. Older fetch responses could update the UI after a newer question had already been submitted. There was no request ID / cancellation guard.
3. Speech synthesis was cancelled/restarted without tying the result to the active request, so an older response could remain associated with the UI state.
4. Browser SpeechRecognition was reused rather than creating a fresh recognition lifecycle for each recording.
5. ASR-style transcript variations such as `u p i`, `यू पी आई`, and `ए टी एम` were not normalized, and some natural Hindi/Hinglish balance phrasing was missing.
6. Generic intent patterns could collide with more specific intents (for example, `ATM card swallowed` could be classified as generic `ATM`).

These conditions explain why the system could work for several questions and then behave inconsistently during repeated/rapid interaction. The backend intent regression suite itself was already strong, but the frontend did not protect the UI from stale/concurrent requests.

## Fixes applied

- Added a monotonically increasing request ID.
- Added `AbortController` so the previous request is cancelled when a new question starts.
- Added an active-request guard before transcript/answer/TTS/UI updates.
- Added explicit microphone lifecycle states: `IDLE -> RECORDING -> PROCESSING -> SPEAKING -> IDLE`.
- Create a fresh `SpeechRecognition` instance for every recording.
- Prevent stale `onresult` / `onend` handlers from modifying current state.
- Cancel old speech synthesis before starting the newest answer.
- Added robust acronym normalization for spaced ASR output:
  - `u p i` / `यू पी आई` -> `upi`
  - `ए टी एम` -> `atm`
  - `एन ई एफ टी` -> `neft`
  - `आर टी जी एस` -> `rtgs`
  - `आई एम पी एस` -> `imps`
  - `के वाई सी` -> `kyc`
  - `पिन`/`p i n` -> `pin`
  - `ओ टी पी`/`o t p` -> `otp`
- Added natural balance variants such as `भाई account में कितने पैसे हैं`.
- Added generic `UPI_INFO` and `OTP_SAFETY` handling instead of returning unknown for a bare recognized banking acronym.
- Added the missing `ATM_RETENTION` phrase `ATM card swallowed`.
- Kept specific intents ahead of broad intents.
- Standardized the documented demo balance to ₹25,400.
- Added a 100-request long-run regression test.
- Added an npm command: `npm run test:long`.

## Test results

- Syntax checks: **PASS**
- Existing intent regression: **260/260 PASS**
- Long-run sequential test: **100/100 PASS**
- Concurrent backend stress test: **50/50 PASS**
- Health endpoint: **PASS**
- Manual API checks for `u p i`, `यू पी आई`, `ए टी एम`, `PIN`, `OTP`, `भाई account में कितने पैसे हैं`, and `ATM card swallowed`: **PASS**

The 100-request run includes repeated cycles of balance, transaction, UPI, ATM, Saturday, card, maximum-balance, NEFT, cheque and KYC questions without refreshing the server.

## Bhashini status

The supplied project was not actually making Bhashini ASR/TTS calls; it was using browser SpeechRecognition/SpeechSynthesis. I did **not** claim a live Bhashini pass without credentials. The official Bhashini documentation describes the pipeline inference endpoint and the configuration response that supplies the inference API key/header and task-specific service IDs. citeturn1search0

Therefore, live Bhashini ASR/TTS could not honestly be marked PASS from this environment without the project's real credentials and configured pipeline/service IDs. The corrected project keeps secrets out of frontend code and does not silently convert a missing voice-service configuration into `UNKNOWN_INTENT`.

## Changed files

- `server.js`
- `public/app.js`
- `README.md`
- `package.json`

## Newly created files

- `tests/long-run.js`

## Environment variables

Existing `.env.example`:

- `BHASHINI_API_KEY`
- `BHASHINI_USER_ID`
- `BHASHINI_PIPELINE_ENDPOINT`

No real credentials were added to the ZIP.

## Run

```bash
node server.js
```

Open:

```text
http://localhost:5001
```

Regression:

```bash
node tests/run-tests.js
```

Long-run:

```bash
npm run test:long
```

## Important limitation

This remains a **demo/prototype**, not a real SBI account system. The account balance, transactions, branch, ATM and IFSC data are mock data. It does not access or modify real bank accounts.
