# Phone checklist (owner, real phones)

These four checks can only be done on a real phone. Everything else is covered by the automatic tests
(unit tests and Playwright e2e at phone and laptop size, run on every push). Do them in order and send back,
for each step, **OK** or what you saw instead (a screenshot helps).

Open the live site: the GitHub Pages address of this repo (Settings → Pages in GitHub shows it).

## 1. Android: home-screen icon

1. Open the site in **Chrome** on the Android phone. Finish the four setup steps if they appear.
2. Tap the menu **⋮** (top right) → **Install app** (or **Add to Home screen**) → **Install**.
3. Go to the home screen and look at the icon.

**What you should see**
- The Fluent365 icon (round logo on a coloured background), not a grey letter "F" and not a screenshot of the page.
- The icon is not cut off at the edges and has no white square around it.
- Tapping it opens the app **full screen**: no Chrome address bar, the status bar at the top has the app's colour (no white or black strip at the top or bottom).
- Turn on airplane mode and open it again from the icon: the app still opens on Today.

## 2. iPhone: audio

1. Open the site in **Safari** on the iPhone. Tap **Share** → **Add to Home Screen** → **Add**, then open it from the icon.
2. **Listen** → tap **Continue: Lesson 1**.
3. Lock the screen for 30 seconds, then unlock it.
4. **Listen** → the book (*The Wonderful Wizard of Oz*) → play Chapter 1 with the **Computer** voice.
5. Turn the ringer switch to **silent** and play again.

**What you should see**
- The lesson starts within 2–3 seconds; the transcript moves line by line with the voice and the spoken word is marked.
- With the screen locked the sound keeps playing, and the lock screen shows play/pause controls.
- The book chapter plays (it is an Opus file; if it stays silent or shows an error, note your iOS version: Settings → General → About).
- With the ringer on silent, the sound still plays (media sound, not ringtone volume).

## 3. Sharing a Praktika PDF

1. In **Praktika**, open a lesson report / correction and use **Share** → **Save as PDF** or share the PDF file (whichever Praktika offers).
2. **Android:** in the share sheet pick **Fluent365** (it is there only after step 1, the installed app).
   **iPhone:** save the PDF to **Files**, then in Fluent365 go to **Settings → Import Centre** and choose the file.
3. Look at what the Import Centre shows.

**What you should see**
- The Import Centre opens with the PDF's text read out of it and a list of found items (corrections such as "I am agree → I agree", new words).
- You can tick items and add them; they then appear in **Learn → Grammar → My mistakes** or in your words.
- If it says nothing was found, send me the PDF's first page as a screenshot (no personal data needed) so the parser can be fixed.

## 4. Cloud backup with your own key (repo `fluent365-data`)

1. On GitHub (laptop is easier), make sure the repo **fluent365-data** exists and is **private**.
2. On the phone: **Settings → Backup, restore and Anki → Automatic backup to GitHub**.
3. Tap **Get a key**. GitHub opens a fine-grained token page with the name and *Contents: Read and write* already filled in. Under *Repository access* choose **Only select repositories → fluent365-data**, then **Generate token** and copy it.
4. Back in Fluent365, paste the key and confirm. Then tap **Back up now**.
5. On GitHub, open `fluent365-data`.
6. Optional (second device): connect the laptop with the same key → it should ask **Restore it here** or **Replace it with this device** → choose **Restore it here**.

**What you should see**
- After pasting, the app finds **fluent365-data** by itself (it refuses public repos).
- After **Back up now**: "Last backup: just now" and no error line.
- On GitHub: a file `fluent365-backup.json` with a fresh commit. It does **not** contain your key.
- On the second device after restoring: the same words, days and settings as the phone.
- If something fails, copy the error line shown under "Last backup".
