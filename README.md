# Tick & Treat 🎁

A tiny, cute focus tracker. Finish a focus session, tap the big button, and get a stamp.
Reach daily milestones to unlock surprise gifts you can open at the end of the day.

- Pick a session length and tap **Finished** after each session to collect a stamp.
- Your daily total unlocks gift tiers; open the gift box in the evening.
- Customize session lengths, milestones, gift lists, sounds and animations in **Settings**.

No account and no server: everything is saved in your own browser (`localStorage`),
so each person who opens the link has their own private stamps and gifts.

## Run locally

Open `index.html` in a browser, or serve the folder with any static server, for example:

```bash
python -m http.server 5173
```

## Publish on GitHub Pages

Repository **Settings → Pages → Build and deployment**: choose **Deploy from a branch**,
branch `main`, folder `/ (root)`.
