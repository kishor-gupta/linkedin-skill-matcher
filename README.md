# JD Skill Matcher

Personal Chrome extension (Manifest V3) that scans LinkedIn job description pages and counts mentions of a hardcoded skill list so you can quickly decide whether to apply.

## Load unpacked in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder (`job-search-ext`)
5. Open a LinkedIn job page, e.g. `https://www.linkedin.com/jobs/...`

A floating panel appears in the top-right. Green badges are skills found in the current JD; grey means zero mentions. The score is distinct skills found out of the total tracked.

Blue badges flag **Remote**, **Hybrid**, **Delhi**, **Noida**, and **Gurugram** (plus aliases like WFH and Gurgaon). These do not change the skill score. Hover a row to see which alias matched.

Click **−** / **+** to collapse or expand the panel.

After you edit files, click **Reload** on the extension card, then refresh the LinkedIn tab.

## Edit the skills list

Open `content.js` and change the `SKILLS` array at the top:

```js
const SKILLS = [
  { name: "React", aliases: ["React", "React.js", "ReactJS"] },
  { name: "Node.js", aliases: ["Node.js", "NodeJS", "Node js", "Node"] },
  // add more entries here
];
```

- `name` is the label shown in the panel
- `aliases` are extra strings that also count toward that skill (case-insensitive, word-boundary match)

Reload the extension after saving.

Location / work-mode flags live in the `FLAGS` array in the same file (Remote, Hybrid, Delhi, Noida, Gurugram).

## LinkedIn selectors

LinkedIn is an SPA and its class names change. The content script tries a cascade of JD containers in `JD_SELECTORS` inside `content.js`. If the panel stays on “Waiting for job description…”, inspect the job details pane and add the current container class to that list.
