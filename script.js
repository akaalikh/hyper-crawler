const BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQU7gjhliDaRfEa4I5GAhMkB3n6xW5cWcgx_CaidVG81xv1pW1ddSuR5i8reg64g2wVJrLrIx1f3RbP/pub?output=csv";

const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzVjC5qVW8DSxqBBFUUSou15JptS9zp9M0FHSory_WEZxqkiQrG7bXI8YwrhMuiRe2a/exec";
const SOFTWARE_CSV_URL = `${BASE_URL}&gid=0`;
const COURSES_CSV_URL = `${BASE_URL}&gid=291500461`;
const SYNC_INTERVAL_MS = 300000;

let combinedData = [];
let currentTypeFilter = "All";

// DOM Elements
const searchInput = document.getElementById("searchInput");
const filterRadios = document.querySelectorAll('input[name="typeFilter"]');
const resultsContainer = document.getElementById("results");
const summaryContainer = document.getElementById("summary");
const syncStatus = document.getElementById("syncStatus");
const softwaresCountEl = document.getElementById("softwaresCount");
const coursesCountEl = document.getElementById("coursesCount");
const totalFilesEl = document.getElementById("totalFiles");
const totalSizeEl = document.getElementById("totalSize");
const requestModal = document.getElementById("requestModal");
const closeModal = document.getElementById("closeModal");
const requestForm = document.getElementById("requestForm");
const requestInput = document.getElementById("requestInput");
const requestNotes = document.getElementById("requestNotes");
const requestStatus = document.getElementById("requestStatus");
const requestEmail = document.getElementById("requestEmail");
const generalRequestBtn = document.getElementById("generalRequestBtn");
const clearSearchBtn = document.getElementById("clearSearchBtn");

// --- Data Fetching & Sync ---

function fetchSheet(url, type) {
  return new Promise((resolve, reject) => {
    const bypassCacheUrl = `${url}&t=${new Date().getTime()}`;
    Papa.parse(bypassCacheUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const dataWithType = results.data.map((row) => ({
          ...row,
          _sourceType: type,
        }));
        resolve(dataWithType);
      },
      error: (error) => reject(error),
    });
  });
}

async function loadData() {
  syncStatus.textContent = "Syncing...";
  try {
    const [softwares, courses] = await Promise.all([
      fetchSheet(SOFTWARE_CSV_URL, "Software"),
      fetchSheet(COURSES_CSV_URL, "Course"),
    ]);

    combinedData = [...softwares, ...courses];
    updateSummary();

    if (searchInput.value.trim() !== "" || currentTypeFilter !== "All") {
      applyFilters();
    }

    const now = new Date();
    syncStatus.textContent = `Last synced: ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  } catch (error) {
    syncStatus.textContent = "Sync failed. Check gids.";
    console.error("Fetch Error:", error);
  }
}

// --- Logic Helpers ---

function parseSizeToBytes(sizeStr) {
  if (!sizeStr) return 0;
  const match = sizeStr.toString().match(/([\d\.]+)\s*([a-zA-Z]*)/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const mult = {
    B: 1,
    KB: 1024,
    MB: 1048576,
    GB: 1073741824,
    TB: 1099511627776,
  };
  return val * (mult[unit] || 1);
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// --- UI Updates ---

function updateSummary() {
  const softwareCount = combinedData.filter(
    (row) => row._sourceType === "Software",
  ).length;
  const courseCount = combinedData.filter(
    (row) => row._sourceType === "Course",
  ).length;

  softwaresCountEl.textContent = softwareCount;
  coursesCountEl.textContent = courseCount;
  totalFilesEl.textContent = combinedData.length;

  let totalBytes = 0;
  combinedData.forEach((row) => {
    totalBytes += parseSizeToBytes(row["Size"] || "0");
  });
  totalSizeEl.textContent = formatBytes(totalBytes);
}

function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();

  if (!query && currentTypeFilter === "All") {
    summaryContainer.classList.remove("hidden");
    resultsContainer.classList.add("hidden");
    return;
  }

  summaryContainer.classList.add("hidden");
  resultsContainer.classList.remove("hidden");

  const filteredData = combinedData.filter((row) => {
    const fileName = (row["File Name"] || "").toLowerCase();
    const category = (row["Category"] || "").toLowerCase();
    const matchesQuery = fileName.includes(query) || category.includes(query);
    const matchesType =
      currentTypeFilter === "All" || row._sourceType === currentTypeFilter;

    return matchesQuery && matchesType;
  });

  renderResults(filteredData);
}

function renderResults(data) {
  resultsContainer.innerHTML = "";

  if (data.length === 0) {
    resultsContainer.innerHTML = `
      <li class="result-item" style="text-align: center; padding: 3rem 1rem; border: none;">
        <p style="margin-bottom: 1.5rem; color: var(--text-muted);">No matches found for "<strong>${searchInput.value}</strong>".</p>
        <button id="openRequestBtn" class="request-btn">Make a Request</button>
      </li>
    `;

    document.getElementById("openRequestBtn").addEventListener("click", () => {
      requestModal.classList.remove("hidden");
      requestInput.value = searchInput.value;
      requestStatus.classList.add("hidden");
      requestStatus.textContent = "";
    });
    return;
  }

  data.slice(0, 100).forEach((row) => {
    const li = document.createElement("li");
    li.className = "result-item";

    li.innerHTML = `
        <div class="result-header">
            <span>${row["File Name"] || "Unknown"}</span>
            <div class="result-tags"> 
                <span class="sheet-tag">${row._sourceType}</span>
                <span class="category-tag">${row["Category"] || "Uncategorized"}</span>
            </div>
        </div>
        <div class="metadata">
            <span><strong>Size:</strong> ${row["Size"] || "Unknown"}</span>
            <span><strong>Path:</strong> ${row["Path"] || "Unknown"}</span>
        </div>
    `;
    resultsContainer.appendChild(li);
  });
}

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// --- Event Listeners ---
searchInput.addEventListener("input", debounce(applyFilters, 300));

searchInput.addEventListener("input", () => {
  if (searchInput.value.trim().length > 0) {
    clearSearchBtn.classList.remove("hidden");
  } else {
    clearSearchBtn.classList.add("hidden");
  }
});

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  clearSearchBtn.classList.add("hidden");
  applyFilters();
  searchInput.focus();
});

filterRadios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    currentTypeFilter = e.target.value;
    applyFilters();
  });
});

// --- Request Modal Logic ---

closeModal.addEventListener("click", () => {
  requestModal.classList.add("hidden");
});

requestModal.addEventListener("click", (e) => {
  if (e.target === requestModal) {
    requestModal.classList.add("hidden");
  }
});

requestForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const requestedFile = requestInput.value.trim();
  const email = requestEmail.value.trim();
  const notes = requestNotes.value.trim();

  if (!requestedFile || !email) return;

  const submitBtn = requestForm.querySelector(".submit-btn");
  submitBtn.textContent = "Sending...";
  submitBtn.disabled = true;

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        fileName: requestedFile,
        email: email,
        notes: notes,
      }),
    });

    const result = await response.json();

    if (result.status === "success") {
      requestStatus.textContent =
        "Request sent. You will get a reply within 3 days to your email.";
      requestStatus.style.color = "#2e7d32"; /* Muted green */
      requestStatus.classList.remove("hidden");
      requestForm.reset();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error("Submission failed:", error);
    requestStatus.textContent = "Failed to Send. Try Again.";
    requestStatus.style.color = "#c62828"; /* Muted red */
    requestStatus.classList.remove("hidden");
  } finally {
    submitBtn.textContent = "Send Request";
    submitBtn.disabled = false;
  }
});

generalRequestBtn.addEventListener("click", () => {
  requestStatus.classList.add("hidden");
  requestStatus.textContent = "";
  const requestInput = document.getElementById("requestInput");
  requestInput.value = "";
  const requestModal = document.getElementById("requestModal");
  requestModal.classList.remove("hidden");
  requestInput.focus();
});

// --- Init ---
loadData();
setInterval(loadData, SYNC_INTERVAL_MS);
