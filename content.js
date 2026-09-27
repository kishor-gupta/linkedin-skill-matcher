(() => {
  // ---------------------------------------------------------------------------
  // Edit this list to track different skills. Each entry has a canonical `name`
  // (shown in the panel) and `aliases` (strings that also count as that skill).
  // A future version may move this to chrome.storage + an options page.
  // ---------------------------------------------------------------------------
  const SKILLS = [
    { name: "React", aliases: ["React", "React.js", "ReactJS"] },
    { name: "Node.js", aliases: ["Node.js", "NodeJS", "Node js", "Node"] },
    { name: "GraphQL", aliases: ["GraphQL"] },
    { name: "MongoDB", aliases: ["MongoDB", "Mongo"] },
    { name: "Express", aliases: ["Express.js", "ExpressJS", "Express"] },
    { name: "AWS", aliases: ["AWS", "Amazon Web Services"] },
    { name: "Azure", aliases: ["Azure", "Microsoft Azure"] },
    { name: "TypeScript", aliases: ["TypeScript", "TS"] },
  ];

  // Location / work-mode flags. Shown separately from skills so they do not
  // change the "N/M skills matched" score. Gurgaon is included as a Gurugram alias.
  const FLAGS = [
    { name: "Remote", aliases: ["Remote", "Remotely", "Work from home", "Work-from-home", "WFH"] },
    { name: "Hybrid", aliases: ["Hybrid"] },
    { name: "Delhi", aliases: ["Delhi", "New Delhi"] },
    { name: "Noida", aliases: ["Noida"] },
    { name: "Gurugram", aliases: ["Gurugram", "Gurgaon"] },
  ];

  // Location often lives on the job top card, not only inside the JD body.
  const LOCATION_SELECTORS = [
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".jobs-unified-top-card__primary-description",
    ".jobs-unified-top-card__workplace-type",
    ".topcard__flavor--bullet",
  ];

  // LinkedIn class names change often. Try these in order; first non-empty
  // innerText wins. Guest/public /jobs/view pages use the last two.
  const JD_SELECTORS = [
    ".jobs-description__content",
    "#job-details",
    ".jobs-box__html-content",
    "article.jobs-description__container",
    '[componentkey^="JobDetails_AboutTheJob"]',
    ".description__text",
    ".show-more-less-html__markup",
  ];

  const PANEL_ID = "jd-skill-matcher";
  const SCAN_DEBOUNCE_MS = 200;

  let collapsed = false;
  let lastJdText = null;
  let jdNodeObserver = null;
  let observedJdNode = null;
  let debounceTimer = null;

  // ---------------------------------------------------------------------------
  // Matching: escape special chars, then wrap each alias in \b...\b so short
  // tokens like "TS" / "Node" do not match inside unrelated words, and so
  // "React" does not match inside "Reactive". (A phrase like "React Native"
  // still counts as React — \b treats those as two words.)
  //
  // Alias counts for the same skill are combined with a longest-first
  // alternation so "Node.js" is one mention, not Node + Node.js.
  // ---------------------------------------------------------------------------
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildAliasRegex(alias) {
    return new RegExp(`\\b${escapeRegExp(alias)}\\b`, "gi");
  }

  function buildCombinedRegex(aliases) {
    const sorted = [...aliases].sort((a, b) => b.length - a.length);
    const pattern = sorted.map(escapeRegExp).join("|");
    return new RegExp(`\\b(?:${pattern})\\b`, "gi");
  }

  function scanList(items, text) {
    return items.map((item) => {
      const foundAliases = item.aliases.filter((alias) =>
        buildAliasRegex(alias).test(text)
      );
      const matches = text.match(buildCombinedRegex(item.aliases));
      return {
        name: item.name,
        count: matches ? matches.length : 0,
        foundAliases,
      };
    });
  }

  function findJobDescriptionEl() {
    for (const selector of JD_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.trim()) {
        return el;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // MutationObserver: LinkedIn is an SPA. Clicking a job card (or history
  // navigation) swaps the JD without a full reload — sometimes by mutating
  // text inside the same node, sometimes by replacing the node entirely.
  //
  // We observe document.body for node replacement, and the current JD node
  // for in-place text changes. Scans are debounced so LinkedIn's burst of
  // mutations does not re-run matching dozens of times per click.
  // ---------------------------------------------------------------------------
  function extractJdText(el) {
    return el ? el.innerText.trim() : "";
  }

  function extractLocationText() {
    const parts = [];
    for (const selector of LOCATION_SELECTORS) {
      document.querySelectorAll(selector).forEach((node) => {
        const t = node.innerText && node.innerText.trim();
        if (t) {
          parts.push(t);
        }
      });
    }
    return parts.join("\n");
  }

  function scanAndRender() {
    const el = findJobDescriptionEl();
    bindJdNodeObserver(el);

    const jdText = extractJdText(el);
    const text = [jdText, extractLocationText()].filter(Boolean).join("\n");
    if (text === lastJdText) {
      return;
    }
    lastJdText = text;

    if (!jdText) {
      renderPanel(null);
      return;
    }

    renderPanel({
      skills: scanList(SKILLS, text),
      flags: scanList(FLAGS, text),
    });
  }

  function scheduleScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanAndRender, SCAN_DEBOUNCE_MS);
  }

  function bindJdNodeObserver(el) {
    if (el === observedJdNode) {
      return;
    }

    if (jdNodeObserver) {
      jdNodeObserver.disconnect();
      jdNodeObserver = null;
    }
    observedJdNode = el;

    if (!el) {
      return;
    }

    jdNodeObserver = new MutationObserver(scheduleScan);
    jdNodeObserver.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function startObservers() {
    const bodyObserver = new MutationObserver(scheduleScan);
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("popstate", scheduleScan);

    scanAndRender();
  }

  // ---------------------------------------------------------------------------
  // Floating panel — injected on document.body so it is never part of the JD
  // text we scan. Collapsed state is kept in `collapsed` so switching jobs
  // in the SPA does not re-expand a panel the user tucked away.
  // ---------------------------------------------------------------------------
  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
      return panel;
    }

    panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", "JD Skill Matcher");
    document.body.appendChild(panel);
    return panel;
  }

  function renderRows(results, hitClass) {
    return results
      .map((r) => {
        const badgeClass =
          r.count > 0 ? `jsm-badge ${hitClass}` : "jsm-badge jsm-badge--miss";
        const aliasHint =
          r.foundAliases.length > 0
            ? ` title="Matched: ${r.foundAliases.join(", ")}"`
            : "";
        return `<li class="jsm-row"${aliasHint}>
          <span class="jsm-name">${escapeHtml(r.name)}</span>
          <span class="${badgeClass}">${r.count}</span>
        </li>`;
      })
      .join("");
  }

  function renderPanel(results) {
    const panel = ensurePanel();
    panel.classList.toggle("jsm-collapsed", collapsed);

    const matched = results
      ? results.skills.filter((r) => r.count > 0).length
      : 0;
    const total = SKILLS.length;
    const flagged = results
      ? results.flags.filter((r) => r.count > 0).map((r) => r.name)
      : [];
    const scoreLabel = results
      ? `${matched}/${total} skills matched`
      : "Waiting for job description…";
    const flagSummary = flagged.length > 0 ? flagged.join(" · ") : "";

    const skillRows = results ? renderRows(results.skills, "jsm-badge--hit") : "";
    const flagRows = results ? renderRows(results.flags, "jsm-badge--flag") : "";

    const toggleLabel = collapsed ? "Expand" : "Collapse";
    const toggleChar = collapsed ? "+" : "−";

    panel.innerHTML = `
      <div class="jsm-header">
        <div class="jsm-title-block">
          <div class="jsm-title">JD Skill Matcher</div>
          <div class="jsm-score">${escapeHtml(scoreLabel)}</div>
          ${flagSummary ? `<div class="jsm-flags-summary">${escapeHtml(flagSummary)}</div>` : ""}
        </div>
        <button type="button" class="jsm-toggle" aria-expanded="${!collapsed}" aria-label="${toggleLabel}">${toggleChar}</button>
      </div>
      <div class="jsm-body">
        <ul class="jsm-list">${skillRows}</ul>
        <div class="jsm-section-label">Location / work mode</div>
        <ul class="jsm-list">${flagRows}</ul>
      </div>
    `;

    panel.querySelector(".jsm-toggle").addEventListener("click", () => {
      collapsed = !collapsed;
      panel.classList.toggle("jsm-collapsed", collapsed);
      const btn = panel.querySelector(".jsm-toggle");
      btn.textContent = collapsed ? "+" : "−";
      btn.setAttribute("aria-expanded", String(!collapsed));
      btn.setAttribute("aria-label", collapsed ? "Expand" : "Collapse");
    });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  if (document.body) {
    startObservers();
  } else {
    document.addEventListener("DOMContentLoaded", startObservers, { once: true });
  }
})();
