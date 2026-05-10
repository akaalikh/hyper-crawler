const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQU7gjhliDaRfEa4I5GAhMkB3n6xW5cWcgx_CaidVG81xv1pW1ddSuR5i8reg64g2wVJrLrIx1f3RbP/pub?output=csv";
const SYNC_INTERVAL_MS = 60000; // Auto-refresh every 60 seconds

let fileData = [];

// DOM Elements
const searchInput = document.getElementById("searchInput");
const resultsContainer = document.getElementById("results");
const summaryContainer = document.getElementById("summary");
const syncStatus = document.getElementById("syncStatus");
const totalFilesEl = document.getElementById("totalFiles");
const totalSizeEl = document.getElementById("totalSize");

// --- Data Fetching & Sync ---
function loadData() {
  syncStatus.textContent = "Syncing...";
  // Add timestamp to bypass browser caching
  const bypassCacheUrl = `${SHEET_CSV_URL}&t=${new Date().getTime()}`;

  Papa.parse(bypassCacheUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      fileData = results.data;
      updateSummary();

      // If user is currently searching during a sync, update results silently
      if (searchInput.value.trim() !== "") {
        handleSearch();
      }

      const now = new Date();
      syncStatus.textContent = `Last synced: ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    },
    error: function (error) {
      syncStatus.textContent = "Sync failed. Offline?";
      console.error("Fetch Error:", error);
    },
  });
}

// --- Data Parsing Helpers ---
// Converts strings like "1.5 GB", "500 KB", "1024" to raw bytes
function parseSizeToBytes(sizeStr) {
  if (!sizeStr) return 0;
  const match = sizeStr.toString().match(/([\d\.]+)\s*([a-zA-Z]*)/);
  if (!match) return 0;

  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers = {
    B: 1,
    KB: 1024,
    MB: 1048576,
    GB: 1073741824,
    TB: 1099511627776,
  };

  return val * (multipliers[unit] || 1); // Default to bytes if no unit
}

// Converts raw bytes back to clean human-readable strings
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// --- UI Updates ---
function updateSummary() {
  totalFilesEl.textContent = fileData.length;

  let totalBytes = 0;
  fileData.forEach((row) => {
    totalBytes += parseSizeToBytes(row["Size"] || "0");
  });

  totalSizeEl.textContent = formatBytes(totalBytes);
}

function handleSearch() {
  const query = searchInput.value.toLowerCase().trim();

  // Toggle visibility based on search state
  if (!query) {
    summaryContainer.classList.remove("hidden");
    resultsContainer.classList.add("hidden");
    return;
  }

  summaryContainer.classList.add("hidden");
  resultsContainer.classList.remove("hidden");

  const filteredData = fileData.filter((row) => {
    const fileName = (row["File Name"] || "").toLowerCase();
    const category = (row["Category"] || "").toLowerCase();
    return fileName.includes(query) || category.includes(query);
  });

  renderResults(filteredData);
}

function renderResults(data) {
  resultsContainer.innerHTML = "";

  if (data.length === 0) {
    resultsContainer.innerHTML =
      '<li class="result-item">No matches found in the database.</li>';
    return;
  }

  // Render up to 100 results to prevent UI lag
  const displayData = data.slice(0, 100);

  displayData.forEach((row) => {
    const li = document.createElement("li");
    li.className = "result-item";
    li.innerHTML = `
                    <div class="result-header">
                        <span>${row["File Name"] || "Unknown File"}</span>
                        <span class="category-tag">${row["Category"] || "Uncategorized"}</span>
                    </div>
                    <div class="metadata">
                        <span>Size: ${row["Size"] || "Unknown"}</span>
                        <span>Path: ${row["Path"] || "Unknown"}</span>
                    </div>
                `;
    resultsContainer.appendChild(li);
  });
}

// Debounce to optimize typing performance
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// --- Initialization & Event Listeners ---
searchInput.addEventListener("input", debounce(handleSearch, 300));

// Initial load
loadData();

// Set up polling interval
setInterval(loadData, SYNC_INTERVAL_MS);
