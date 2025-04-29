// --- scripts/dataLoader.js ---

// --- Helper Functions (moved here as they are data-related formats) ---
const formatTime = (mins) => {
    if (mins === undefined || mins === null || isNaN(mins)) return "N/A";
    if (mins < 1 && mins > 0) return `< 1 min`;
    if (mins <= 0) return `0 min`;
    if (mins < 60) return `${Math.round(mins)} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = Math.round(mins % 60);
    return `${hours}h ${remainingMins}m`;
};
const formatDateForInput = d3.timeFormat("%Y-%m-%d"); // Assuming d3 is loaded globally *before* this script
const dayOfWeekNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // Used in spotifyDashboard.js

// --- Global variables/helpers (Exposed for other scripts) ---
window.formatTime = formatTime; // Make helpers global
window.formatDateForInput = formatDateForInput;
window.dayOfWeekNames = dayOfWeekNames;

let requiredColumns = {
    track_name: false, platform: false, skipped: false, episode_name: false,
    episode_show_name: false, audiobook_title: false, audiobook_chapter_title: false,
    reason_start: false, reason_end: false, artist: false, shuffle: false,
    album: false, conn_country: false,
};
window.requiredColumns = requiredColumns; // Make config global

// --- Data Loading and Parsing ---
async function loadAndParseData(csvUrl) {
    try {
        const rawData = await d3.csv(csvUrl); // Assuming d3 is loaded globally

        // Detect available columns (Logic from spotifyDashboard.js)
        const columns = new Set(rawData.columns);
        const columnMapping = {
            track_name: 'master_metadata_track_name', artist: 'master_metadata_album_artist_name',
            album: 'master_metadata_album_album_name', platform: 'platform', skipped: 'skipped',
            shuffle: 'shuffle', episode_name: 'episode_name', episode_show_name: 'episode_show_name',
            audiobook_title: 'audiobook_title', audiobook_chapter_title: 'audiobook_chapter_title',
            reason_start: 'reason_start', reason_end: 'reason_end', conn_country: 'conn_country'
        };
        Object.keys(columnMapping).forEach(key => {
            // Use columnMapping[key] to check if the *renamed* column exists in rawData.columns
             requiredColumns[key] = columns.has(columnMapping[key]);
        });
        // Update the global requiredColumns
        window.requiredColumns = requiredColumns;


        const parsedData = rawData.map(d => ({
            ts: new Date(d.ts), // Always required
            ms_played: +d.ms_played, // Always required
            // Use the column mapping and requiredColumns flag to access potentially missing columns
            platform: requiredColumns.platform ? d[columnMapping.platform] : "N/A",
            conn_country: requiredColumns.conn_country ? d[columnMapping.conn_country] : "N/A",
            artist: requiredColumns.artist ? (d[columnMapping.artist] || "Unknown Artist") : "Unknown Artist",
            track: requiredColumns.track_name ? (d[columnMapping.track_name] || "Unknown Track") : "N/A", // Rename to 'track' for consistency
            album: requiredColumns.album ? (d[columnMapping.album] || "Unknown Album") : "N/A", // Rename to 'album'
            episode_name: requiredColumns.episode_name ? (d[columnMapping.episode_name] || "N/A") : "N/A",
            episode_show_name: requiredColumns.episode_show_name ? (d[columnMapping.episode_show_name] || "N/A") : "N/A",
            audiobook_title: requiredColumns.audiobook_title ? (d[columnMapping.audiobook_title] || "N/A") : "N/A",
            audiobook_chapter_title: requiredColumns.audiobook_chapter_title ? (d[columnMapping.audiobook_chapter_title] || "N/A") : "N/A",
            // Handle boolean/string/number variations for skipped and shuffle
            skipped: requiredColumns.skipped ? ['true', '1', true].includes(String(d[columnMapping.skipped]).toLowerCase()) : false,
            shuffle: requiredColumns.shuffle ? ['true', '1', true].includes(String(d[columnMapping.shuffle]).toLowerCase()) : false,
            reason_start: requiredColumns.reason_start ? (d[columnMapping.reason_start] || "N/A") : "N/A",
            reason_end: requiredColumns.reason_end ? (d[columnMapping.reason_end] || "N/A") : "N/A",
        })).filter(d =>
            d.ts instanceof Date && !isNaN(d.ts) && // Valid date
            typeof d.ms_played === 'number' && !isNaN(d.ms_played) && d.ms_played >= 0 // Valid non-negative ms_played
            // Keep records even if artist/track is "Unknown" or "N/A" - they still represent listening time.
        );

        console.log(`DataLoader: Loaded and parsed ${parsedData.length} valid records.`);
        return parsedData; // Return the parsed data
    } catch (error) {
        console.error("DataLoader Error loading or processing data:", error);
        // Return an empty array or null to signal failure, depending on how consumers handle it.
        // Returning an empty array is often easier for chart functions to handle gracefully.
        return [];
    }
}

// Define a global Promise that other scripts can await
// The data loading starts as soon as this script is executed
window.dataPromise = loadAndParseData("data/spotify_listening_history.csv");

// You might also want to expose helper functions if they are used by multiple components
// For simplicity here, we put them directly on the window object above.