// --- Configuration ---
const cellSize = 15;
const cellPadding = 1.5;
const leftPadding = 40;
const topPadding = 25;
const noDataColor = "#ebedf0";
// Using Blues scale now
const calendarColorScale = d3.scaleSequential(d3.interpolateBlues);

const chartMargin = { top: 20, right: 20, bottom: 60, left: 50 }; // Margin for bar charts
// pieMargin is defined but not used currently, keep or remove as needed
// const pieMargin = { top: 10, right: 10, bottom: 10, left: 10 };

// --- NEW: Configuration for Draggable Handles ---
const handleWidth = 3;
const handleColor = "#e63946"; // A distinct red color for handles
const handleGrabAreaWidth = 10; // Wider invisible area for easier grabbing
const highlightColor = "rgba(108, 117, 125, 0.2)"; // Grey with opacity for highlight

// --- DOM Elements ---
const yearSelect = document.getElementById('yearSelect');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyRangeBtn = document.getElementById('applyRangeBtn');
const calendarDiv = document.getElementById('calendar');
const legendDiv = document.getElementById('legend');
const topArtistsUl = document.getElementById('topArtists');
const tooltipDiv = d3.select("#tooltip");
// New chart divs
const topTracksDiv = document.getElementById('top-tracks-chart');
const timeOfDayDiv = document.getElementById('time-of-day-chart');
const dayOfWeekDiv = document.getElementById('day-of-week-chart');
// const genreDiv = document.getElementById('genre-chart'); // Uncomment if needed

// --- NEW: DOM Element for Filter Info ---
const filterInfoSpan = document.getElementById('current-filter-info');


// --- Helper Functions ---
const formatDay = d3.timeFormat("%Y-%m-%d");
const formatDate = d3.timeFormat("%a, %b %d, %Y"); // e.g., "Mon, Jan 01, 2024"
const formatMonth = d3.timeFormat("%b");
const formatTime = (mins) => {
    if (mins === undefined || mins === null || isNaN(mins)) return "N/A"; // Robustness
    if (mins < 1 && mins > 0) return `< 1 min`;
    if (mins <= 0) return `0 min`; // Handle 0 explicitly
    if (mins < 60) return `${Math.round(mins)} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = Math.round(mins % 60);
    return `${hours}h ${remainingMins}m`;
};
const formatDateForInput = d3.timeFormat("%Y-%m-%d"); // e.g., "2024-01-01"
const dayOfWeekNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// --- Global variables ---
let allParsedData = [];
let requiredColumns = { track_name: false}; // Flags for optional columns

// --- NEW: Global variables for Drag State ---
let currentViewData = []; // Store the data passed to drawCalendar for filtering
let selectedStartDate = null; // Currently selected start date via handles
let selectedEndDate = null;   // Currently selected end date via handles
let svgInstance = null;     // Reference to the main calendar SVG group <g>
let allDaysInCalendar = []; // Array of Date objects drawn in the current calendar
let calendarStartDay = null;// The first Date object in allDaysInCalendar
let cellWidthWithPadding = cellSize + cellPadding; // Pre-calculate cell width + padding
let currentCalendarHeight = 0; // Store the height of the cell area

// --- Data Processing (Runs once) ---
d3.csv("data/spotify_listening_history.csv").then(rawData => { // Ensure this path is correct relative to index.html
    // Check for optional columns - **ADAPT COLUMN NAMES IF YOURS ARE DIFFERENT**
    if (rawData.columns.includes('master_metadata_track_name')) {
        requiredColumns.track_name = true;
         console.log("Found 'master_metadata_track_name' column.");
    } else {
         console.warn("'master_metadata_track_name' column not found. Top Tracks chart will be disabled.");
    }
    // Example for genre column (Uncomment and adapt if you have one)
    //  if (rawData.columns.includes('your_genre_column_name')) {
    //     requiredColumns.genre = true;
    //      console.log("Found 'genre' column.");
    // } else {
    //     console.warn("'genre' column not found. Genre Breakdown chart will be disabled.");
    // }

    allParsedData = rawData.map(d => ({
        // Ensure robust date parsing, handle potential errors if needed
        ts: new Date(d.ts),
        // Ensure ms_played is a non-negative number
        ms_played: +d.ms_played,
        artist: d.master_metadata_album_artist_name || "Unknown Artist",
        // Safely access optional columns
        track: requiredColumns.track_name ? (d.master_metadata_track_name || "Unknown Track") : "N/A",
        // genre: requiredColumns.genre ? (d.your_genre_column_name || "Unknown Genre") : "N/A", // Adapt column name
    })).filter(d =>
        d.ts instanceof Date && !isNaN(d.ts) && // Check if 'ts' is a valid Date
        typeof d.ms_played === 'number' && !isNaN(d.ms_played) && d.ms_played >= 0 // Check 'ms_played'
    );

    console.log(`Loaded and parsed ${allParsedData.length} valid records.`);
    if (allParsedData.length === 0) {
        calendarDiv.innerHTML = `<p class="error-message">No valid data found in the CSV.</p>`;
        // Also inform user via the filter status
        if (filterInfoSpan) filterInfoSpan.textContent = 'No data loaded';
        return;
    }

    const years = [...new Set(allParsedData.map(d => d.ts.getFullYear()))].sort((a, b) => a - b);
    years.forEach(y => {
        const opt = document.createElement('option'); opt.value = y; opt.textContent = y; yearSelect.appendChild(opt);
    });

    // --- Initial Load ---
    // Default to the most recent year with data, or current year if no data
    const defaultYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
    yearSelect.value = defaultYear;
    yearSelect.dispatchEvent(new Event('change')); // Trigger initial load

}).catch(error => {
     console.error("Error loading or processing data:", error);
    calendarDiv.innerHTML = `<p class="error-message">Error loading data. Check console.</p>`;
     if (filterInfoSpan) filterInfoSpan.textContent = 'Error loading data';
});

// --- Tooltip Logic ---
const showTooltip = (event, content) => {
     tooltipDiv.style("opacity", 1).html(content)
               .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
 };
const moveTooltip = (event) => {
     tooltipDiv.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
};
const hideTooltip = () => { tooltipDiv.style("opacity", 0); };

// --- NEW Helper Functions for Dragging ---

// Calculates the X coordinate for the start of the column (week) containing the date.
function getXFromDate(date, firstDayOfGrid, columnWidth) {
    if (!date || !firstDayOfGrid || isNaN(date) || isNaN(firstDayOfGrid) || !columnWidth || columnWidth <= 0) {
        console.warn("getXFromDate received invalid inputs:", { date, firstDayOfGrid, columnWidth });
        return NaN;
    }
    const startOfWeekGrid = d3.timeWeek.floor(firstDayOfGrid);
    const startOfWeekDate = d3.timeWeek.floor(date);
    // Ensure the date is not before the grid start for calculation
    if (startOfWeekDate < startOfWeekGrid) {
        // This can happen if the target date is clamped to the very first day,
        // but that day is mid-week relative to the grid's start week.
        // The week index should be 0 in this case.
         // console.log("getXFromDate: Date week is before grid start week, returning 0 index.")
         return 0; // Week index is 0
    }

    const weekIndex = d3.timeWeek.count(startOfWeekGrid, startOfWeekDate);
    return weekIndex * columnWidth;
}

// Finds the first Date object within the grid that falls into the week column corresponding to xPos.
function getDateFromX(xPos, daysArray, firstDayOfGrid, columnWidth) {
    if (!daysArray || daysArray.length === 0 || !firstDayOfGrid || !columnWidth || columnWidth <= 0 || xPos < -columnWidth / 2) { // Added checks
        console.warn("getDateFromX: Invalid inputs", {xPos, daysArrayLen: daysArray?.length, firstDayOfGrid, columnWidth})
        return null;
    }

    // Calculate the target week index based on the X position
    // Add half width to find the center, then divide by width to get index
    // Clamp the index to be within the possible range of weeks represented by daysArray
    const maxWeekIndex = d3.timeWeek.count(d3.timeWeek.floor(firstDayOfGrid), d3.timeWeek.floor(daysArray[daysArray.length - 1]));
    const calculatedIndex = Math.floor((xPos + columnWidth / 2) / columnWidth);
    const weekIndex = Math.max(0, Math.min(calculatedIndex, maxWeekIndex)); // Clamp index

    // Calculate the timestamp for the start of the target week
    const startOfWeekGrid = d3.timeWeek.floor(firstDayOfGrid);
    const targetWeekStartDate = d3.timeWeek.offset(startOfWeekGrid, weekIndex);

    // Find the first date in the array that falls on or after the target week start AND is within the daysArray range
    let foundDate = null;
    const firstDayInArray = daysArray[0];
    const lastDayInArray = daysArray[daysArray.length - 1];

    for (const day of daysArray) {
        if (d3.timeWeek.floor(day).getTime() === targetWeekStartDate.getTime()) {
            foundDate = day;
            break; // Found the first day in that week
        }
    }

     // If no exact match found in that week (e.g., gap at start/end of month)
     // or if dragging resulted in index before first week / after last week
    if (!foundDate) {
        if (targetWeekStartDate <= firstDayInArray) {
             return firstDayInArray; // Snap to the very first day
        } else if (targetWeekStartDate >= d3.timeWeek.floor(lastDayInArray)) {
             // If target week is the same or after the week of the last day, return the last day
             return lastDayInArray;
        } else {
             // It might be a gap month; try to find the closest day *before* it from the array
             foundDate = daysArray.slice().reverse().find(d => d < targetWeekStartDate);
             return foundDate || lastDayInArray; // Fallback to last day if still nothing found
        }
    }

    return foundDate;
}


// Update the filter info label outside the chart
function updateFilterInfoLabel(startDate, endDate) {
    if (!filterInfoSpan) return; // Exit if element doesn't exist
    if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) {
        filterInfoSpan.textContent = `Filtering: ${formatDate(startDate)} → ${formatDate(endDate)}`;
    } else {
        // Handle cases where dates might be invalid or null (e.g., initial load showing full range)
        filterInfoSpan.textContent = 'Showing full selected range'; // Or 'Select range' or ''
    }
}

// --- Calendar Drawing ---
function drawCalendar(data, initialStartDate, initialEndDate) {
    calendarDiv.innerHTML = ""; // Clear previous
    legendDiv.innerHTML = ""; // Clear previous legend

    // Clear/reset global state related to this specific calendar instance
    svgInstance = null;
    allDaysInCalendar = [];
    calendarStartDay = null;
    currentCalendarHeight = 0; // Reset height
    currentViewData = data; // Store data for filtering by handles

    const listeningData = data.filter(d => d.ms_played > 0);

    if (listeningData.length === 0) {
        calendarDiv.innerHTML = `<p class="empty-message">No listening data for the selected period.</p>`;
        // Clear dependent charts when calendar is empty
        const chartsToClear = [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv];
        chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
        updateFilterInfoLabel(initialStartDate, initialEndDate); // Show range even if no data inside it
        if (typeof handleBrushUpdate === 'function') { handleBrushUpdate([]); } // Explicitly clear charts via handler
        return; // Exit early
    }

    // --- Calculate daily aggregates ---
    const dailyData = d3.rollups(
        listeningData,
        v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes per day
        d => formatDay(d.ts) // Group by day string YYYY-MM-DD
    );
    const valueMap = new Map(dailyData);

    // --- Determine date range and structure ---
    // Using dates from initialStartDate/initialEndDate passed in for consistency
    const dataStartDate = new Date(initialStartDate);
    const dataEndDate = new Date(initialEndDate);

     // Robust check on the determined range
     if (!dataStartDate || !dataEndDate || isNaN(dataStartDate) || isNaN(dataEndDate) || dataStartDate > dataEndDate) { // Added end > start check
          console.error("drawCalendar: Invalid date range received.", dataStartDate, dataEndDate);
          calendarDiv.innerHTML = `<p class="error-message">Invalid date range for drawing.</p>`;
          if (typeof handleBrushUpdate === 'function') { handleBrushUpdate([]); } // Clear charts
          return;
     }

    // --- Calculate the full range of days needed for the grid ---
    // Ensure grid starts on the first day of the month of the start date
    // and ends on the last day of the month of the end date
    const firstDayOfMonthStart = d3.timeMonth.floor(dataStartDate);
    const lastDayOfMonthEnd = d3.timeMonth.offset(d3.timeMonth.floor(dataEndDate), 1); // Day AFTER the end date's month starts
    allDaysInCalendar = d3.timeDays(firstDayOfMonthStart, lastDayOfMonthEnd); // Store globally

    if (allDaysInCalendar.length === 0) {
        console.error("drawCalendar: No days generated for the grid range.", firstDayOfMonthStart, lastDayOfMonthEnd);
        calendarDiv.innerHTML = `<p class="error-message">Could not generate calendar grid days.</p>`;
        if (typeof handleBrushUpdate === 'function') { handleBrushUpdate([]); }
        return;
    }
    calendarStartDay = allDaysInCalendar[0]; // Store the first day shown globally

    const endDay = allDaysInCalendar[allDaysInCalendar.length - 1];
    const months = d3.timeMonths(calendarStartDay, endDay); // Use calendarStartDay

    // --- Calculate SVG dimensions ---
    const weekCount = d3.timeWeek.count(calendarStartDay, endDay) + 1;
    const width = weekCount * cellWidthWithPadding + leftPadding + 20; // Add some buffer
    // --- Calculate and Store calendarHeight (cells area only) ---
    currentCalendarHeight = 7 * cellWidthWithPadding; // Store globally for handles/highlight
    const height = currentCalendarHeight + topPadding + 30; // Total SVG height

    // --- Color Scale Domain ---
    const maxMinutes = d3.max(valueMap.values());
    calendarColorScale.domain([0, maxMinutes || 1]); // Avoid domain of [0, 0]

    // --- Create SVG ---
    const svg = d3.select("#calendar").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${leftPadding}, ${topPadding})`);
    svgInstance = svg; // Store global reference to the <g> element

    // --- Draw Labels (Days & Months) ---
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    svg.selectAll(".day-label")
        .data(d3.range(7))
        .enter().append("text")
        .attr("class", "day-label")
        .attr("x", -15) // Position left of the grid
        .attr("y", d => d * cellWidthWithPadding + cellWidthWithPadding / 2 - cellSize / 2) // Adjusted Y based on cellWidthWithPadding
        .attr("dy", "0.35em") // Vertical alignment adjustment
        .text(d => dayLabels[d]);

    svg.selectAll(".month-label")
        .data(months)
        .enter().append("text")
        .attr("class", "month-label")
         // Position at the start of the first full week of the month
        .attr("x", d => {
             // Ensure the month start date used for positioning is within the calendar's range
             const monthStartWeek = d3.max([calendarStartDay, d3.timeWeek.floor(d)]);
             return getXFromDate(monthStartWeek, calendarStartDay, cellWidthWithPadding);
         })
        .attr("y", -10) // Position above the grid
        .text(formatMonth);

    // --- Draw Day Cells ---
    const cells = svg.selectAll(".day-cell")
        .data(allDaysInCalendar) // Use the robustly calculated allDays
        .enter().append("rect")
        .attr("class", "day-cell")
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("rx", 2).attr("ry", 2)
        // Calculate X based on week number since calendar start day
        .attr("x", d => getXFromDate(d, calendarStartDay, cellWidthWithPadding))
        // Calculate Y based on day of the week (0=Sun, 6=Sat)
        .attr("y", d => d.getDay() * cellWidthWithPadding)
        .attr("fill", noDataColor) // Default fill before transition
        .attr("stroke", "#fff") // Add a subtle border initially
        .attr("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            const key = formatDay(d);
            const valueMins = valueMap.get(key) || 0;
            showTooltip(event, `${formatDate(d)}<br><b>Listened: ${formatTime(valueMins)}</b>`); // Use updated text
            d3.select(event.currentTarget).attr("stroke", "#333").attr("stroke-width", 1.5); // Highlight border
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", (event) => {
            hideTooltip();
            d3.select(event.currentTarget).attr("stroke", "#fff").attr("stroke-width", 0.5); // Restore border
        });

    // Apply transition AFTER setting up listeners and initial attributes
    cells.transition().duration(500)
        .attr("fill", d => {
            const key = formatDay(d);
            const value = valueMap.get(key);
            // Use noDataColor if value is undefined or 0 (or adjust if 0 should have base color)
            return (value === undefined || value <= 0) ? noDataColor : calendarColorScale(value);
        });

    // --- Draw Legend ---
    drawLegend(legendDiv, calendarColorScale, maxMinutes);

    // --- Draw Draggable Handles ---
    // Set initial state from parameters (already assigned to globals earlier)
    selectedStartDate = dataStartDate; // Use the actual start date passed in
    selectedEndDate = dataEndDate;     // Use the actual end date passed in

    console.log(`drawCalendar: Initial handle dates: ${formatDate(selectedStartDate)} to ${formatDate(selectedEndDate)}`);
    // Call drawHandles, passing the calculated height of the cell area
    drawHandles(selectedStartDate, selectedEndDate); // calendarHeight is now global

    // Update the info label to reflect the initial full range being shown
    updateFilterInfoLabel(selectedStartDate, selectedEndDate);

} // ****** END OF drawCalendar FUNCTION ******


// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
// --- *** DEFINITIONS FOR NEW DRAG FUNCTIONS (OUTSIDE drawCalendar) *** ---
// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv

// --- Function to Draw/Update Handles ---
function drawHandles(startDate, endDate) { // Removed calendarHeight param, uses global
    // Check required variables and if dates are valid
    if (!svgInstance || !calendarStartDay || !startDate || !endDate || isNaN(startDate) || isNaN(endDate) || currentCalendarHeight <= 0) {
         console.warn("drawHandles: Missing required elements, valid dates, or valid calendarHeight.", { svgInstance: !!svgInstance, calendarStartDay, startDate, endDate, currentCalendarHeight });
         return; // Exit if basic requirements aren't met
     }

    const startX = getXFromDate(startDate, calendarStartDay, cellWidthWithPadding);
    // End handle aligns with the START of the column for the day AFTER the end date
    // This makes the highlight visually cover the entire end date's column.
    // However, for snapping and date calculation, we use the actual end date.
    const endHandleDateForPositioning = d3.timeDay.offset(endDate, 1); // Day AFTER end date
    // Ensure this positioning date isn't *before* the start date if range is single day
    const safeEndPosDate = endHandleDateForPositioning <= startDate ? d3.timeDay.offset(startDate, 1) : endHandleDateForPositioning;
    let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);

    // Handle case where endX might calculate as NaN if safeEndPosDate goes beyond grid days
    if (isNaN(endX)) {
        // Fallback: Position end handle at the end of the last day's column
        endX = getXFromDate(endDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
        console.log("drawHandles: Falling back endX calculation for end date", endDate)
    }
    // Clamp endX to be at least startX + minimum width (e.g., handle width or cell width)
    endX = Math.max(endX, startX + handleWidth);

    console.log(`drawHandles: Positions - Start (${formatDate(startDate)}): ${startX}, End (${formatDate(endDate)}): ${endX}, Height: ${currentCalendarHeight}`);
    // Also check if calculated X positions are valid numbers
    if (isNaN(startX) || isNaN(endX)) {
        console.error("drawHandles: Calculated NaN for handle X position!", { startX, endX });
        return; // Don't draw if coordinates are invalid
    }

    // --- Start Handle ---
    let startHandleGroup = svgInstance.select(".start-handle-group");
    if (startHandleGroup.empty()) {
        startHandleGroup = svgInstance.append("g").attr("class", "start-handle-group");
        startHandleGroup.append("line") // Visible line
            .attr("class", "drag-handle start-handle")
            .attr("y1", -cellPadding) // Extend slightly above cells
            .attr("stroke", handleColor)
            .attr("stroke-width", handleWidth)
            .attr("stroke-linecap", "round"); // Nicer ends
        startHandleGroup.append("line") // Grab area
            .attr("class", "drag-grab-area")
            .attr("y1", -cellPadding)
            .attr("stroke", "transparent")
            .attr("stroke-width", handleGrabAreaWidth)
            .style("cursor", "ew-resize");
    }
    // Update position and height ALWAYS
    startHandleGroup.attr("transform", `translate(${startX}, 0)`);
    startHandleGroup.selectAll("line").attr("y2", currentCalendarHeight + cellPadding); // Extend slightly below cells
    startHandleGroup.raise(); // Ensure on top
    // Detach previous drag behavior before attaching new one if group existed
    startHandleGroup.on('.drag', null);
    startHandleGroup.call(d3.drag() // Attach drag listeners
        .on("start", handleDragStart)
        .on("drag", (event) => handleDrag(event, "start"))
        .on("end", handleDragEnd)
    );

     // --- End Handle --- (Similar logic)
     let endHandleGroup = svgInstance.select(".end-handle-group");
     if (endHandleGroup.empty()) {
        endHandleGroup = svgInstance.append("g").attr("class", "end-handle-group");
        endHandleGroup.append("line")
            .attr("class", "drag-handle end-handle")
            .attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round");
        endHandleGroup.append("line")
            .attr("class", "drag-grab-area")
            .attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize");
     }
     endHandleGroup.attr("transform", `translate(${endX}, 0)`);
     endHandleGroup.selectAll("line").attr("y2", currentCalendarHeight + cellPadding);
     endHandleGroup.raise(); // Ensure on top
     // Detach previous drag behavior
     endHandleGroup.on('.drag', null);
     endHandleGroup.call(d3.drag() // Attach drag listeners
         .on("start", handleDragStart)
         .on("drag", (event) => handleDrag(event, "end"))
         .on("end", handleDragEnd)
     );

      // --- Highlight Rectangle ---
      updateHighlightRect(); // Update shaded area
}

// // --- Drag Event Handlers ---
// function handleDragStart(event) {
//     // console.log("--- Drag Start ---", event.sourceEvent.target); // Log target element
//     d3.select(this).raise(); // Bring group to front
//     d3.select(this).select(".drag-handle")
//         .attr("stroke", "black") // Darken during drag
//         .attr("stroke-opacity", 0.7);
//     svgInstance.select(".highlight-rect").raise(); // Ensure highlight is behind handles
//     svgInstance.selectAll(".start-handle-group, .end-handle-group").raise(); // Keep handles on top
// }
// --- Drag Event Handlers ---
function handleDragStart(event) {
    console.log("--- Drag Start ---"); // Keep this simple
    d3.select(this).raise();
    d3.select(this).select(".drag-handle")
        .attr("stroke", "black")
        .attr("stroke-opacity", 0.1);
    svgInstance.select(".highlight-rect").raise();
    svgInstance.selectAll(".start-handle-group, .end-handle-group").raise();
}

function handleDrag(event, handleType) {
    // console.log(`Dragging ${handleType}, event.x: ${event.x.toFixed(2)}`); // Optional: keep for debugging

    if (!svgInstance || !calendarStartDay || allDaysInCalendar.length === 0 || !selectedStartDate || !selectedEndDate || currentCalendarHeight <= 0) {
        // console.warn("handleDrag: Missing state variables.");
        return;
    }

    const currentX = event.x;
    let targetDate = getDateFromX(currentX, allDaysInCalendar, calendarStartDay, cellWidthWithPadding);

    if (!targetDate || isNaN(targetDate)) {
         // console.warn("handleDrag: getDateFromX returned invalid date.", targetDate);
         return;
     }

    const minDate = allDaysInCalendar[0];
    const maxDate = allDaysInCalendar[allDaysInCalendar.length - 1];
    if (targetDate < minDate) targetDate = minDate;
    if (targetDate > maxDate) targetDate = maxDate;

    let snappedX;
    let newStartDate = selectedStartDate;
    let newEndDate = selectedEndDate;
    // ***** MODIFICATION START *****
    let groupToMove; // Variable to hold the selection of the group
    // ***** MODIFICATION END *****

    if (handleType === "start") {
        targetDate = d3.min([targetDate, selectedEndDate]);
        newStartDate = targetDate;
        snappedX = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding);
        // ***** MODIFICATION START *****
        groupToMove = svgInstance.select(".start-handle-group"); // Select explicitly
        // console.log(`  DRAG START: New Date: ${formatDate(newStartDate)}, Snapped X: ${snappedX}`);
        // ***** MODIFICATION END *****

        if (!isNaN(snappedX)) {
             // d3.select(this).attr("transform", `translate(${snappedX}, 0)`); // OLD WAY
             groupToMove.attr("transform", `translate(${snappedX}, 0)`);   // *** NEW WAY ***
        } else { console.error("handleDrag (Start): Invalid snappedX calculated."); }

    } else { // handleType === "end"
        targetDate = d3.max([targetDate, selectedStartDate]);
        newEndDate = targetDate;

        const endHandleDateForPositioning = d3.timeDay.offset(newEndDate, 1);
        const safeEndPosDate = endHandleDateForPositioning <= newStartDate ? d3.timeDay.offset(newStartDate, 1) : endHandleDateForPositioning;
        snappedX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);

         if (isNaN(snappedX)) {
            snappedX = getXFromDate(newEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
         }
         const startXForCompare = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding);
         if (!isNaN(startXForCompare) && !isNaN(snappedX)) {
            snappedX = Math.max(snappedX, startXForCompare + handleWidth);
         } else {
             console.error("handleDrag (End): NaN detected before final position clamp.", {snappedX, startXForCompare});
             if(isNaN(snappedX)) return;
         }
        // ***** MODIFICATION START *****
        groupToMove = svgInstance.select(".end-handle-group"); // Select explicitly
        // console.log(`  DRAG END: New Date: ${formatDate(newEndDate)}, Snapped X: ${snappedX}`);
        // ***** MODIFICATION END *****

         if (!isNaN(snappedX)) {
            // d3.select(this).attr("transform", `translate(${snappedX}, 0)`); // OLD WAY
            groupToMove.attr("transform", `translate(${snappedX}, 0)`);   // *** NEW WAY ***
         } else { console.error("handleDrag (End): Invalid snappedX calculated after checks."); }
    }

    // Update global state *after* calculations and transforms
    selectedStartDate = newStartDate;
    selectedEndDate = newEndDate;

    updateHighlightRect(); // This should still work
    updateFilterInfoLabel(selectedStartDate, selectedEndDate);
}


function handleDragEnd(event) {
    // --- V V V FINAL STATE LOG V V V ---
    console.log(`--- Drag End --- Final Range: ${formatDate(selectedStartDate)} to ${formatDate(selectedEndDate)}`);
    d3.select(this).select(".drag-handle")
        .attr("stroke", handleColor)
        .attr("stroke-opacity", 1.0);

    if (startDateInput && selectedStartDate) {
        startDateInput.value = formatDateForInput(selectedStartDate);
    }
     if (endDateInput && selectedEndDate) {
        endDateInput.value = formatDateForInput(selectedEndDate);
    }
    filterDataAndUpdateCharts(selectedStartDate, selectedEndDate);
}

// --- Function to update the highlight rectangle ---
function updateHighlightRect() {
    // Ensure necessary elements/dates are available
    if (!svgInstance || !selectedStartDate || !selectedEndDate || !calendarStartDay || isNaN(selectedStartDate) || isNaN(selectedEndDate) || currentCalendarHeight <= 0) {
        // Clear rect if dates are invalid or elements missing
         if(svgInstance) svgInstance.select(".highlight-rect").remove();
         console.warn("updateHighlightRect: Cannot draw, missing elements/valid dates/height.", { svgInstance: !!svgInstance, selectedStartDate, selectedEndDate, calendarStartDay, currentCalendarHeight });
         return;
    }
    let highlightRect = svgInstance.select(".highlight-rect");
    if (highlightRect.empty()) {
         // Insert rect behind other elements (like handles)
         highlightRect = svgInstance.insert("rect", ":first-child") // Ensure it's behind cells/handles
            .attr("class", "highlight-rect")
            .attr("fill", highlightColor) // Use defined highlight color
            .attr("pointer-events", "none"); // Ignore mouse events
    }
    // Calculate X positions based on current selected dates
    const startX = getXFromDate(selectedStartDate, calendarStartDay, cellWidthWithPadding);

     // Use the same positioning logic as the end handle for visual consistency
     const endHandleDateForPositioning = d3.timeDay.offset(selectedEndDate, 1);
     const safeEndPosDate = endHandleDateForPositioning <= selectedStartDate ? d3.timeDay.offset(selectedStartDate, 1) : endHandleDateForPositioning;
     let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);

     // Fallback/Clamping
     if (isNaN(endX)) {
        endX = getXFromDate(selectedEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
     }
     endX = Math.max(endX, startX); // Ensure endX is not before startX


     // Check if coordinates are valid before setting attributes
     if (isNaN(startX) || isNaN(endX) || isNaN(currentCalendarHeight)) {
         console.warn("updateHighlightRect: Invalid coordinates/height calculated.", { startX, endX, currentCalendarHeight });
         highlightRect.remove(); // Remove if invalid
         return;
     }

    // Update the rectangle's position and size
    highlightRect
        .attr("x", startX)
        .attr("y", 0) // Align with top of cell area
        .attr("width", Math.max(0, endX - startX)) // Ensure width is not negative
        .attr("height", currentCalendarHeight); // Use the stored height of the cell area
}


// --- Function to filter data based on dates and update dependent charts ---
function filterDataAndUpdateCharts(startDate, endDate) {
    // Validate inputs
    if (!startDate || !endDate || !currentViewData || isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
        console.warn("filterDataAndUpdateCharts: Invalid dates or no view data provided.", { startDate, endDate, currentViewData: currentViewData?.length });
        handleBrushUpdate([]); // Clear dependent charts
        updateFilterInfoLabel(startDate, endDate); // Update label (might show invalid range or default)
        return;
    }

     // --- Date Filtering Logic ---
     // Set time to start of day for startDate
     const filterStart = d3.timeDay.floor(new Date(startDate));
     // Set time to end of day (or start of next day) for endDate for inclusive filtering
     const filterEnd = d3.timeDay.offset(d3.timeDay.floor(new Date(endDate)), 1); // Start of day *after* endDate

    // Filter the data *originally loaded for the current calendar view*
    const filtered = currentViewData.filter(d => {
        const dDate = d.ts;
        // Ensure dDate is valid before comparison
        return dDate instanceof Date && !isNaN(dDate) && dDate >= filterStart && dDate < filterEnd; // Use >= start and < dayAfterEnd
    });

     console.log(`Filtering data between ${formatDate(startDate)} and ${formatDate(endDate)} (inclusive). Found ${filtered.length} records.`);
     updateFilterInfoLabel(startDate, endDate); // Update the permanent label text
     handleBrushUpdate(filtered); // Call the function that updates all bar charts etc.
}
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// --- *** END OF NEW DRAG FUNCTION DEFINITIONS *** ---
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^


// --- Legend Drawing ---
// (No changes needed here)
function drawLegend(container, scale, maxValue) {
    container.innerHTML = ""; // Clear previous legend
    if (maxValue === undefined || maxValue <= 0) return; // Don't draw if no max value

    const legendWidth = 200;
    const legendHeight = 20;
    const legendMargin = { top: 0, right: 10, bottom: 15, left: 10 };
    const barHeight = 8;

    const legendSvg = d3.select(container)
        .append("svg")
        .attr("width", legendWidth)
        .attr("height", legendHeight + legendMargin.top + legendMargin.bottom);

    const legendDefs = legendSvg.append("defs");

    const linearGradient = legendDefs.append("linearGradient")
        .attr("id", "calendar-gradient");

    const numStops = 10;
    // Check if the scale has an interpolator function (sequential scales do)
    const interpolator = typeof scale.interpolator === 'function' ? scale.interpolator() : (t => scale(maxValue * t)); // Fallback if no interpolator

    linearGradient.selectAll("stop")
        .data(d3.range(numStops + 1))
        .enter().append("stop")
        .attr("offset", d => `${(d / numStops) * 100}%`)
        .attr("stop-color", d => interpolator(d / numStops)); // Use the obtained interpolator

    legendSvg.append("rect")
        .attr("x", legendMargin.left)
        .attr("y", legendMargin.top)
        .attr("width", legendWidth - legendMargin.left - legendMargin.right)
        .attr("height", barHeight)
        .style("fill", "url(#calendar-gradient)")
        .attr("rx", 2).attr("ry", 2);

    legendSvg.append("text")
        .attr("class", "legend-label")
        .attr("x", legendMargin.left)
        .attr("y", legendMargin.top + barHeight + 10)
        .attr("text-anchor", "start")
        .text("Less");

    legendSvg.append("text")
        .attr("class", "legend-label")
        .attr("x", legendWidth - legendMargin.right)
        .attr("y", legendMargin.top + barHeight + 10)
        .attr("text-anchor", "end")
        .text("More");
}


// --- Top Artists Update ---
// (No changes needed here)
function updateTopArtists(data) {
    const targetUl = document.getElementById('topArtists');
    if (!targetUl) {
        console.error("Target UL #topArtists not found!");
        return;
    }
    targetUl.innerHTML = ""; // Clear previous list

    if (!data || data.length === 0) {
        targetUl.innerHTML = `<li class="empty-message">No listening data for this selection.</li>`;
        return;
    }

     const artistData = d3.rollups(
         data.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0),
         v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes
         d => d.artist // Group by the 'artist' property
     )
     .sort((a, b) => d3.descending(a[1], b[1])) // Sort descending by minutes
     .slice(0, 5); // Take top 5

     if (artistData.length === 0) {
        targetUl.innerHTML = `<li class="empty-message">No valid artist data found for this selection.</li>`;
        return;
     }

    artistData.forEach(([artist, totalMinutes], index) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <span class="artist-name">${index + 1}. ${artist}</span>
            <span class="artist-time">(${formatTime(totalMinutes)})</span>
        `;
        targetUl.appendChild(li);
    });
}

// --- Top Tracks Chart ---
// (No changes needed here, but added robustness to formatTime usage)
function updateTopTracksChart(data) {
    topTracksDiv.innerHTML = ""; // Clear previous
    if (!requiredColumns.track_name) {
        topTracksDiv.innerHTML = `<p class="info-message">'Track Name' column not found in data.</p>`;
        return;
    }
    if (!data || data.length === 0) {
         topTracksDiv.innerHTML = `<p class="empty-message">No data for this selection.</p>`;
         return;
    }

    const trackData = d3.rollups(
        data.filter(d => d.track && d.track !== "Unknown Track" && d.track !== "N/A" && d.ms_played > 0),
        v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes
        d => `${d.track} • ${d.artist}` // Combine track and artist for uniqueness
    )
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 15); // Top 15 tracks

    if (trackData.length === 0) {
        topTracksDiv.innerHTML = `<p class="empty-message">No track data found.</p>`;
        return;
    }

    const chartHeight = trackData.length * 25 + chartMargin.top + chartMargin.bottom; // Dynamic height
    // Ensure chartWidth is calculated correctly (use clientWidth if available)
    const containerWidth = topTracksDiv.parentElement ? topTracksDiv.parentElement.clientWidth : 400;
    const chartWidth = containerWidth > 0 ? containerWidth : 400; // Fallback width, ensure > 0
    const width = chartWidth - chartMargin.left - chartMargin.right;
    const height = chartHeight - chartMargin.top - chartMargin.bottom;

    // Check calculated dimensions
    if (width <= 0 || height <= 0) {
         console.warn("TopTracksChart: Invalid dimensions", { chartWidth, width, chartHeight, height });
         topTracksDiv.innerHTML = `<p class="error-message">Chart container too small.</p>`;
         return;
     }

    const svg = d3.select(topTracksDiv).append("svg")
        .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`) // Make responsive
        .attr("preserveAspectRatio", "xMinYMid meet")
        .append("g")
        .attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);

    const y = d3.scaleBand()
        .range([0, height])
        .domain(trackData.map(d => d[0]))
        .padding(0.2);

    const x = d3.scaleLinear()
        .domain([0, d3.max(trackData, d => d[1]) || 1]) // Ensure max isn't 0
        .range([0, width]);

    // Draw X axis
    svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => formatTime(d))) // Use robust formatTime
        .append("text")
         .attr("class", "axis-label")
         .attr("x", width / 2)
         .attr("y", chartMargin.bottom - 15) // Adjust position
         .attr("fill", "currentColor") // Use CSS color
         .attr("text-anchor", "middle")
         .text("Total Listening Time");

    // Draw Y axis (Labels only)
    const yAxis = svg.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y).tickSize(0).tickPadding(5)) // Add padding

    yAxis.select(".domain").remove(); // Remove y-axis line

    // Style Y axis text (handle potential overflow without truncation for now)
    yAxis.selectAll("text")
         .attr("x", -5); // Adjust position slightly

    // Draw Bars
    svg.selectAll(".bar")
        .data(trackData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("y", d => y(d[0]))
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", 0) // Start width at 0 for transition
        .attr("fill", "#1DB954") // Spotify green
         .on("mouseover", (event, d) => showTooltip(event, `<b>${d[0]}</b><br>${formatTime(d[1])}`)) // Use robust formatTime
         .on("mousemove", moveTooltip)
         .on("mouseout", hideTooltip)
         .transition().duration(500) // Add transition
         .attr("width", d => Math.max(0, x(d[1]))); // Ensure width is non-negative
}

// --- Time of Day Chart ---
// (No changes needed here, but added robustness to formatTime usage)
function updateTimeOfDayChart(data) {
    timeOfDayDiv.innerHTML = ""; // Clear previous
    if (!data || data.length === 0) {
         timeOfDayDiv.innerHTML = `<p class="empty-message">No data for this selection.</p>`;
         return;
    }

    const hourData = d3.rollups(
        data.filter(d => d.ms_played > 0),
        v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes
        d => d.ts.getHours() // Group by hour (0-23)
    );
    const hourMap = new Map(hourData);
    // Ensure all hours 0-23 are present, even if value is 0
    const completeHourData = d3.range(24).map(h => [h, hourMap.get(h) || 0]);

     // Calculate dimensions based on parent container
    const containerWidth = timeOfDayDiv.parentElement ? timeOfDayDiv.parentElement.clientWidth : 400;
    const chartWidth = containerWidth > 0 ? containerWidth : 400; // Ensure > 0
    const chartHeight = 250; // Fixed height might be okay here
    const width = chartWidth - chartMargin.left - chartMargin.right;
    const height = chartHeight - chartMargin.top - chartMargin.bottom;

     if (width <= 0 || height <= 0) {
          console.warn("TimeOfDayChart: Invalid dimensions", { chartWidth, width, chartHeight, height });
          timeOfDayDiv.innerHTML = `<p class="error-message">Chart container too small.</p>`;
          return;
      }

    const svg = d3.select(timeOfDayDiv).append("svg")
         .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
         .attr("preserveAspectRatio", "xMinYMid meet")
         .append("g")
         .attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);

     const x = d3.scaleBand()
         .range([0, width])
         .domain(d3.range(24))
         .padding(0.2);

     const y = d3.scaleLinear()
         .domain([0, d3.max(completeHourData, d => d[1]) || 1]) // Ensure max is at least 1
         .range([height, 0]) // Y=0 is at the top
         .nice(); // Make the axis end on a nice round value

     // Draw X axis
     svg.append("g")
         .attr("class", "axis axis--x")
         .attr("transform", `translate(0, ${height})`)
         .call(d3.axisBottom(x).tickValues(d3.range(0, 24, 3))) // Show fewer ticks (0, 3, 6...)
         .append("text")
         .attr("class", "axis-label")
         .attr("x", width / 2)
         .attr("y", chartMargin.bottom - 15) // Adjust position
         .attr("fill", "currentColor")
         .attr("text-anchor", "middle")
         .text("Hour of Day");

    // Draw Y axis
    svg.append("g")
         .attr("class", "axis axis--y")
         .call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))) // Format Y axis as time, use robust formatTime
         .append("text")
         .attr("class", "axis-label")
         .attr("transform", "rotate(-90)")
         .attr("y", 0 - chartMargin.left) // Position relative to margin
         .attr("x", 0 - (height / 2))
         .attr("dy", "1em") // Adjust vertical position slightly
         .attr("fill", "currentColor")
         .attr("text-anchor", "middle")
         .text("Total Listening Time");

    // Draw Bars
    svg.selectAll(".bar")
         .data(completeHourData)
         .enter().append("rect")
         .attr("class", "bar")
         .attr("x", d => x(d[0]))
         .attr("width", x.bandwidth())
         .attr("y", height) // Start at bottom for transition
         .attr("height", 0) // Start with 0 height
         .attr("fill", "#fd7e14") // Orange color
         .on("mouseover", (event, d) => showTooltip(event, `<b>Hour ${d[0]}</b><br>${formatTime(d[1])}`)) // Use robust formatTime
         .on("mousemove", moveTooltip)
         .on("mouseout", hideTooltip)
         .transition().duration(500) // Animate bars growing
         .attr("y", d => y(d[1]))
         .attr("height", d => Math.max(0, height - y(d[1]))); // Ensure height is non-negative
}

// --- Day of Week Chart ---
// (No changes needed here, but added robustness to formatTime usage)
function updateDayOfWeekChart(data) {
    dayOfWeekDiv.innerHTML = ""; // Clear previous
     if (!data || data.length === 0) {
         dayOfWeekDiv.innerHTML = `<p class="empty-message">No data for this selection.</p>`;
         return;
     }

     const dayData = d3.rollups(
         data.filter(d => d.ms_played > 0),
         v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes
         d => d.ts.getDay() // Group by day index (0=Sun, 6=Sat)
     );
     const dayMap = new Map(dayData);
     // Ensure all days 0-6 are present
     const completeDayData = d3.range(7).map(dayIndex => [dayIndex, dayMap.get(dayIndex) || 0]);

     // Calculate dimensions
    const containerWidth = dayOfWeekDiv.parentElement ? dayOfWeekDiv.parentElement.clientWidth : 400;
    const chartWidth = containerWidth > 0 ? containerWidth : 400; // Ensure > 0
    const chartHeight = 250;
    const width = chartWidth - chartMargin.left - chartMargin.right;
    const height = chartHeight - chartMargin.top - chartMargin.bottom;

     if (width <= 0 || height <= 0) {
          console.warn("DayOfWeekChart: Invalid dimensions", { chartWidth, width, chartHeight, height });
          dayOfWeekDiv.innerHTML = `<p class="error-message">Chart container too small.</p>`;
          return;
      }

     const svg = d3.select(dayOfWeekDiv).append("svg")
         .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
         .attr("preserveAspectRatio", "xMinYMid meet")
         .append("g")
         .attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);

     const x = d3.scaleBand()
         .range([0, width])
         .domain(d3.range(7)) // Domain is 0-6
         .padding(0.2);

     const y = d3.scaleLinear()
         .domain([0, d3.max(completeDayData, d => d[1]) || 1]) // Ensure max > 0
         .range([height, 0])
         .nice();

    // Draw X axis
    svg.append("g")
         .attr("class", "axis axis--x")
         .attr("transform", `translate(0, ${height})`)
         .call(d3.axisBottom(x).tickFormat(d => dayOfWeekNames[d])) // Use names for ticks
         .append("text")
         .attr("class", "axis-label")
         .attr("x", width / 2)
         .attr("y", chartMargin.bottom - 15) // Adjust position
         .attr("fill", "currentColor")
         .attr("text-anchor", "middle")
         .text("Day of Week");

    // Draw Y axis
    svg.append("g")
         .attr("class", "axis axis--y")
         .call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))) // Use robust formatTime
         .append("text")
         .attr("class", "axis-label")
         .attr("transform", "rotate(-90)")
         .attr("y", 0 - chartMargin.left)
         .attr("x", 0 - (height / 2))
         .attr("dy", "1em")
         .attr("fill", "currentColor")
         .attr("text-anchor", "middle")
         .text("Total Listening Time");

    // Draw Bars
    svg.selectAll(".bar")
         .data(completeDayData)
         .enter().append("rect")
         .attr("class", "bar")
         .attr("x", d => x(d[0]))
         .attr("width", x.bandwidth())
         .attr("y", height) // Start at bottom
         .attr("height", 0) // Start with 0 height
         .attr("fill", "#6f42c1") // Purple color
         .on("mouseover", (event, d) => showTooltip(event, `<b>${dayOfWeekNames[d[0]]}</b><br>${formatTime(d[1])}`)) // Use robust formatTime
         .on("mousemove", moveTooltip)
         .on("mouseout", hideTooltip)
         .transition().duration(500) // Animate
         .attr("y", d => y(d[1]))
         .attr("height", d => Math.max(0, height - y(d[1]))); // Ensure height non-negative
}

// --- Main Update Trigger ---
// This function receives filtered data (from drag end) and updates all dependent charts
function handleBrushUpdate(filteredChartData) { // Renaming might be good later, but keep for now
    // console.log("handleBrushUpdate called with data count:", filteredChartData ? filteredChartData.length : 0);
    const dataToUpdate = filteredChartData || []; // Use empty array if null/undefined
    updateTopArtists(dataToUpdate);
    updateTopTracksChart(dataToUpdate);
    updateTimeOfDayChart(dataToUpdate);
    updateDayOfWeekChart(dataToUpdate);
    // updateGenreChart(dataToUpdate); // Uncomment if using genre chart
}

// --- Main Update Function (Called on Year/Date Change) ---
function updateVisualization(filteredData) {
     console.log("updateVisualization: Updating with data count:", filteredData ? filteredData.length : 0);
     const chartsToClear = [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv]; // Add genreDiv if used

     // Reset handle selection state when the whole view changes
     selectedStartDate = null;
     selectedEndDate = null;

     if (!filteredData || filteredData.length === 0) {
        calendarDiv.innerHTML = `<p class="empty-message">No listening data for the selected period.</p>`;
        legendDiv.innerHTML = "";
        chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
        updateFilterInfoLabel(null, null); // Clear label or set default for full range
        return;
    }

    // --- Determine the actual start/end dates from the filtered data ---
    // Use d3.extent for efficiency and robustness
    const [viewStartDate, viewEndDate] = d3.extent(filteredData, d => d.ts);

    // --- Robust check for valid dates ---
    if (!viewStartDate || !viewEndDate || isNaN(viewStartDate) || isNaN(viewEndDate)) {
         console.error("updateVisualization: Could not determine valid date range from filtered data. Min:", viewStartDate, "Max:", viewEndDate);
         calendarDiv.innerHTML = `<p class="error-message">Invalid date range in data.</p>`;
         legendDiv.innerHTML = "";
         chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
         updateFilterInfoLabel(null, null); // Clear info label
         return; // Exit the function early
    }

     // Draw calendar, passing the determined start/end dates of the data
     // These dates will become the initial positions for the handles.
     drawCalendar(filteredData, viewStartDate, viewEndDate);

     // Initialize all dependent charts with the full view data
     // filterDataAndUpdateCharts will use the handles' initial positions (viewStart/viewEnd)
     filterDataAndUpdateCharts(viewStartDate, viewEndDate);
}

// --- Event Listeners ---
yearSelect.onchange = () => {
    const selectedYear = +yearSelect.value;
    if (!selectedYear || isNaN(selectedYear)) {
        console.warn("Invalid year selected");
        updateVisualization([]); // Clear visualization if year is invalid
        return;
    }
    // Define strict start and end for the year
    const yearStart = new Date(selectedYear, 0, 1); // Jan 1st, 00:00:00
    // Use start of the next year for filtering (<)
    const yearEndFilter = new Date(selectedYear + 1, 0, 1); // Jan 1st of next year

    // Filter data: >= yearStart and < yearEndFilter
    const filteredByYear = allParsedData.filter(d => d.ts >= yearStart && d.ts < yearEndFilter);

    // Update date input fields to show the full year selected
    startDateInput.value = formatDateForInput(yearStart);
    endDateInput.value = formatDateForInput(new Date(selectedYear, 11, 31)); // Dec 31st for display

    updateVisualization(filteredByYear);
 };

applyRangeBtn.onclick = () => {
    const startStr = startDateInput.value;
    const endStr = endDateInput.value;

    // Parse dates robustly, set to local time 00:00:00
    // Use Date.parse for better cross-browser compatibility with YYYY-MM-DD
    const startMs = Date.parse(startStr);
    const endMs = Date.parse(endStr);

    let start = !isNaN(startMs) ? d3.timeDay.floor(new Date(startMs)) : null;
    let end = !isNaN(endMs) ? d3.timeDay.floor(new Date(endMs)) : null;

    if (!start || !end) { // Check if parsing failed
        alert("Invalid date format. Please use YYYY-MM-DD.");
        return;
    }

    // Ensure start is not after end
     if (start > end) {
        // Option 1: Alert user
        // alert("Start date cannot be after end date.");
        // return;

        // Option 2: Swap them
         console.warn("Start date was after end date, swapping them.");
         [start, end] = [end, start]; // Swap dates
         startDateInput.value = formatDateForInput(start); // Update input to match
         endDateInput.value = formatDateForInput(end);
    }

    // For filtering, we need the day *after* the selected end date to use '<' comparison
    const filterEnd = d3.timeDay.offset(end, 1); // Start of the day AFTER the selected end date

    yearSelect.value = ""; // Clear year selection if custom range is applied
    const filteredByRange = allParsedData.filter(d => d.ts >= start && d.ts < filterEnd); // Use correct filtering range
    updateVisualization(filteredByRange);
 };

// --- Optional Genre Chart (Uncomment and implement if needed) ---
/*
function updateGenreChart(data) {
    // genreDiv.innerHTML = "";
    // if (!requiredColumns.genre) { ... }
    // if (!data || data.length === 0) { ... }
    // const genreData = d3.rollups(...)
    // ... (D3 Pie Chart Logic) ...
}
*/