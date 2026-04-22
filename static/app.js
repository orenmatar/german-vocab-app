/**
 * German Vocab App — Frontend
 */

(function () {
  "use strict";

  // --- State ---
  let words = [];
  let grammarPoints = [];
  let batch = [];
  let currentIndex = 0;
  let correctCount = 0;
  let currentAnswered = false;
  let audioEnabled = false;   // server has OPENAI_API_KEY
  let audioRequested = false; // user wants audio this session
  let currentAudioData = null;
  let currentPlaybackSpeed = 1;

  // Word list filter
  let filterStarred = false;

  // Passage state
  let passageData = null;
  let passageRatings = {};

  // Writing passage state
  let writingSetupData = null;

  // Words deleted/starred mid-session (sentence practice)
  let deletedDuringSession = new Set();
  // Words deleted on passage review screen
  let passageDeletedWords = new Set();

  // Insights state
  let mistakePatterns = [];

  // --- DOM refs ---
  const tabs = document.querySelectorAll(".nav-tab");
  const wordsView = document.getElementById("words-view");
  const grammarView = document.getElementById("grammar-view");
  const practiceView = document.getElementById("practice-view");
  const insightsView = document.getElementById("insights-view");
  const settingsView = document.getElementById("settings-view");
  const insightsListEl = document.getElementById("insights-list");
  const insightsEmptyEl = document.getElementById("insights-empty");
  const prepView = document.getElementById("prep-view");
  const settingsSections = document.getElementById("settings-sections");

  // Word list
  const newWordInput = document.getElementById("new-word");
  const newContextInput = document.getElementById("new-context");
  const addWordBtn = document.getElementById("add-word-btn");
  const wordCountEl = document.getElementById("word-count");
  const wordListEl = document.getElementById("word-list");
  const sortSelect = document.getElementById("sort-select");
  const starFilterBtn = document.getElementById("star-filter-btn");
  const wordStatsEl = document.getElementById("word-stats");

  // Grammar
  const newGrammarInput = document.getElementById("new-grammar");
  const addGrammarBtn = document.getElementById("add-grammar-btn");
  const grammarCountEl = document.getElementById("grammar-count");
  const grammarListEl = document.getElementById("grammar-list");
  const grammarEnrichBanner = document.getElementById("grammar-enrich-banner");

  // Practice states
  const practiceIdle = document.getElementById("practice-idle");
  const practiceLoading = document.getElementById("practice-loading");
  const practiceError = document.getElementById("practice-error");
  const practiceActive = document.getElementById("practice-active");
  const practiceSummary = document.getElementById("practice-summary");
  const practicePassage = document.getElementById("practice-passage");

  // Passage elements
  const startPassageBtn = document.getElementById("start-passage-btn");
  const loadingMsg = document.getElementById("loading-msg");
  const passageReadingSection = document.getElementById("passage-reading");
  const passageReviewSection = document.getElementById("passage-review");
  const passageTextEl = document.getElementById("passage-text");
  const passageTranslationEl = document.getElementById("passage-translation");
  const passageGrammarNotesEl = document.getElementById("passage-grammar-notes");
  const passageShowTranslationBtn = document.getElementById("passage-show-translation-btn");
  const passageDoneReadingBtn = document.getElementById("passage-done-reading-btn");
  const passageWordListEl = document.getElementById("passage-word-list");
  const passageFinishBtn = document.getElementById("passage-finish-btn");

  // Word popup
  const wordPopup = document.getElementById("word-popup");
  const wordPopupClose = document.getElementById("word-popup-close");
  const wordPopupContent = document.getElementById("word-popup-content");

  // Audio opt-in
  const audioOptIn = document.getElementById("audio-opt-in");
  const audioCheckbox = document.getElementById("audio-checkbox");
  const summaryAudioOptIn = document.getElementById("summary-audio-opt-in");
  const summaryAudioCheckbox = document.getElementById("summary-audio-checkbox");

  // Practice controls
  const startBtn = document.getElementById("start-practice-btn");
  const retryBtn = document.getElementById("retry-btn");
  const errorMsg = document.getElementById("practice-error-msg");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");

  // Comprehension mode
  const modeComp = document.getElementById("mode-comprehension");
  const compSentenceArea = document.getElementById("comp-sentence-area");
  const compSentence = document.getElementById("comp-sentence");
  const showTranslationBtn = document.getElementById("show-translation-btn");
  const compTranslation = document.getElementById("comp-translation");
  const compWordCard = document.getElementById("comp-target-word");   // repurposed as word card slot
  const compDefinition = document.getElementById("comp-definition");  // kept hidden
  const compGrammarNote = document.getElementById("comp-grammar-note");
  const compButtons = document.getElementById("comp-buttons");

  // Audio phase
  const compAudioPhase = document.getElementById("comp-audio-phase");
  const listenBtn = document.getElementById("listen-btn");
  const audioLoading = document.getElementById("audio-loading");
  const showSentenceBtn = document.getElementById("show-sentence-btn");
  const audioReplayBar = document.getElementById("audio-replay-bar");
  const replayBtn = document.getElementById("replay-btn");
  const speedBtns = document.querySelectorAll(".speed-btn");

  // Multiple choice mode
  const modeMC = document.getElementById("mode-multiple-choice");
  const mcSentence = document.getElementById("mc-sentence");
  const mcChoices = document.getElementById("mc-choices");
  const mcFeedback = document.getElementById("mc-feedback");
  const mcFeedbackText = document.getElementById("mc-feedback-text");
  const mcTranslation = document.getElementById("mc-translation");
  const mcWordCard = document.getElementById("mc-target-word");  // repurposed
  const mcDefinition = document.getElementById("mc-definition"); // kept hidden
  const mcGrammarNote = document.getElementById("mc-grammar-note");
  const mcWrongWord = document.getElementById("mc-wrong-word");
  const mcNextBtn = document.getElementById("mc-next-btn");

  // In-practice word action areas
  const compWordActions = document.getElementById("comp-word-actions");
  const mcWordActions = document.getElementById("mc-word-actions");

  // Fill mode

  // Writing passage mode
  const practiceWriting = document.getElementById("practice-writing");
  const writingSetupSection = document.getElementById("writing-setup");
  const writingFeedbackSection = document.getElementById("writing-feedback");
  const writingTopicEl = document.getElementById("writing-topic");
  const writingTopicDeEl = document.getElementById("writing-topic-de");
  const writingGrammarBlock = document.getElementById("writing-grammar-block");
  const writingGrammarName = document.getElementById("writing-grammar-name");
  const writingGrammarExplanation = document.getElementById("writing-grammar-explanation");
  const writingGrammarExamples = document.getElementById("writing-grammar-examples");
  const writingWordsGrid = document.getElementById("writing-words-grid");
  const writingInput = document.getElementById("writing-input");
  const writingSubmitBtn = document.getElementById("writing-submit-btn");
  const writingLoadingEl = document.getElementById("writing-loading");
  const writingScoreBadge = document.getElementById("writing-score-badge");
  const writingOverallFeedback = document.getElementById("writing-overall-feedback");
  const writingGrammarSection = document.getElementById("writing-grammar-section");
  const writingGrammarFeedbackEl = document.getElementById("writing-grammar-feedback");
  const writingVocabSection = document.getElementById("writing-vocab-section");
  const writingVocabUsed = document.getElementById("writing-vocab-used");
  const writingErrorsSection = document.getElementById("writing-errors-section");
  const writingErrorsList = document.getElementById("writing-errors-list");
  const writingDoneBtn = document.getElementById("writing-done-btn");
  const writingWordCardSlot = document.getElementById("writing-word-card-slot");
  const startWritingBtn = document.getElementById("start-writing-btn");
  const activeBackBtn = document.getElementById("active-back-btn");
  const passageBackBtn = document.getElementById("passage-back-btn");
  const writingBackBtn = document.getElementById("writing-back-btn");

  // Summary
  const summaryScore = document.getElementById("summary-score");
  const nextBatchBtn = document.getElementById("next-batch-btn");
  const doneBtn = document.getElementById("done-btn");

  // --- Custom modal (replaces native alert/confirm, which Arc and some browsers block) ---

  const customModal = document.getElementById("custom-modal");
  const modalMessage = document.getElementById("modal-message");
  const modalOk = document.getElementById("modal-ok");
  const modalCancel = document.getElementById("modal-cancel");

  function showAlert(msg) {
    return new Promise((resolve) => {
      modalMessage.textContent = msg;
      modalCancel.style.display = "none";
      modalOk.textContent = "OK";
      customModal.style.display = "flex";
      modalOk.addEventListener("click", () => { customModal.style.display = "none"; resolve(); }, { once: true });
    });
  }

  function showConfirm(msg, okText = "OK", cancelText = "Cancel") {
    return new Promise((resolve) => {
      modalMessage.textContent = msg;
      modalCancel.style.display = "";
      modalOk.textContent = okText;
      modalCancel.textContent = cancelText;
      customModal.style.display = "flex";
      const done = (result) => { customModal.style.display = "none"; resolve(result); };
      modalOk.addEventListener("click", () => done(true), { once: true });
      modalCancel.addEventListener("click", () => done(false), { once: true });
    });
  }

  // --- Navigation ---

  const contentEl = document.querySelector(".content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const view = tab.dataset.view;
      wordsView.classList.toggle("active", view === "words");
      grammarView.classList.toggle("active", view === "grammar");
      practiceView.classList.toggle("active", view === "practice");
      insightsView.classList.toggle("active", view === "insights");
      prepView.classList.toggle("active", view === "prep");
      settingsView.classList.toggle("active", view === "settings");

      contentEl.classList.toggle("content--wide", view === "grammar");

      if (view === "words") loadWords();
      if (view === "grammar") loadGrammar();
      if (view === "insights") loadInsights();
      if (view === "settings") loadSettings();
    });
  });

  // --- API helpers ---

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(path, opts);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      throw new Error(`Server error (${res.status}) — check the Flask console for details.`);
    }
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  // --- Word card component ---

  function buildWordCard(info) {
    const {
      german = "",
      article = "",
      plural = "",
      preteritum = "",
      partizip2 = "",
      german_definition = "",
      english_translation = "",
      form_in_sentence = "",
    } = info;

    // Header: article + word + inflected form (if different)
    const articleHtml = article ? `<span class="wc-article">${escHtml(article)}</span> ` : "";
    const formHtml = (form_in_sentence && form_in_sentence !== german)
      ? ` <span class="wc-form-in-sentence">→ <em>${escHtml(form_in_sentence)}</em></span>`
      : "";
    const headerHtml = `<div class="wc-header">${articleHtml}<span class="wc-word">${escHtml(german)}</span>${formHtml}</div>`;

    // Supplements: Pl. X for nouns, Prät. X · Ptz. Y for verbs
    const sups = [];
    if (plural) sups.push(`Pl. ${escHtml(plural)}`);
    if (preteritum) sups.push(`Prät. ${escHtml(preteritum)}`);
    if (partizip2) sups.push(escHtml(partizip2));
    const supsHtml = sups.length
      ? `<div class="wc-supplements">${sups.join(" &nbsp;·&nbsp; ")}</div>`
      : "";

    const defHtml = german_definition
      ? `<div class="wc-definition">${escHtml(german_definition)}</div>`
      : "";

    const transHtml = english_translation
      ? `<button class="wc-trans-btn">Show translation</button><div class="wc-translation" style="display:none">${escHtml(english_translation)}</div>`
      : "";

    return `<div class="word-card">${headerHtml}${supsHtml}${defHtml}${transHtml}</div>`;
  }

  // Builds star + delete mini-buttons for use inside practice sessions
  function buildPracticeActions(german, opts = {}) {
    const { starFn = "practiceToggleStar", deleteFn = "practiceDeleteWord" } = opts;
    const word = words.find((w) => w.german === german);
    const starred = word ? !!word.starred : false;
    const starClass = starred ? "btn-star starred" : "btn-star";
    const starTitle = starred ? "Unstar this word" : "Star this word";
    return `<button class="${starClass}" onclick="${starFn}('${escAttr(german)}')" title="${starTitle}">&#9733;</button>`
      + `<button class="btn-delete" onclick="${deleteFn}('${escAttr(german)}')" title="Delete word">&#x2715;</button>`;
  }

  // Global delegated click for "Show translation" inside any word card
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".wc-trans-btn");
    if (!btn) return;
    btn.style.display = "none";
    btn.nextElementSibling.style.display = "block";
  });

  // --- Umlaut normalization ---

  function normalize(str) {
    return str
      .toLowerCase()
      .replace(/ä/g, "a")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ß/g, "ss");
  }

  // --- Word list ---

  async function loadWords() {
    try {
      [words] = await Promise.all([
        api("GET", "/api/words"),
        api("GET", "/api/words/stats").then(renderWordStats).catch(() => {}),
      ]);
      renderWords();
    } catch (e) {
      console.error("Failed to load words:", e);
    }
  }

  function renderWordStats(s) {
    if (!s || s.total === 0) { wordStatsEl.style.display = "none"; return; }
    const tile = (num, label, cls = "") =>
      `<div class="stat-tile"><span class="stat-tile-num ${cls}">${num}</span><span class="stat-tile-label">${label}</span></div>`;
    wordStatsEl.innerHTML =
      tile(s.mastered, "mastered", "stat-mastered") +
      tile(s.active, "in progress") +
      tile(s.never_seen, "never seen", "stat-new") +
      tile(s.box1, "box 1 only", "stat-box1") +
      (s.accuracy !== null ? tile(s.accuracy + "%", "accuracy") : "");
    wordStatsEl.style.display = "flex";
  }

  function renderWords() {
    const sort = sortSelect.value;
    let sorted = [...words];

    if (sort === "alpha") {
      sorted.sort((a, b) => a.german.localeCompare(b.german, "de"));
    } else if (sort === "box") {
      sorted.sort((a, b) => a.box - b.box || a.german.localeCompare(b.german, "de"));
    } else {
      sorted.sort((a, b) => (b.added_at || "").localeCompare(a.added_at || ""));
    }

    // Apply starred filter
    const displayed = filterStarred ? sorted.filter((w) => w.starred) : sorted;

    const countLabel = filterStarred
      ? `${displayed.length} starred / ${words.length} total`
      : `${words.length} item${words.length !== 1 ? "s" : ""}`;
    wordCountEl.textContent = countLabel;

    if (displayed.length === 0) {
      wordListEl.innerHTML = filterStarred
        ? '<div style="text-align:center;color:var(--text-light);padding:40px;">No starred words yet. Click the ★ next to any word to star it.</div>'
        : '<div style="text-align:center;color:var(--text-light);padding:40px;">No words yet. Add your first German word or phrase above!</div>';
      return;
    }

    wordListEl.innerHTML = displayed
      .map((w) => {
        const dots = Array.from({ length: 5 }, (_, i) =>
          `<span class="box-dot${i < w.box ? " filled" : ""}"></span>`
        ).join("");

        const articlePrefix = w.article ? `${escHtml(w.article)} ` : "";
        const pluralSuffix = w.plural ? ` <span class="word-plural">(Pl. ${escHtml(w.plural)})</span>` : "";

        const detailParts = [];
        if (w.english_translation) detailParts.push(escHtml(w.english_translation));
        if (w.german_definition) detailParts.push(`<em>${escHtml(w.german_definition)}</em>`);
        if (w.context_note) detailParts.push(`(${escHtml(w.context_note)})`);
        const detailsHtml = detailParts.length
          ? `<div class="word-item-details">${detailParts.join(" &mdash; ")}</div>`
          : "";

        const starClass = w.starred ? "btn-star starred" : "btn-star";
        const starTitle = w.starred ? "Unstar this word" : "Star this word (prioritises it in practice)";

        return `
        <div class="word-item fade-in">
          <div class="word-item-main">
            <span class="word-german"><span class="word-article">${articlePrefix}</span>${escHtml(w.german)}${pluralSuffix}</span>
            <span class="word-box">${dots}</span>
            <span class="word-stats">${w.times_correct}/${w.times_seen} correct</span>
            <span class="word-actions">
              <button class="${starClass}" onclick="toggleStar('${escAttr(w.german)}')" title="${starTitle}">&#9733;</button>
              <button class="btn-reset-box" onclick="resetWordBox('${escAttr(w.german)}')" title="Reset to box 1">↺</button>
              <button class="btn-delete" onclick="deleteWord('${escAttr(w.german)}')" title="Delete">&#x2715;</button>
            </span>
          </div>
          ${detailsHtml}
        </div>`;
      })
      .join("");
  }

  function escHtml(s) {
    const el = document.createElement("span");
    el.textContent = s;
    return el.innerHTML;
  }

  function escAttr(s) {
    return s.replace(/'/g, "\\'").replace(/"/g, "&quot;");
  }

  // Add word
  let isAddingWord = false;

  addWordBtn.addEventListener("click", addWord);
  newWordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addWord();
  });

  async function addWord() {
    if (isAddingWord) return;
    const german = newWordInput.value.trim();
    if (!german) return;

    isAddingWord = true;
    const context_note = newContextInput.value.trim();

    try {
      addWordBtn.disabled = true;
      addWordBtn.classList.add("btn-loading");

      const validation = await api("POST", "/api/words/validate", {
        word: german,
        context_note,
      });

      addWordBtn.classList.remove("btn-loading");

      if (!validation.is_valid) {
        await showAlert(`"${german}" doesn't appear to be a valid German word or phrase.`);
        addWordBtn.disabled = false;
        return;
      }

      let finalWord = validation.corrected || german;
      if (finalWord !== german) {
        const accept = await showConfirm(
          `Did you mean "${finalWord}"?\n\n${validation.correction_note || "Spelling/capitalization was corrected."}`,
          "Yes, use this", "No, cancel"
        );
        if (!accept) {
          addWordBtn.disabled = false;
          return;
        }
      }

      const newWord = await api("POST", "/api/words", {
        german: finalWord,
        context_note,
        german_definition: validation.german_definition || "",
        english_translation: validation.english_translation || "",
        article: validation.article || "",
        plural: validation.plural || "",
        preteritum: validation.preteritum || "",
        partizip2: validation.partizip2 || "",
      });

      words.push(newWord);
      renderWords();
      api("GET", "/api/words/stats").then(renderWordStats).catch(() => {});
      newWordInput.value = "";
      newContextInput.value = "";
      newWordInput.focus();
    } catch (e) {
      addWordBtn.classList.remove("btn-loading");
      await showAlert(e.message);
    } finally {
      addWordBtn.disabled = false;
      isAddingWord = false;
    }
  }

  window.deleteWord = async function (german) {
    if (!await showConfirm(`Delete "${german}"?`, "Delete", "Cancel")) return;

    try {
      await api("DELETE", `/api/words/${encodeURIComponent(german)}`);
      words = words.filter((w) => w.german !== german);
      renderWords();
      api("GET", "/api/words/stats").then(renderWordStats).catch(() => {});
    } catch (e) {
      await showAlert(e.message);
    }
  };

  window.toggleStar = async function (german) {
    const word = words.find((w) => w.german === german);
    if (!word) return;
    const newStarred = !word.starred;
    try {
      await api("PATCH", `/api/words/${encodeURIComponent(german)}`, { starred: newStarred });
      word.starred = newStarred;
      renderWords();
    } catch (e) {
      await showAlert("Failed to update star: " + e.message);
    }
  };

  // Called from star/delete buttons inside sentence practice reveals
  window.practiceToggleStar = async function (german) {
    const word = words.find((w) => w.german === german);
    if (!word) return;
    const newStarred = !word.starred;
    try {
      await api("PATCH", `/api/words/${encodeURIComponent(german)}`, { starred: newStarred });
      word.starred = newStarred;
      // Re-render both action areas (only one is visible at a time)
      [compWordActions, mcWordActions].forEach((el) => {
        if (el && el.style.display !== "none") {
          el.innerHTML = buildPracticeActions(german);
        }
      });
    } catch (e) {
      await showAlert("Failed to update star: " + e.message);
    }
  };

  window.practiceDeleteWord = async function (german) {
    if (!await showConfirm(`Delete "${german}" from your word list?`, "Delete", "Cancel")) return;
    try {
      await api("DELETE", `/api/words/${encodeURIComponent(german)}`);
      words = words.filter((w) => w.german !== german);
      deletedDuringSession.add(german);
      // Replace action area with a subtle "deleted" note
      [compWordActions, mcWordActions].forEach((el) => {
        if (el && el.style.display !== "none") {
          el.innerHTML = '<span class="practice-word-deleted">Word deleted</span>';
        }
      });
    } catch (e) {
      await showAlert("Failed to delete: " + e.message);
    }
  };

  sortSelect.addEventListener("change", renderWords);

  starFilterBtn.addEventListener("click", () => {
    filterStarred = !filterStarred;
    starFilterBtn.classList.toggle("active", filterStarred);
    renderWords();
  });

  // --- Grammar ---

  async function loadGrammar() {
    try {
      grammarPoints = await api("GET", "/api/grammar");

      // Auto-enrich any legacy points that haven't been processed yet
      const needsEnrich = grammarPoints.some((gp) => !gp.rule_name);
      if (needsEnrich) {
        grammarEnrichBanner.style.display = "flex";
        try {
          await api("POST", "/api/grammar/enrich-all");
          grammarPoints = await api("GET", "/api/grammar");
        } catch (e) {
          console.error("Failed to enrich grammar:", e);
        }
        grammarEnrichBanner.style.display = "none";
      }

      renderGrammar();
    } catch (e) {
      console.error("Failed to load grammar:", e);
    }
  }

  function renderGrammar() {
    grammarCountEl.textContent = `${grammarPoints.length} point${grammarPoints.length !== 1 ? "s" : ""}`;

    if (grammarPoints.length === 0) {
      grammarListEl.innerHTML =
        '<div style="text-align:center;color:var(--text-light);padding:40px;">No grammar rules yet. Describe a rule in your own words — e.g. "konjuktiv 2" or "infinitiv with zu after verbs" — and the AI will expand it.</div>';
      return;
    }

    grammarListEl.innerHTML = grammarPoints
      .map((gp) => {
        const enabled = gp.enabled !== false;
        const dimClass = enabled ? "" : " grammar-disabled";
        const title = gp.rule_name || gp.hint;
        const examplesHtml = (gp.examples || [])
          .map((ex) => `<li class="grammar-example"><span class="grammar-example-de">${escHtml(ex.german)}</span><span class="grammar-example-en">${escHtml(ex.english)}</span></li>`)
          .join("");

        return `
        <div class="word-item grammar-item fade-in${dimClass}" id="gpcard-${escAttr(gp.id)}">
          <div class="word-item-main">
            <label class="grammar-toggle">
              <input type="checkbox" ${enabled ? "checked" : ""} onchange="toggleGrammar('${escAttr(gp.id)}', this.checked)">
            </label>
            <span class="grammar-rule-name">${escHtml(title)}</span>
            <span class="word-actions">
              <button class="btn-edit" onclick="editGrammar('${escAttr(gp.id)}')" title="Edit">&#x270E;</button>
              <button class="btn-delete" onclick="deleteGrammar('${escAttr(gp.id)}')" title="Delete">&#x2715;</button>
            </span>
          </div>
          ${gp.explanation ? `<div class="grammar-explanation">${escHtml(gp.explanation)}</div>` : ""}
          ${examplesHtml ? `<ul class="grammar-examples-list">${examplesHtml}</ul>` : ""}
          <div class="grammar-edit-area" id="gpedit-${escAttr(gp.id)}" style="display:none;">
            <textarea placeholder="Describe your changes...">${escHtml(gp.rule_name ? gp.rule_name + "\n\n" + gp.explanation : gp.hint)}</textarea>
            <div class="grammar-edit-buttons">
              <button class="btn btn-primary btn-small" onclick="saveGrammarEdit('${escAttr(gp.id)}')">Save</button>
              <button class="btn btn-ghost btn-small" onclick="cancelGrammarEdit('${escAttr(gp.id)}')">Cancel</button>
            </div>
          </div>
        </div>`;
      })
      .join("");
  }

  addGrammarBtn.addEventListener("click", addGrammar);
  newGrammarInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addGrammar();
  });

  async function addGrammar() {
    const hint = newGrammarInput.value.trim();
    if (!hint) return;

    try {
      addGrammarBtn.disabled = true;
      addGrammarBtn.classList.add("btn-loading");
      const gp = await api("POST", "/api/grammar", { hint });
      grammarPoints.push(gp);
      renderGrammar();
      newGrammarInput.value = "";
      newGrammarInput.focus();
    } catch (e) {
      await showAlert(e.message);
    } finally {
      addGrammarBtn.disabled = false;
      addGrammarBtn.classList.remove("btn-loading");
    }
  }

  window.deleteGrammar = async function (id) {
    if (!await showConfirm("Delete this grammar point?", "Delete", "Cancel")) return;

    try {
      await api("DELETE", `/api/grammar/${encodeURIComponent(id)}`);
      grammarPoints = grammarPoints.filter((gp) => gp.id !== id);
      renderGrammar();
    } catch (e) {
      await showAlert(e.message);
    }
  };

  window.toggleGrammar = async function (id, enabled) {
    try {
      const updated = await api("PATCH", `/api/grammar/${encodeURIComponent(id)}`, { enabled });
      const idx = grammarPoints.findIndex((gp) => gp.id === id);
      if (idx !== -1) grammarPoints[idx] = updated;
      renderGrammar();
    } catch (e) {
      await showAlert(e.message);
      renderGrammar(); // revert checkbox visually
    }
  };

  window.editGrammar = function (id) {
    document.getElementById(`gpedit-${id}`).style.display = "block";
  };

  window.cancelGrammarEdit = function (id) {
    document.getElementById(`gpedit-${id}`).style.display = "none";
  };

  window.saveGrammarEdit = async function (id) {
    const area = document.getElementById(`gpedit-${id}`);
    const raw_input = area.querySelector("textarea").value.trim();
    if (!raw_input) return;

    const saveBtn = area.querySelector(".btn-primary");
    saveBtn.disabled = true;
    saveBtn.classList.add("btn-loading");

    try {
      const updated = await api("PATCH", `/api/grammar/${encodeURIComponent(id)}`, { raw_input });
      const idx = grammarPoints.findIndex((gp) => gp.id === id);
      if (idx !== -1) grammarPoints[idx] = updated;
      renderGrammar();
    } catch (e) {
      await showAlert(e.message);
      saveBtn.disabled = false;
      saveBtn.classList.remove("btn-loading");
    }
  };

  // --- Practice ---

  function showPracticeState(state) {
    [practiceIdle, practiceLoading, practiceError, practiceActive, practiceSummary, practicePassage, practiceWriting].forEach(
      (el) => (el.style.display = "none")
    );
    state.style.display = "flex";
    contentEl.classList.toggle("content--wide", state === practiceWriting);
  }

  async function startPractice(fromSummary) {
    audioRequested = fromSummary ? summaryAudioCheckbox.checked : audioCheckbox.checked;
    showPracticeState(practiceLoading);

    try {
      const data = await api("POST", "/api/practice/batch");
      batch = data.batch;
      currentIndex = 0;
      correctCount = 0;
      deletedDuringSession = new Set();

      if (batch.length === 0) {
        throw new Error("No words to practice. Add some words first!");
      }

      // Fall back multiple_choice to comprehension if not enough words for distractors
      if (words.length < 4) {
        batch.forEach((item) => {
          if (item.mode === "multiple_choice") item.mode = "comprehension";
        });
      }

      showPracticeState(practiceActive);
      showCurrentWord();
    } catch (e) {
      errorMsg.textContent = e.message;
      showPracticeState(practiceError);
    }
  }

  startBtn.addEventListener("click", () => startPractice(false));
  retryBtn.addEventListener("click", () => startPractice(false));
  nextBatchBtn.addEventListener("click", () => startPractice(true));
  doneBtn.addEventListener("click", () => {
    showPracticeState(practiceIdle);
    tabs.forEach((t) => t.classList.remove("active"));
    tabs[0].classList.add("active");
    wordsView.classList.add("active");
    grammarView.classList.remove("active");
    practiceView.classList.remove("active");
    insightsView.classList.remove("active");
    settingsView.classList.remove("active");
    loadWords();
  });

  function updateProgress() {
    const total = batch.length;
    const pct = ((currentIndex) / total) * 100;
    progressBar.style.width = pct + "%";
    progressText.textContent = `${currentIndex + 1} / ${total}`;
  }

  function showCurrentWord() {
    currentAnswered = false;
    currentAudioData = null;
    const item = batch[currentIndex];
    updateProgress();

    // Reset all modes
    modeComp.style.display = "none";
    modeMC.style.display = "none";
    compWordActions.style.display = "none";
    mcWordActions.style.display = "none";

    if (item.mode === "multiple_choice") {
      showMultipleChoice(item);
    } else {
      showComprehension(item);
    }
  }

  // --- Comprehension mode ---

  function showComprehension(item) {
    modeComp.style.display = "block";

    // Use word_in_sentence for highlighting (handles split verbs via " / ")
    const wordToHighlight = item.word_in_sentence || item.german;
    const highlighted = highlightWord(item.sentence, wordToHighlight);
    compSentence.innerHTML = highlighted;

    // Reset translation area
    compTranslation.style.display = "none";
    compTranslation.textContent = item.translation;

    compWordCard.style.display = "none";
    compWordCard.className = "";  // remove target-word-reveal styling
    compWordCard.innerHTML = buildWordCard({
      german: item.german,
      article: item.article,
      plural: item.plural,
      preteritum: item.preteritum,
      partizip2: item.partizip2,
      german_definition: item.german_definition,
      english_translation: item.english_translation,
      form_in_sentence: item.word_in_sentence,
    });

    compDefinition.style.display = "none";  // never shown separately anymore

    compGrammarNote.style.display = "none";
    if (item.grammar_note) {
      compGrammarNote.innerHTML = `<strong>Grammar:</strong> ${escHtml(item.grammar_note)}`;
    }

    showTranslationBtn.style.display = "inline-block";
    compButtons.style.display = "none";
    audioReplayBar.style.display = "none";

    // Audio phase
    if (audioRequested) {
      compAudioPhase.style.display = "block";
      listenBtn.style.display = "inline-block";
      audioLoading.style.display = "none";
      showSentenceBtn.style.display = "none";
      compSentenceArea.style.display = "none";
      showTranslationBtn.style.display = "none";
    } else {
      compAudioPhase.style.display = "none";
      compSentenceArea.style.display = "block";
      showTranslationBtn.style.display = "inline-block";
    }
  }

  // Audio: Listen button
  listenBtn.addEventListener("click", async () => {
    const item = batch[currentIndex];
    listenBtn.style.display = "none";
    audioLoading.style.display = "flex";

    try {
      const result = await api("POST", "/api/practice/audio", { text: item.sentence });
      currentAudioData = result.audio;
      playAudio(currentAudioData, currentPlaybackSpeed);
    } catch (e) {
      console.error("Audio failed:", e);
    }

    audioLoading.style.display = "none";
    showSentenceBtn.style.display = "inline-block";

    // Show replay bar
    if (currentAudioData) {
      audioReplayBar.style.display = "flex";
    }
  });

  // Audio: Show Sentence button
  showSentenceBtn.addEventListener("click", () => {
    compAudioPhase.style.display = "none";
    compSentenceArea.style.display = "block";
    showTranslationBtn.style.display = "inline-block";
    // Replay bar stays visible
  });

  // Audio: Replay button
  replayBtn.addEventListener("click", () => {
    if (currentAudioData) {
      playAudio(currentAudioData, currentPlaybackSpeed);
    }
  });

  // Audio: Speed buttons
  speedBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      speedBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentPlaybackSpeed = parseFloat(btn.dataset.speed);
      // Replay at new speed immediately
      if (currentAudioData) {
        playAudio(currentAudioData, currentPlaybackSpeed);
      }
    });
  });

  function playAudio(dataUrl, speed) {
    const audio = new Audio(dataUrl);
    audio.playbackRate = speed;
    audio.play();
  }

  showTranslationBtn.addEventListener("click", () => {
    const item = batch[currentIndex];
    compTranslation.style.display = "block";
    compTranslation.classList.add("fade-in");
    compWordCard.style.display = "block";
    compWordCard.classList.add("fade-in");
    if (item.grammar_note) {
      compGrammarNote.style.display = "block";
      compGrammarNote.classList.add("fade-in");
    }
    showTranslationBtn.style.display = "none";
    compButtons.style.display = "flex";
    compButtons.classList.add("fade-in");

    // Show star/delete actions for this word
    compWordActions.innerHTML = buildPracticeActions(item.german);
    compWordActions.style.display = "flex";
  });

  compButtons.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-correct]");
    if (!btn || currentAnswered) return;
    currentAnswered = true;

    const correct = btn.dataset.correct === "true";
    if (correct) correctCount++;

    recordResult(batch[currentIndex].german, correct, "comprehension").then(() => {
      advanceToNext();
    });
  });

  // --- Multiple choice mode ---

  function showMultipleChoice(item) {
    modeMC.style.display = "block";

    mcSentence.innerHTML = formatBlankSentence(item.blank_sentence);

    // Build 4 choices: correct + 3 distractors
    const distractors = getDistractors(item.german, 3);
    const choices = [item.german, ...distractors];
    shuffleArray(choices);

    mcChoices.innerHTML = choices
      .map((word) => `<button class="btn btn-secondary mc-btn" data-word="${escAttr(word)}">${escHtml(word)}</button>`)
      .join("");

    mcFeedback.style.display = "none";
    mcFeedback.className = "fill-feedback";
    mcWrongWord.style.display = "none";
    mcTranslation.style.display = "none";
    mcWordCard.style.display = "none";
    mcDefinition.style.display = "none";
    mcGrammarNote.style.display = "none";
  }

  mcChoices.addEventListener("click", (e) => {
    const btn = e.target.closest(".mc-btn");
    if (!btn || currentAnswered) return;
    currentAnswered = true;

    const item = batch[currentIndex];
    const picked = btn.dataset.word;
    const correct = picked === item.german;

    // Highlight correct/wrong buttons
    mcChoices.querySelectorAll(".mc-btn").forEach((b) => {
      b.disabled = true;
      if (b.dataset.word === item.german) {
        b.classList.add("mc-correct");
      } else if (b === btn && !correct) {
        b.classList.add("mc-wrong");
      }
    });

    mcFeedback.style.display = "block";
    mcFeedback.classList.add("fade-in");

    const inSentence = item.blank_answer || item.word_in_sentence || item.german;
    const showForm = inSentence !== item.german ? ` ("${inSentence}" in this sentence)` : "";

    if (correct) {
      correctCount++;
      mcFeedback.classList.add("correct");
      mcFeedbackText.innerHTML = `Correct! The word is "${escHtml(item.german)}"${escHtml(showForm)}.`;
      mcWrongWord.style.display = "none";
    } else {
      mcFeedback.classList.add("wrong");
      mcFeedbackText.innerHTML = `The correct answer is "<strong>${escHtml(item.german)}</strong>"${escHtml(showForm)}.`;

      // Show word card for the wrong word so user can learn what it actually means
      const pickedWord = words.find((w) => w.german === picked);
      if (pickedWord) {
        mcWrongWord.innerHTML = `<div class="mc-wrong-label">You picked:</div>`
          + buildWordCard({
            german: pickedWord.german,
            article: pickedWord.article,
            plural: pickedWord.plural,
            preteritum: pickedWord.preteritum,
            partizip2: pickedWord.partizip2,
            german_definition: pickedWord.german_definition,
            english_translation: pickedWord.english_translation,
          });
        mcWrongWord.style.display = "block";
      }
    }

    // Show reveal details for the correct word
    mcTranslation.textContent = item.translation;
    mcTranslation.style.display = "block";

    mcWordCard.className = "";
    mcWordCard.innerHTML = buildWordCard({
      german: item.german,
      article: item.article,
      plural: item.plural,
      preteritum: item.preteritum,
      partizip2: item.partizip2,
      german_definition: item.german_definition,
      english_translation: item.english_translation,
      form_in_sentence: inSentence,
    });
    mcWordCard.style.display = "block";

    if (item.grammar_note) {
      mcGrammarNote.innerHTML = `<strong>Grammar:</strong> ${escHtml(item.grammar_note)}`;
      mcGrammarNote.style.display = "block";
    }

    // Show star/delete actions for this word
    mcWordActions.innerHTML = buildPracticeActions(item.german);
    mcWordActions.style.display = "flex";

    recordResult(item.german, correct, "multiple_choice");
  });

  mcNextBtn.addEventListener("click", () => {
    if (!currentAnswered) return;
    advanceToNext();
  });

  function getDistractors(correctWord, count) {
    const others = words.filter((w) => w.german !== correctWord);
    const shuffled = [...others].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((w) => w.german);
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // --- Shared practice helpers ---

  function highlightWord(sentence, wordInSentence) {
    const escaped = escHtml(sentence);
    // Split by " / " for split verbs (e.g. "fange / an")
    const parts = wordInSentence.split(" / ");
    let result = escaped;
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Use word boundary to reduce false positives
      const regex = new RegExp(`\\b(${escRegex(trimmed)})\\b`, "gi");
      result = result.replace(regex, '<span class="highlight">$1</span>');
    }
    return result;
  }

  function formatBlankSentence(sentence) {
    return escHtml(sentence).replace(/_____/g, '<span class="blank">_____</span>');
  }

  function escRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async function recordResult(german, correct, mode) {
    try {
      await api("POST", "/api/practice/result", { german, correct, mode });
    } catch (e) {
      console.error("Failed to record result:", e);
    }
  }

  function advanceToNext() {
    currentIndex++;
    // Skip any words that were deleted during this session
    while (currentIndex < batch.length && deletedDuringSession.has(batch[currentIndex].german)) {
      currentIndex++;
    }
    if (currentIndex >= batch.length) {
      showSummary();
    } else {
      showCurrentWord();
    }
  }

  function showSummary() {
    progressBar.style.width = "100%";
    showPracticeState(practiceSummary);
    summaryScore.textContent = `${correctCount} / ${batch.length}`;

    // Show audio toggle on summary if audio is available
    if (audioEnabled) {
      summaryAudioOptIn.style.display = "block";
      summaryAudioCheckbox.checked = audioRequested;
    }
  }

  // --- Settings ---

  let settingsSchema = [];

  async function loadSettings() {
    try {
      settingsSchema = await api("GET", "/api/settings");
      renderSettings();
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }

  function renderSettings() {
    if (!settingsSchema.length) {
      settingsSections.innerHTML = '<p style="color:var(--text-light);">No settings available.</p>';
      return;
    }

    settingsSections.innerHTML = settingsSchema
      .map((section) => {
        const settingsHtml = section.settings
          .map((s) => {
            const step = s.type === "float" ? "0.05" : "1";
            return `
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-name">${escHtml(s.name)}</div>
                <div class="setting-desc">${escHtml(s.description)}</div>
              </div>
              <div class="setting-control">
                <input type="range" class="setting-range"
                  data-key="${escAttr(s.key)}"
                  data-type="${s.type}"
                  min="${s.min}" max="${s.max}" step="${step}"
                  value="${s.value}">
                <span class="setting-value" id="val-${s.key}">${formatSettingValue(s.value, s.type)}</span>
              </div>
            </div>`;
          })
          .join("");

        return `
        <div class="settings-section">
          <h3>${escHtml(section.section)}</h3>
          <p class="settings-section-desc">${escHtml(section.description)}</p>
          ${settingsHtml}
        </div>`;
      })
      .join("");

    // Attach change listeners
    settingsSections.querySelectorAll(".setting-range").forEach((input) => {
      input.addEventListener("input", (e) => {
        const key = e.target.dataset.key;
        const type = e.target.dataset.type;
        const raw = e.target.value;
        const value = type === "float" ? parseFloat(raw) : parseInt(raw, 10);
        document.getElementById("val-" + key).textContent = formatSettingValue(value, type);
      });

      input.addEventListener("change", (e) => {
        const key = e.target.dataset.key;
        const type = e.target.dataset.type;
        const raw = e.target.value;
        const value = type === "float" ? parseFloat(raw) : parseInt(raw, 10);
        saveSetting(key, value);
      });
    });
  }

  function formatSettingValue(value, type) {
    if (type === "float") return value.toFixed(2);
    return String(value);
  }

  async function saveSetting(key, value) {
    try {
      await api("PATCH", "/api/settings", { [key]: value });
    } catch (e) {
      console.error("Failed to save setting:", e);
    }
  }

  // --- Back buttons ---

  async function confirmBack() {
    return await showConfirm("Go back to the practice menu? Your current progress will be lost.", "Go back", "Stay");
  }

  activeBackBtn.addEventListener("click", async () => {
    if (!await confirmBack()) return;
    batch = [];
    currentIndex = 0;
    correctCount = 0;
    showPracticeState(practiceIdle);
  });

  passageBackBtn.addEventListener("click", async () => {
    if (!await confirmBack()) return;
    passageData = null;
    passageRatings = {};
    showPracticeState(practiceIdle);
  });

  writingBackBtn.addEventListener("click", async () => {
    if (!await confirmBack()) return;
    writingSetupData = null;
    showPracticeState(practiceIdle);
  });

  // --- Reading Passage mode ---

  startPassageBtn.addEventListener("click", startPassage);

  async function startPassage() {
    loadingMsg.textContent = "Generating passage...";
    showPracticeState(practiceLoading);

    try {
      passageData = await api("POST", "/api/practice/passage");
      showPassageReading();
    } catch (e) {
      loadingMsg.textContent = "Generating sentences...";
      errorMsg.textContent = e.message;
      showPracticeState(practiceError);
    }
  }

  function showPassageReading() {
    passageRatings = {};
    passageReviewSection.style.display = "none";
    passageReadingSection.style.display = "block";
    passageTranslationEl.style.display = "none";
    passageGrammarNotesEl.style.display = "none";
    passageShowTranslationBtn.style.display = "inline-block";

    // Render passage with highlighted clickable vocab words
    const rawPassage = passageData.passage || "";
    const wordsUsed = passageData.words_used || [];

    // Sort by form length descending to avoid partial matches
    const sorted = [...wordsUsed].sort((a, b) => b.form.length - a.form.length);

    // Split passage into paragraphs, highlight words in each paragraph
    const paragraphs = rawPassage.split(/\n\n+/);
    passageTextEl.innerHTML = paragraphs
      .map((para) => {
        const highlighted = highlightPassageWords(para, sorted);
        return `<p>${highlighted}</p>`;
      })
      .join("");

    // Render translation (hidden)
    passageTranslationEl.textContent = passageData.translation || "";

    // Render grammar notes (hidden)
    const grammarNotes = passageData.grammar_notes || [];
    if (grammarNotes.length > 0) {
      passageGrammarNotesEl.innerHTML =
        "<strong>Grammar notes:</strong><ul>" +
        grammarNotes
          .map((n) => `<li><em>${escHtml(n.rule)}:</em> ${escHtml(n.note)}</li>`)
          .join("") +
        "</ul>";
    } else {
      passageGrammarNotesEl.innerHTML = "";
    }

    showPracticeState(practicePassage);
  }

  function highlightPassageWords(text, wordsUsed) {
    // Escape the plain text first
    let escaped = escHtml(text);

    // We need to work on the plain text to find positions, then rebuild with HTML
    // Strategy: replace each form with a placeholder, then swap in spans
    // Use a placeholder that won't appear in German text
    const placeholders = [];

    // Work on the escaped text directly — forms are plain German words
    for (const wu of wordsUsed) {
      const form = wu.form;
      if (!form) continue;

      const escapedForm = escHtml(form);
      // Word boundary regex on the escaped form (HTML-escaped form should be same as plain for German text)
      const regex = new RegExp(`(?<![\\w\\u00C0-\\u024F])(${escRegex(escapedForm)})(?![\\w\\u00C0-\\u024F])`, "g");

      const placeholder = `\x00${placeholders.length}\x00`;
      const span = `<span class="vocab-word" data-word="${escAttr(wu.word)}" data-form="${escAttr(form)}">${escapedForm}</span>`;
      const replaced = escaped.replace(regex, (match) => {
        placeholders.push(span);
        return `\x00${placeholders.length - 1}\x00`;
      });
      escaped = replaced;
    }

    // Restore placeholders
    escaped = escaped.replace(/\x00(\d+)\x00/g, (_, i) => placeholders[parseInt(i)]);
    return escaped;
  }

  // Word popup
  passageTextEl.addEventListener("click", (e) => {
    const target = e.target.closest(".vocab-word");
    if (!target) {
      hideWordPopup();
      return;
    }

    const wordKey = target.dataset.word;
    const form = target.dataset.form;
    const wu = (passageData.words_used || []).find((w) => w.word === wordKey && w.form === form)
      || (passageData.words_used || []).find((w) => w.word === wordKey);

    if (!wu) return;

    // Build popup content using word card
    wordPopupContent.innerHTML = buildWordCard({
      german: wu.word,
      article: wu.article,
      plural: wu.plural,
      preteritum: wu.preteritum,
      partizip2: wu.partizip2,
      german_definition: wu.german_definition,
      english_translation: wu.english_translation,
    });

    // Position popup near the clicked word
    const rect = target.getBoundingClientRect();
    wordPopup.style.display = "block";
    const popupWidth = 280;
    let left = rect.left + window.scrollX;
    if (left + popupWidth > window.innerWidth - 16) {
      left = window.innerWidth - popupWidth - 16;
    }
    wordPopup.style.left = Math.max(8, left) + "px";
    wordPopup.style.top = (rect.bottom + window.scrollY + 8) + "px";
  });

  wordPopupClose.addEventListener("click", hideWordPopup);

  document.addEventListener("click", (e) => {
    if (!wordPopup.contains(e.target) && !e.target.closest(".vocab-word") && !e.target.closest(".writing-word-chip")) {
      hideWordPopup();
    }
  });

  function hideWordPopup() {
    wordPopup.style.display = "none";
  }

  passageShowTranslationBtn.addEventListener("click", () => {
    passageTranslationEl.style.display = "block";
    passageTranslationEl.classList.add("fade-in");
    if (passageGrammarNotesEl.innerHTML) {
      passageGrammarNotesEl.style.display = "block";
      passageGrammarNotesEl.classList.add("fade-in");
    }
    passageShowTranslationBtn.style.display = "none";
  });

  passageDoneReadingBtn.addEventListener("click", showPassageReview);

  function showPassageReview() {
    hideWordPopup();
    passageReadingSection.style.display = "none";
    passageReviewSection.style.display = "block";
    passageDeletedWords = new Set();

    const wordsUsed = passageData.words_used || [];
    passageWordListEl.innerHTML = wordsUsed
      .map((wu) => `
          <div class="passage-review-card" id="prcard-${escAttr(wu.word)}">
            <div class="passage-card-info">
              ${buildWordCard({
                german: wu.word,
                article: wu.article,
                plural: wu.plural,
                preteritum: wu.preteritum,
                partizip2: wu.partizip2,
                german_definition: wu.german_definition,
                english_translation: wu.english_translation,
              })}
            </div>
            <div class="passage-card-btns">
              <button class="btn btn-knew" data-word="${escAttr(wu.word)}" data-correct="true">&#10003; Knew it</button>
              <button class="btn btn-didnt" data-word="${escAttr(wu.word)}" data-correct="false">&#10007; Didn't know</button>
              <span class="passage-btns-sep">|</span>
              ${buildPracticeActions(wu.word, { starFn: "passageReviewToggleStar", deleteFn: "passageReviewDeleteWord" })}
            </div>
          </div>`)
      .join("");
  }

  passageWordListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-correct]");
    if (!btn) return;
    const wordKey = btn.dataset.word;
    const correct = btn.dataset.correct === "true";

    passageRatings[wordKey] = correct;

    // Visual feedback: mark selected button
    const card = document.getElementById(`prcard-${escAttr(wordKey)}`);
    if (card) {
      card.querySelectorAll(".btn-knew, .btn-didnt").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    }
  });

  window.passageReviewToggleStar = async function (german) {
    const word = words.find((w) => w.german === german);
    if (!word) return;
    const newStarred = !word.starred;
    try {
      await api("PATCH", `/api/words/${encodeURIComponent(german)}`, { starred: newStarred });
      word.starred = newStarred;
      // Update the star button(s) in the review cards for this word
      const card = document.getElementById(`prcard-${escAttr(german)}`);
      if (card) {
        const starBtn = card.querySelector(".btn-star");
        if (starBtn) {
          starBtn.className = newStarred ? "btn-star starred" : "btn-star";
          starBtn.title = newStarred ? "Unstar this word" : "Star this word";
        }
      }
    } catch (e) {
      await showAlert("Failed to update star: " + e.message);
    }
  };

  window.passageReviewDeleteWord = async function (german) {
    if (!await showConfirm(`Delete "${german}" from your word list?`, "Delete", "Cancel")) return;
    try {
      await api("DELETE", `/api/words/${encodeURIComponent(german)}`);
      words = words.filter((w) => w.german !== german);
      passageDeletedWords.add(german);
      const card = document.getElementById(`prcard-${escAttr(german)}`);
      if (card) card.classList.add("pr-deleted");
    } catch (e) {
      await showAlert("Failed to delete: " + e.message);
    }
  };

  passageFinishBtn.addEventListener("click", async () => {
    // Record results for all rated words (skip deleted ones)
    const wordsUsed = passageData.words_used || [];
    for (const wu of wordsUsed) {
      if (passageDeletedWords.has(wu.word)) continue;
      const correct = passageRatings.hasOwnProperty(wu.word) ? passageRatings[wu.word] : false;
      await recordResult(wu.word, correct, "reading_passage");
    }

    // Reset and go back to idle, then reload words
    passageData = null;
    passageRatings = {};
    loadingMsg.textContent = "Generating sentences...";
    showPracticeState(practiceIdle);
    loadWords();
  });

  // --- Writing Passage mode ---

  startWritingBtn.addEventListener("click", startWritingPassage);

  async function startWritingPassage() {
    loadingMsg.textContent = "Preparing writing prompt...";
    showPracticeState(practiceLoading);

    try {
      writingSetupData = await api("POST", "/api/practice/writing-setup");
      showWritingSetup();
    } catch (e) {
      loadingMsg.textContent = "Generating sentences...";
      errorMsg.textContent = e.message;
      showPracticeState(practiceError);
    }
  }

  function showWritingSetup() {
    writingSetupSection.style.display = "block";
    writingFeedbackSection.style.display = "none";

    const d = writingSetupData;

    // Topic
    writingTopicEl.textContent = d.topic || "";
    writingTopicDeEl.textContent = d.topic_de || "";

    // Grammar point (always visible)
    const gh = d.grammar_hint;
    if (gh && gh.rule_name) {
      writingGrammarName.textContent = gh.rule_name;
      writingGrammarExplanation.textContent = gh.explanation || "";
      writingGrammarExamples.innerHTML = (gh.examples || [])
        .map((ex) => `<li><span class="writing-ex-de">${escHtml(ex.german || ex)}</span>${ex.english ? `<span class="writing-ex-en">${escHtml(ex.english)}</span>` : ""}</li>`)
        .join("");
      writingGrammarBlock.style.display = "block";
    } else {
      writingGrammarBlock.style.display = "none";
    }

    // Word suggestion chips
    const words = d.suggested_words || [];
    writingWordsGrid.innerHTML = words
      .map((w) => {
        const label = w.article ? `${w.article} ${w.german}` : w.german;
        return `<button class="writing-word-chip" data-word="${escAttr(w.german)}">${escHtml(label)}</button>`;
      })
      .join("");

    // Reset input area and inline card slot
    writingInput.value = "";
    writingInput.disabled = false;
    writingSubmitBtn.disabled = false;
    writingLoadingEl.style.display = "none";
    writingWordCardSlot.style.display = "none";
    writingWordCardSlot.innerHTML = "";
    activeChip = null;

    showPracticeState(practiceWriting);
    setTimeout(() => writingInput.focus(), 100);
  }

  // Word chip click → show inline card below the chip grid
  let activeChip = null;
  writingWordsGrid.addEventListener("click", (e) => {
    const chip = e.target.closest(".writing-word-chip");
    if (!chip) return;

    // Toggle: clicking the same chip again closes the card
    if (chip === activeChip) {
      writingWordCardSlot.style.display = "none";
      writingWordCardSlot.innerHTML = "";
      chip.classList.remove("active");
      activeChip = null;
      return;
    }

    const wordKey = chip.dataset.word;
    const wordObj = (writingSetupData.suggested_words || []).find((w) => w.german === wordKey);
    if (!wordObj) return;

    if (activeChip) activeChip.classList.remove("active");
    chip.classList.add("active");
    activeChip = chip;

    writingWordCardSlot.innerHTML = buildWordCard({
      german: wordObj.german,
      article: wordObj.article,
      plural: wordObj.plural,
      preteritum: wordObj.preteritum,
      partizip2: wordObj.partizip2,
      german_definition: wordObj.german_definition,
      english_translation: wordObj.english_translation,
    });
    writingWordCardSlot.style.display = "block";
  });

  // Submit writing
  writingSubmitBtn.addEventListener("click", submitWritingPassage);

  async function submitWritingPassage() {
    const passage = writingInput.value.trim();
    if (!passage) return;

    writingInput.disabled = true;
    writingSubmitBtn.disabled = true;
    writingLoadingEl.style.display = "flex";

    const d = writingSetupData;
    const suggestedWordNames = (d.suggested_words || []).map((w) => w.german);

    try {
      const result = await api("POST", "/api/practice/writing-judge", {
        passage,
        topic: d.topic || "",
        grammar_hint: d.grammar_hint || null,
        suggested_words: suggestedWordNames,
      });

      writingLoadingEl.style.display = "none";
      showWritingFeedback(result, passage);

      // Fire-and-forget: analyze errors and update mistake patterns
      if (result.has_errors && result.errors && result.errors.length > 0) {
        api("POST", "/api/practice/writing-analyze", { errors: result.errors }).catch(() => {});
      }
    } catch (e) {
      writingLoadingEl.style.display = "none";
      writingInput.disabled = false;
      writingSubmitBtn.disabled = false;
      await showAlert("Failed to check your writing: " + e.message);
    }
  }

  function showWritingFeedback(result, passage) {
    writingSetupSection.style.display = "none";
    writingFeedbackSection.style.display = "block";

    // Score badge
    const score = result.overall_score || "okay";
    const scoreLabels = { good: "Good", okay: "Okay", needs_work: "Needs Work" };
    writingScoreBadge.textContent = scoreLabels[score] || score;
    writingScoreBadge.className = `writing-score-badge ${score}`;

    // Overall feedback
    writingOverallFeedback.textContent = result.overall_feedback || "";

    // Grammar usage
    const gh = writingSetupData.grammar_hint;
    if (gh && gh.rule_name) {
      const used = result.grammar_used;
      writingGrammarFeedbackEl.innerHTML =
        `<span class="writing-grammar-used ${used ? "yes" : "no"}">${used ? "✓ Used" : "✗ Not used"}: ${escHtml(gh.rule_name)}</span>` +
        (result.grammar_feedback ? `<div class="writing-grammar-feedback-text">${escHtml(result.grammar_feedback)}</div>` : "");
      writingGrammarSection.style.display = "block";
    } else {
      writingGrammarSection.style.display = "none";
    }

    // Vocabulary used
    const vocabUsed = result.vocabulary_used || [];
    if (vocabUsed.length > 0) {
      writingVocabUsed.innerHTML = vocabUsed
        .map((w) => `<span class="writing-vocab-chip">${escHtml(w)}</span>`)
        .join("");
      writingVocabSection.style.display = "block";
    } else {
      writingVocabSection.style.display = "none";
    }

    // Errors
    const errors = result.errors || [];
    if (errors.length > 0) {
      writingErrorsList.innerHTML =
        `<div class="writing-your-passage">${escHtml(passage)}</div>` +
        errors
          .map(
            (err) => `
          <div class="writing-error-item">
            <div class="writing-error-original">${escHtml(err.original)}</div>
            <div class="writing-error-corrected">→ ${escHtml(err.corrected)}</div>
            <div class="writing-error-explanation">${escHtml(err.explanation)}</div>
          </div>`
          )
          .join("");
      writingErrorsSection.style.display = "block";
    } else {
      writingErrorsSection.style.display = "none";
    }

    writingFeedbackSection.classList.add("fade-in");
  }

  writingDoneBtn.addEventListener("click", () => {
    writingSetupData = null;
    loadingMsg.textContent = "Generating sentences...";
    showPracticeState(practiceIdle);
    loadWords();
  });

  // --- Insights ---

  async function loadInsights() {
    try {
      mistakePatterns = await api("GET", "/api/mistakes");
      renderInsights();
    } catch (e) {
      insightsListEl.innerHTML = `<p class="insights-load-error">Failed to load insights.</p>`;
    }
  }

  function renderInsights() {
    if (!mistakePatterns || mistakePatterns.length === 0) {
      insightsEmptyEl.style.display = "block";
      insightsListEl.innerHTML = "";
      return;
    }
    insightsEmptyEl.style.display = "none";
    insightsListEl.innerHTML = mistakePatterns.map(renderMistakeCard).join("");

    // Attach event listeners
    insightsListEl.querySelectorAll(".mistake-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!await showConfirm("Remove this mistake pattern?", "Remove", "Cancel")) return;
        try {
          await api("DELETE", `/api/mistakes/${id}`);
          mistakePatterns = mistakePatterns.filter((mp) => mp.id !== id);
          renderInsights();
        } catch (e) {
          await showAlert("Failed to delete: " + e.message);
        }
      });
    });

    insightsListEl.querySelectorAll(".mistake-practice-btn").forEach((btn) => {
      btn.addEventListener("click", () => startMistakeDrill(btn.dataset.id));
    });
  }

  function renderMistakeCard(mp) {
    const lastSeenDate = mp.last_seen ? new Date(mp.last_seen) : null;
    const today = new Date();
    const daysSince = lastSeenDate
      ? Math.floor((today - lastSeenDate) / (1000 * 60 * 60 * 24))
      : null;
    const isFaded = daysSince !== null && daysSince >= 30;
    const lastSeenText = daysSince === null
      ? ""
      : daysSince === 0
      ? "last seen today"
      : daysSince === 1
      ? "last seen yesterday"
      : `last seen ${daysSince} days ago`;

    const examplesHtml = (mp.examples || []).slice(-3).reverse().map((ex) => `
      <div class="mistake-example">
        <span class="mistake-example-wrong">${escHtml(ex.mistake)}</span>
        <span class="mistake-example-arrow">→</span>
        <span class="mistake-example-right">${escHtml(ex.correction)}</span>
      </div>`).join("");

    return `
      <div class="mistake-card ${isFaded ? "mistake-card--faded" : ""}">
        <div class="mistake-card-header">
          <div class="mistake-card-title-row">
            <span class="mistake-category">${escHtml(mp.category)}</span>
            <span class="mistake-count-badge">${mp.count}×</span>
          </div>
          <div class="mistake-card-meta">
            ${lastSeenText ? `<span class="mistake-last-seen ${isFaded ? "mistake-last-seen--old" : ""}">${lastSeenText}</span>` : ""}
          </div>
        </div>
        <div class="mistake-description">${escHtml(mp.description)}</div>
        ${examplesHtml ? `<div class="mistake-examples">${examplesHtml}</div>` : ""}
        <div class="mistake-card-actions">
          <button class="btn btn-secondary btn-small mistake-practice-btn" data-id="${mp.id}">Practice this</button>
          <button class="btn btn-ghost btn-small mistake-delete-btn" data-id="${mp.id}">Delete</button>
        </div>
        <div class="mistake-drill-section" id="drill-${mp.id}" style="display:none;"></div>
      </div>`;
  }

  async function startMistakeDrill(id) {
    const drillSection = document.getElementById(`drill-${id}`);
    const practiceBtn = insightsListEl.querySelector(`.mistake-practice-btn[data-id="${id}"]`);
    if (!drillSection) return;

    drillSection.style.display = "block";
    drillSection.innerHTML = `<div class="mistake-drill-loading"><div class="spinner-small"></div><span>Generating exercises...</span></div>`;
    if (practiceBtn) practiceBtn.disabled = true;

    try {
      const result = await api("POST", `/api/mistakes/${id}/drill`);
      const exercises = result.exercises || [];
      renderMistakeDrill(drillSection, exercises, id, practiceBtn);
    } catch (e) {
      drillSection.innerHTML = `<p class="drill-error">Failed to generate exercises: ${escHtml(e.message)}</p>`;
      if (practiceBtn) practiceBtn.disabled = false;
    }
  }

  function renderMistakeDrill(container, exercises, id, practiceBtn) {
    if (!exercises.length) {
      container.innerHTML = `<p class="drill-error">No exercises generated.</p>`;
      if (practiceBtn) practiceBtn.disabled = false;
      return;
    }

    const exercisesHtml = exercises.map((ex, i) => {
      const parts = ex.sentence.split("___");
      return `
        <div class="drill-exercise" id="drill-ex-${id}-${i}">
          <div class="drill-sentence">
            ${escHtml(parts[0])}<input type="text" class="drill-input" data-index="${i}" data-answer="${escHtml(ex.answer)}" placeholder="${escHtml(ex.hint)}" autocomplete="off">${escHtml(parts[1] || "")}
          </div>
          <div class="drill-feedback" id="drill-fb-${id}-${i}" style="display:none;"></div>
        </div>`;
    }).join("");

    container.innerHTML = `
      <div class="mistake-drill">
        <div class="drill-title">Fill in the blank:</div>
        <div class="drill-exercises">${exercisesHtml}</div>
        <div class="drill-actions">
          <button class="btn btn-primary drill-check-btn">Check Answers</button>
          <button class="btn btn-ghost drill-close-btn">Close</button>
        </div>
        <div class="drill-results" id="drill-results-${id}" style="display:none;"></div>
      </div>`;

    container.querySelector(".drill-check-btn").addEventListener("click", () => {
      checkDrillAnswers(container, exercises, id);
    });
    container.querySelector(".drill-close-btn").addEventListener("click", () => {
      container.style.display = "none";
      container.innerHTML = "";
      if (practiceBtn) practiceBtn.disabled = false;
    });

    // Allow Enter key on last input to submit
    const inputs = container.querySelectorAll(".drill-input");
    inputs.forEach((inp) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") container.querySelector(".drill-check-btn").click();
      });
    });
  }

  function checkDrillAnswers(container, exercises, id) {
    const inputs = container.querySelectorAll(".drill-input");
    let correct = 0;

    inputs.forEach((inp, i) => {
      const userAnswer = inp.value.trim().toLowerCase().replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u").replace(/ß/g,"ss");
      const correctAnswer = (inp.dataset.answer || "").toLowerCase().replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u").replace(/ß/g,"ss");
      const isCorrect = userAnswer === correctAnswer;
      if (isCorrect) correct++;

      const fb = document.getElementById(`drill-fb-${id}-${i}`);
      const ex = exercises[i];
      inp.disabled = true;
      inp.classList.add(isCorrect ? "drill-input--correct" : "drill-input--wrong");

      if (fb) {
        fb.style.display = "block";
        fb.innerHTML = isCorrect
          ? `<span class="drill-correct-label">Correct!</span>`
          : `<span class="drill-wrong-label">Answer: <strong>${escHtml(ex.answer)}</strong></span><span class="drill-explanation"> — ${escHtml(ex.explanation)}</span>`;
      }
    });

    const resultsEl = document.getElementById(`drill-results-${id}`);
    if (resultsEl) {
      resultsEl.style.display = "block";
      resultsEl.innerHTML = `<div class="drill-score">${correct} / ${exercises.length} correct</div>`;
    }

    container.querySelector(".drill-check-btn").style.display = "none";
  }

  // --- Reset box (words page) ---

  window.resetWordBox = async function (german) {
    if (!await showConfirm(`Reset "${german}" back to box 1?`, "Reset", "Cancel")) return;
    try {
      const updated = await api("POST", `/api/words/${encodeURIComponent(german)}/reset-box`);
      const idx = words.findIndex((w) => w.german === german);
      if (idx !== -1) words[idx] = updated;
      renderWords();
    } catch (e) {
      await showAlert(e.message);
    }
  };

  // --- Prep Tab ---

  let prepBatch = [];       // current batch of word objects
  let prepLocked = new Set(); // german strings locked against reshuffle
  let prepCount = 15;
  let prepStrategy = "weighted";

  const prepCountVal = document.getElementById("prep-count-val");
  const prepCountDec = document.getElementById("prep-count-dec");
  const prepCountInc = document.getElementById("prep-count-inc");
  const prepSampleBtn = document.getElementById("prep-sample-btn");
  const prepEmptyEl = document.getElementById("prep-empty");
  const prepResultsEl = document.getElementById("prep-results");
  const prepListEl = document.getElementById("prep-list");
  const prepReshuffleBtn = document.getElementById("prep-reshuffle-btn");
  const prepCopyFullBtn = document.getElementById("prep-copy-full-btn");
  const prepCopyWordsBtn = document.getElementById("prep-copy-words-btn");
  const prepPrintBtn = document.getElementById("prep-print-btn");

  prepCountDec.addEventListener("click", () => {
    if (prepCount > 5) { prepCount--; prepCountVal.textContent = prepCount; }
  });
  prepCountInc.addEventListener("click", () => {
    if (prepCount < 30) { prepCount++; prepCountVal.textContent = prepCount; }
  });

  document.querySelectorAll(".prep-strat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".prep-strat-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      prepStrategy = btn.dataset.strategy;
    });
  });

  prepSampleBtn.addEventListener("click", samplePrep);
  prepReshuffleBtn.addEventListener("click", reshufflePrep);
  prepCopyFullBtn.addEventListener("click", () => copyPrep("full"));
  prepCopyWordsBtn.addEventListener("click", () => copyPrep("words"));
  prepPrintBtn.addEventListener("click", () => window.print());

  async function samplePrep() {
    prepSampleBtn.disabled = true;
    prepSampleBtn.classList.add("btn-loading");
    prepLocked.clear();
    try {
      prepBatch = await api("GET", `/api/prep/sample?count=${prepCount}&strategy=${prepStrategy}`);
      renderPrepList();
    } catch (e) {
      await showAlert(e.message);
    } finally {
      prepSampleBtn.disabled = false;
      prepSampleBtn.classList.remove("btn-loading");
    }
  }

  async function reshufflePrep() {
    prepReshuffleBtn.disabled = true;
    try {
      const exclude = prepBatch.map((w) => w.german); // exclude whole current batch to maximise variety
      const toReplace = prepBatch.filter((w) => !prepLocked.has(w.german));
      const kept = prepBatch.filter((w) => prepLocked.has(w.german));
      const needed = toReplace.length;
      if (needed === 0) return;
      const newSample = await api("GET", `/api/prep/sample?count=${needed + kept.length}&strategy=${prepStrategy}`);
      const replacements = newSample.filter((w) => !prepLocked.has(w.german) && !kept.find((k) => k.german === w.german));
      // Rebuild batch: locked words stay in place, others replaced in order
      prepBatch = prepBatch.map((w) => {
        if (prepLocked.has(w.german)) return w;
        return replacements.shift() || w;
      });
      renderPrepList();
    } catch (e) {
      await showAlert(e.message);
    } finally {
      prepReshuffleBtn.disabled = false;
    }
  }

  function renderPrepList() {
    if (!prepBatch.length) {
      prepEmptyEl.style.display = "block";
      prepResultsEl.style.display = "none";
      return;
    }
    prepEmptyEl.style.display = "none";
    prepResultsEl.style.display = "block";
    prepListEl.innerHTML = prepBatch.map((w, i) => buildPrepCard(w, i + 1)).join("");
  }

  function buildPrepCard(w, num) {
    const isLocked = prepLocked.has(w.german);
    const isStarred = w.starred;
    const articleHtml = w.article ? `<span class="prep-card-article">${escHtml(w.article)} </span>` : "";
    const pluralLine = w.plural ? `Pl. ${escHtml(w.plural)}` : "";
    const verbLine = (w.preteritum || w.partizip2)
      ? [w.preteritum, w.partizip2].filter(Boolean).map(escHtml).join(" · ")
      : "";
    const formsHtml = [pluralLine, verbLine].filter(Boolean).join(" &nbsp;·&nbsp; ");
    const g = escAttr(w.german);
    return `
    <div class="prep-card${isLocked ? " locked" : ""}" id="prepcard-${g}">
      <div class="prep-card-topbar">
        <div class="prep-card-topbar-left">
          <span class="prep-card-num">${num}.</span>
          <button class="btn-prep-lock${isLocked ? " locked" : ""}" onclick="prepToggleLock('${g}')" title="${isLocked ? "Unlock" : "Lock (keep on reshuffle)"}">${isLocked ? "🔒" : "🔓"}</button>
          <button class="${isStarred ? "btn-star starred" : "btn-star"}" onclick="prepToggleStar('${g}')" title="${isStarred ? "Unstar" : "Star"}">&#9733;</button>
        </div>
        <div class="prep-card-topbar-right">
          <button class="btn btn-ghost btn-small" onclick="prepReplaceWord('${g}')" title="Swap for another word">⟳ Replace</button>
          <button class="btn-delete" onclick="prepDeleteWord('${g}')" title="Delete from word list">&#x2715;</button>
        </div>
      </div>
      <div class="prep-card-word">${articleHtml}${escHtml(w.german)}</div>
      ${formsHtml ? `<div class="prep-card-forms">${formsHtml}</div>` : ""}
      ${w.german_definition ? `<div class="prep-card-definition">${escHtml(w.german_definition)}</div>` : ""}
      ${w.english_translation ? `<div class="prep-card-translation">${escHtml(w.english_translation)}</div>` : ""}
      <div class="prep-card-footer">
        <button class="btn btn-ghost btn-small" onclick="prepResetBox('${g}')" title="Reset to box 1">↺ Reset box</button>
      </div>
    </div>`;
  }

  window.prepToggleLock = function (german) {
    if (prepLocked.has(german)) prepLocked.delete(german);
    else prepLocked.add(german);
    const card = document.getElementById(`prepcard-${escAttr(german)}`);
    if (!card) return;
    const w = prepBatch.find((x) => x.german === german);
    if (w) card.outerHTML = buildPrepCard(w, prepBatch.indexOf(w) + 1);
  };

  window.prepToggleStar = async function (german) {
    const w = prepBatch.find((x) => x.german === german);
    if (!w) return;
    const newStarred = !w.starred;
    try {
      await api("PATCH", `/api/words/${encodeURIComponent(german)}`, { starred: newStarred });
      w.starred = newStarred;
      const inList = words.find((x) => x.german === german);
      if (inList) inList.starred = newStarred;
      const card = document.getElementById(`prepcard-${escAttr(german)}`);
      if (card) card.outerHTML = buildPrepCard(w, prepBatch.indexOf(w) + 1);
    } catch (e) {
      await showAlert("Failed to update star: " + e.message);
    }
  };

  window.prepReplaceWord = async function (german) {
    const exclude = prepBatch.map((w) => w.german);
    try {
      const replacement = await api("POST", "/api/prep/replace", { exclude, strategy: prepStrategy });
      const idx = prepBatch.findIndex((w) => w.german === german);
      if (idx !== -1) {
        prepLocked.delete(german);
        prepBatch[idx] = replacement;
        renderPrepList();
      }
    } catch (e) {
      await showAlert(e.message);
    }
  };

  window.prepDeleteWord = async function (german) {
    if (!await showConfirm(`Delete "${german}" from your word list?`, "Delete", "Cancel")) return;
    try {
      await api("DELETE", `/api/words/${encodeURIComponent(german)}`);
      words = words.filter((w) => w.german !== german);
      prepBatch = prepBatch.filter((w) => w.german !== german);
      prepLocked.delete(german);
      renderPrepList();
    } catch (e) {
      await showAlert(e.message);
    }
  };

  window.prepResetBox = async function (german) {
    if (!await showConfirm(`Reset "${german}" back to box 1?`, "Reset", "Cancel")) return;
    try {
      const updated = await api("POST", `/api/words/${encodeURIComponent(german)}/reset-box`);
      const idx = prepBatch.findIndex((w) => w.german === german);
      if (idx !== -1) { prepBatch[idx] = updated; renderPrepList(); }
      const inList = words.findIndex((w) => w.german === german);
      if (inList !== -1) words[inList] = updated;
    } catch (e) {
      await showAlert(e.message);
    }
  };

  function prepWordLine(w, mode) {
    const articlePart = w.article ? `${w.article} ` : "";
    const pluralPart = w.plural ? ` (Pl. ${w.plural})` : "";
    const verbPart = (w.preteritum || w.partizip2)
      ? ` (${[w.preteritum, w.partizip2].filter(Boolean).join(" · ")})`
      : "";
    const wordStr = `${articlePart}${w.german}${pluralPart || verbPart}`;
    if (mode === "words") return wordStr;
    const defPart = w.german_definition ? ` — ${w.german_definition}` : "";
    const transPart = w.english_translation ? ` — ${w.english_translation}` : "";
    return `${wordStr}${defPart}${transPart}`;
  }

  async function copyPrep(mode) {
    const text = prepBatch.map((w, i) => `${i + 1}. ${prepWordLine(w, mode)}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      const btn = mode === "full" ? prepCopyFullBtn : prepCopyWordsBtn;
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = orig; }, 1500);
    } catch (e) {
      await showAlert("Could not copy to clipboard.");
    }
  }

  // --- Init ---

  async function init() {
    loadWords();
    loadGrammar();

    // Check if audio is available
    try {
      const config = await api("GET", "/api/config");
      audioEnabled = config.audio_enabled;
    } catch (e) {
      audioEnabled = false;
    }

    // Show/hide audio opt-in based on server config
    if (audioEnabled) {
      audioOptIn.style.display = "block";
      audioCheckbox.checked = true; // default on
    }
  }

  init();
})();
