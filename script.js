const BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQU7gjhliDaRfEa4I5GAhMkB3n6xW5cWcgx_CaidVG81xv1pW1ddSuR5i8reg64g2wVJrLrIx1f3RbP/pub?output=csv";

const SOFTWARE_CSV_URL = `${BASE_URL}&gid=0`;
const COURSES_CSV_URL = `${BASE_URL}&gid=291500461`;
const SYNC_INTERVAL_MS = 300000;

let combinedData = [];
let currentTypeFilter = "All"; // New state variable

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

    // Re-apply filters after sync
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

  // Show summary if everything is default
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
    resultsContainer.innerHTML =
      '<li class="result-item">No matches found.</li>';
    return;
  }

  data.slice(0, 100).forEach((row) => {
    const li = document.createElement("li");
    li.className = "result-item";
    const typeClass =
      row._sourceType === "Software" ? "tag-soft" : "tag-course";

    li.innerHTML = `
        <div class="result-header">
            <span>${row["File Name"] || "Unknown"}</span>
            <div>
                <span class="sheet-tag ${typeClass}">${row._sourceType}</span>
                <span class="category-tag">${row["Category"] || "Uncategorized"}</span>
            </div>
        </div>
        <div class="metadata">
            <span>Size: ${row["Size"] || "Unknown"}</span>
            <span>Path: ${row["Path"] || "Unknown"}</span>
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

filterRadios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    currentTypeFilter = e.target.value;
    applyFilters();
  });
});

// --- Init ---
loadData();
setInterval(loadData, SYNC_INTERVAL_MS);
