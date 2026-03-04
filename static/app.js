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

  // Passage state
  let passageData = null;
  let passageRatings = {};

  // --- DOM refs ---
  const tabs = document.querySelectorAll(".nav-tab");
  const wordsView = document.getElementById("words-view");
  const grammarView = document.getElementById("grammar-view");
  const practiceView = document.getElementById("practice-view");
  const settingsView = document.getElementById("settings-view");
  const settingsSections = document.getElementById("settings-sections");

  // Word list
  const newWordInput = document.getElementById("new-word");
  const newContextInput = document.getElementById("new-context");
  const addWordBtn = document.getElementById("add-word-btn");
  const wordCountEl = document.getElementById("word-count");
  const wordListEl = document.getElementById("word-list");
  const sortSelect = document.getElementById("sort-select");

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
  const wordPopupWord = document.getElementById("word-popup-word");
  const wordPopupMeta = document.getElementById("word-popup-meta");
  const wordPopupDefinition = document.getElementById("word-popup-definition");
  const wordPopupShowTranslation = document.getElementById("word-popup-show-translation");
  const wordPopupTranslation = document.getElementById("word-popup-translation");

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
  const compTargetWord = document.getElementById("comp-target-word");
  const compDefinition = document.getElementById("comp-definition");
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
  const mcTargetWord = document.getElementById("mc-target-word");
  const mcDefinition = document.getElementById("mc-definition");
  const mcGrammarNote = document.getElementById("mc-grammar-note");
  const mcNextBtn = document.getElementById("mc-next-btn");

  // Fill mode
  const modeFill = document.getElementById("mode-fill");
  const fillSentence = document.getElementById("fill-sentence");
  const fillInput = document.getElementById("fill-input");
  const fillSubmitBtn = document.getElementById("fill-submit-btn");
  const fillFeedback = document.getElementById("fill-feedback");
  const fillFeedbackText = document.getElementById("fill-feedback-text");
  const fillTranslation = document.getElementById("fill-translation");
  const fillTargetWord = document.getElementById("fill-target-word");
  const fillDefinition = document.getElementById("fill-definition");
  const fillGrammarNote = document.getElementById("fill-grammar-note");
  const fillOverride = document.getElementById("fill-override");
  const fillOverrideBtn = document.getElementById("fill-override-btn");
  const fillNextBtn = document.getElementById("fill-next-btn");

  // Sentence writing mode
  const modeSW = document.getElementById("mode-sentence-write");
  const swWord = document.getElementById("sw-word");
  const swDefinition = document.getElementById("sw-definition");
  const swGrammarCard = document.getElementById("sw-grammar-card");
  const swGrammarRuleName = document.getElementById("sw-grammar-rule-name");
  const swGrammarExplanation = document.getElementById("sw-grammar-explanation");
  const swGrammarExamples = document.getElementById("sw-grammar-examples");
  const swInput = document.getElementById("sw-input");
  const swSubmitBtn = document.getElementById("sw-submit-btn");
  const swLoading = document.getElementById("sw-loading");
  const swFeedback = document.getElementById("sw-feedback");
  const swFeedbackText = document.getElementById("sw-feedback-text");
  const swCorrected = document.getElementById("sw-corrected");
  const swExplanation = document.getElementById("sw-explanation");
  const swNextBtn = document.getElementById("sw-next-btn");

  // Summary
  const summaryScore = document.getElementById("summary-score");
  const nextBatchBtn = document.getElementById("next-batch-btn");
  const doneBtn = document.getElementById("done-btn");

  // --- Navigation ---

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const view = tab.dataset.view;
      wordsView.classList.toggle("active", view === "words");
      grammarView.classList.toggle("active", view === "grammar");
      practiceView.classList.toggle("active", view === "practice");
      settingsView.classList.toggle("active", view === "settings");

      if (view === "words") loadWords();
      if (view === "grammar") loadGrammar();
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
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

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
      words = await api("GET", "/api/words");
      renderWords();
    } catch (e) {
      console.error("Failed to load words:", e);
    }
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

    wordCountEl.textContent = `${words.length} item${words.length !== 1 ? "s" : ""}`;

    if (sorted.length === 0) {
      wordListEl.innerHTML =
        '<div style="text-align:center;color:var(--text-light);padding:40px;">No words yet. Add your first German word or phrase above!</div>';
      return;
    }

    wordListEl.innerHTML = sorted
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

        return `
        <div class="word-item fade-in">
          <div class="word-item-main">
            <span class="word-german"><span class="word-article">${articlePrefix}</span>${escHtml(w.german)}${pluralSuffix}</span>
            <span class="word-box">${dots}</span>
            <span class="word-stats">${w.times_correct}/${w.times_seen} correct</span>
            <span class="word-actions">
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
        alert(`"${german}" doesn't appear to be a valid German word or phrase.`);
        addWordBtn.disabled = false;
        return;
      }

      let finalWord = validation.corrected || german;
      if (finalWord !== german) {
        const accept = confirm(
          `Did you mean "${finalWord}"?\n\n${validation.correction_note || "Spelling/capitalization was corrected."}`
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
      });

      words.push(newWord);
      renderWords();
      newWordInput.value = "";
      newContextInput.value = "";
      newWordInput.focus();
    } catch (e) {
      addWordBtn.classList.remove("btn-loading");
      alert(e.message);
    } finally {
      addWordBtn.disabled = false;
      isAddingWord = false;
    }
  }

  window.deleteWord = async function (german) {
    if (!confirm(`Delete "${german}"?`)) return;

    try {
      await api("DELETE", `/api/words/${encodeURIComponent(german)}`);
      words = words.filter((w) => w.german !== german);
      renderWords();
    } catch (e) {
      alert(e.message);
    }
  };

  sortSelect.addEventListener("change", renderWords);

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
    grammarCountEl.textContent = `${grammarPoints.length} rule${grammarPoints.length !== 1 ? "s" : ""}`;

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
        <div class="word-item grammar-item fade-in${dimClass}">
          <div class="word-item-main">
            <label class="grammar-toggle">
              <input type="checkbox" ${enabled ? "checked" : ""} onchange="toggleGrammar('${escAttr(gp.id)}', this.checked)">
            </label>
            <span class="grammar-rule-name">${escHtml(title)}</span>
            <span class="word-actions">
              <button class="btn-delete" onclick="deleteGrammar('${escAttr(gp.id)}')" title="Delete">&#x2715;</button>
            </span>
          </div>
          ${gp.explanation ? `<div class="grammar-explanation">${escHtml(gp.explanation)}</div>` : ""}
          ${examplesHtml ? `<ul class="grammar-examples-list">${examplesHtml}</ul>` : ""}
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
      alert(e.message);
    } finally {
      addGrammarBtn.disabled = false;
      addGrammarBtn.classList.remove("btn-loading");
    }
  }

  window.deleteGrammar = async function (id) {
    if (!confirm("Delete this grammar hint?")) return;

    try {
      await api("DELETE", `/api/grammar/${encodeURIComponent(id)}`);
      grammarPoints = grammarPoints.filter((gp) => gp.id !== id);
      renderGrammar();
    } catch (e) {
      alert(e.message);
    }
  };

  window.toggleGrammar = async function (id, enabled) {
    try {
      const updated = await api("PATCH", `/api/grammar/${encodeURIComponent(id)}`, { enabled });
      const idx = grammarPoints.findIndex((gp) => gp.id === id);
      if (idx !== -1) grammarPoints[idx] = updated;
      renderGrammar();
    } catch (e) {
      alert(e.message);
      renderGrammar(); // revert checkbox visually
    }
  };

  // --- Practice ---

  function showPracticeState(state) {
    [practiceIdle, practiceLoading, practiceError, practiceActive, practiceSummary, practicePassage].forEach(
      (el) => (el.style.display = "none")
    );
    state.style.display = "flex";
  }

  async function startPractice(fromSummary) {
    audioRequested = fromSummary ? summaryAudioCheckbox.checked : audioCheckbox.checked;
    showPracticeState(practiceLoading);

    try {
      const data = await api("POST", "/api/practice/batch");
      batch = data.batch;
      currentIndex = 0;
      correctCount = 0;

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
    modeFill.style.display = "none";
    modeSW.style.display = "none";

    if (item.mode === "comprehension") {
      showComprehension(item);
    } else if (item.mode === "multiple_choice") {
      showMultipleChoice(item);
    } else if (item.mode === "sentence_writing") {
      showSentenceWrite(item);
    } else {
      showFillInBlank(item);
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

    compTargetWord.style.display = "none";
    const compInSentence = item.word_in_sentence || item.german;
    compTargetWord.innerHTML = `<strong>Word:</strong> ${escHtml(item.german)}${compInSentence !== item.german ? ` → <em>${escHtml(compInSentence)}</em>` : ""}`;

    compDefinition.style.display = "none";
    if (item.german_definition) {
      compDefinition.innerHTML = `<strong>Deutsch:</strong> ${escHtml(item.german_definition)}`;
    }

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
    compTargetWord.style.display = "block";
    compTargetWord.classList.add("fade-in");
    if (item.german_definition) {
      compDefinition.style.display = "block";
      compDefinition.classList.add("fade-in");
    }
    if (item.grammar_note) {
      compGrammarNote.style.display = "block";
      compGrammarNote.classList.add("fade-in");
    }
    showTranslationBtn.style.display = "none";
    compButtons.style.display = "flex";
    compTranslation.classList.add("fade-in");
    compButtons.classList.add("fade-in");
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
    mcTranslation.style.display = "none";
    mcTargetWord.style.display = "none";
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
    } else {
      mcFeedback.classList.add("wrong");
      mcFeedbackText.innerHTML = `The correct answer is "<strong>${escHtml(item.german)}</strong>"${escHtml(showForm)}.`;
    }

    // Show reveal details
    mcTranslation.textContent = item.translation;
    mcTranslation.style.display = "block";

    mcTargetWord.innerHTML = `<strong>Word:</strong> ${escHtml(item.german)}${inSentence !== item.german ? ` → <em>${escHtml(inSentence)}</em>` : ""}`;
    mcTargetWord.style.display = "block";

    if (item.german_definition) {
      mcDefinition.innerHTML = `<strong>Deutsch:</strong> ${escHtml(item.german_definition)}`;
      mcDefinition.style.display = "block";
    }
    if (item.grammar_note) {
      mcGrammarNote.innerHTML = `<strong>Grammar:</strong> ${escHtml(item.grammar_note)}`;
      mcGrammarNote.style.display = "block";
    }

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

  // --- Fill-in-the-blank mode ---

  function showFillInBlank(item) {
    modeFill.style.display = "block";

    fillSentence.innerHTML = formatBlankSentence(item.blank_sentence);
    fillInput.value = "";
    fillInput.disabled = false;
    fillSubmitBtn.disabled = false;
    fillFeedback.style.display = "none";
    fillFeedback.className = "fill-feedback";
    fillTranslation.style.display = "none";
    fillTargetWord.style.display = "none";
    fillDefinition.style.display = "none";
    fillGrammarNote.style.display = "none";
    fillOverride.style.display = "none";

    setTimeout(() => fillInput.focus(), 50);
  }

  fillSubmitBtn.addEventListener("click", checkFillAnswer);
  fillInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !currentAnswered) checkFillAnswer();
  });

  function showFillRevealDetails(item) {
    // Translation
    fillTranslation.textContent = item.translation;
    fillTranslation.style.display = "block";

    // Target word (dictionary form + conjugated form if different)
    const inSentence = item.blank_answer || item.word_in_sentence || item.german;
    fillTargetWord.innerHTML = `<strong>Word:</strong> ${escHtml(item.german)}${inSentence !== item.german ? ` → <em>${escHtml(inSentence)}</em>` : ""}`;
    fillTargetWord.style.display = "block";

    if (item.german_definition) {
      fillDefinition.innerHTML = `<strong>Deutsch:</strong> ${escHtml(item.german_definition)}`;
      fillDefinition.style.display = "block";
    }
    if (item.grammar_note) {
      fillGrammarNote.innerHTML = `<strong>Grammar:</strong> ${escHtml(item.grammar_note)}`;
      fillGrammarNote.style.display = "block";
    }
  }

  function checkFillAnswer() {
    if (currentAnswered) return;
    currentAnswered = true;

    const item = batch[currentIndex];
    const userAnswer = fillInput.value.trim();
    const expected = item.blank_answer || item.german;
    const correct = normalize(userAnswer) === normalize(expected);

    fillInput.disabled = true;
    fillSubmitBtn.disabled = true;
    fillFeedback.style.display = "block";
    fillFeedback.classList.add("fade-in");

    showFillRevealDetails(item);

    if (correct) {
      fillFeedback.classList.add("correct");
      fillFeedbackText.textContent = `Correct! The answer is "${expected}".`;
      fillOverride.style.display = "none";
      correctCount++;
      recordResult(item.german, true, "fill_in_the_blank");
    } else {
      fillFeedback.classList.add("wrong");
      fillFeedbackText.innerHTML = `The correct answer is "<strong>${escHtml(expected)}</strong>". You wrote "${escHtml(userAnswer)}".`;
      fillOverride.style.display = "block";
      recordResult(item.german, false, "fill_in_the_blank");
    }
  }

  fillOverrideBtn.addEventListener("click", () => {
    const item = batch[currentIndex];
    fillFeedback.classList.remove("wrong");
    fillFeedback.classList.add("correct");
    const expected = item.blank_answer || item.german;
    fillFeedbackText.textContent = `Counted as correct! The answer is "${expected}".`;
    fillOverride.style.display = "none";
    correctCount++;

    // Re-record as correct
    recordResult(item.german, true, "fill_in_the_blank");
  });

  fillNextBtn.addEventListener("click", () => {
    if (!currentAnswered) return;
    advanceToNext();
  });

  // --- Sentence writing mode ---

  function showSentenceWrite(item) {
    modeSW.style.display = "block";

    swWord.textContent = item.german;
    swDefinition.textContent = item.german_definition || "";
    swDefinition.style.display = item.german_definition ? "block" : "none";

    // Grammar challenge card
    const gr = item.sw_grammar;
    if (gr) {
      swGrammarRuleName.textContent = gr.rule_name;
      swGrammarExplanation.textContent = gr.explanation;
      swGrammarExamples.innerHTML = (gr.examples || [])
        .map((ex) => `<li><span class="sw-ex-de">${escHtml(ex.german)}</span><span class="sw-ex-en">${escHtml(ex.english)}</span></li>`)
        .join("");
      swGrammarCard.style.display = "block";
    } else {
      swGrammarCard.style.display = "none";
    }

    swInput.value = "";
    swInput.disabled = false;
    swSubmitBtn.disabled = false;
    swLoading.style.display = "none";
    swFeedback.style.display = "none";
    swFeedback.className = "fill-feedback";
    swCorrected.style.display = "none";
    swExplanation.style.display = "none";

    setTimeout(() => swInput.focus(), 50);
  }

  swSubmitBtn.addEventListener("click", checkSentenceWrite);
  swInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !currentAnswered) {
      e.preventDefault();
      checkSentenceWrite();
    }
  });

  async function checkSentenceWrite() {
    if (currentAnswered) return;
    const item = batch[currentIndex];
    const sentence = swInput.value.trim();
    if (!sentence) return;

    currentAnswered = true;
    swInput.disabled = true;
    swSubmitBtn.disabled = true;
    swLoading.style.display = "flex";

    try {
      const judgePayload = {
        word: item.german,
        sentence: sentence,
        german_definition: item.german_definition || "",
      };
      if (item.sw_grammar) {
        judgePayload.grammar_rule = item.sw_grammar.hint;
        judgePayload.rule_name = item.sw_grammar.rule_name;
      }
      const result = await api("POST", "/api/practice/judge", judgePayload);

      swLoading.style.display = "none";
      swFeedback.style.display = "block";
      swFeedback.classList.add("fade-in");

      if (result.correct) {
        swFeedback.classList.add("correct");
        swFeedbackText.textContent = "Correct!";
      } else {
        swFeedback.classList.add("wrong");
        swFeedbackText.textContent = "Not quite right.";
      }

      if (result.corrected_sentence && !result.correct) {
        swCorrected.innerHTML = `<strong>Corrected:</strong> ${escHtml(result.corrected_sentence)}`;
        swCorrected.style.display = "block";
      }

      if (result.explanation) {
        swExplanation.innerHTML = `<strong>Feedback:</strong> ${escHtml(result.explanation)}`;
        swExplanation.style.display = "block";
      }
    } catch (e) {
      swLoading.style.display = "none";
      swFeedback.style.display = "block";
      swFeedback.classList.add("wrong");
      swFeedbackText.textContent = "Failed to check sentence: " + e.message;
    }
  }

  swNextBtn.addEventListener("click", () => {
    if (!currentAnswered) return;
    advanceToNext();
  });

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

    // Build popup content
    const articlePart = wu.article ? `${escHtml(wu.article)} ` : "";
    const pluralPart = wu.plural ? ` &nbsp;·&nbsp; Pl. ${escHtml(wu.plural)}` : "";
    wordPopupWord.innerHTML = `${articlePart}<strong>${escHtml(wu.word)}</strong>`;
    wordPopupMeta.innerHTML = pluralPart ? `<span class="word-popup-plural">${pluralPart}</span>` : "";
    wordPopupDefinition.textContent = wu.german_definition || "";
    wordPopupDefinition.style.display = wu.german_definition ? "block" : "none";
    wordPopupTranslation.textContent = wu.english_translation || "";
    wordPopupTranslation.style.display = "none";
    wordPopupShowTranslation.style.display = wu.english_translation ? "block" : "none";

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

  wordPopupShowTranslation.addEventListener("click", () => {
    wordPopupShowTranslation.style.display = "none";
    wordPopupTranslation.style.display = "block";
  });

  document.addEventListener("click", (e) => {
    if (!wordPopup.contains(e.target) && !e.target.closest(".vocab-word")) {
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

    const wordsUsed = passageData.words_used || [];
    passageWordListEl.innerHTML = wordsUsed
      .map((wu) => {
        const articlePart = wu.article ? `${escHtml(wu.article)} ` : "";
        const pluralPart = wu.plural ? ` <span class="word-plural">(Pl. ${escHtml(wu.plural)})</span>` : "";
        const defPart = wu.german_definition
          ? `<div class="passage-card-def">${escHtml(wu.german_definition)}</div>`
          : "";
        const transPart = wu.english_translation
          ? `<div class="passage-card-trans">${escHtml(wu.english_translation)}</div>`
          : "";
        return `
          <div class="passage-review-card" id="prcard-${escAttr(wu.word)}">
            <div class="passage-card-info">
              <div class="passage-card-word">${articlePart}<strong>${escHtml(wu.word)}</strong>${pluralPart}</div>
              ${defPart}${transPart}
            </div>
            <div class="passage-card-btns">
              <button class="btn btn-knew" data-word="${escAttr(wu.word)}" data-correct="true">&#10003; Knew it</button>
              <button class="btn btn-didnt" data-word="${escAttr(wu.word)}" data-correct="false">&#10007; Didn't know</button>
            </div>
          </div>`;
      })
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

  passageFinishBtn.addEventListener("click", async () => {
    // Record results for all rated words
    const wordsUsed = passageData.words_used || [];
    for (const wu of wordsUsed) {
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
