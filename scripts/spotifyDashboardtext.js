// --- Configuration ---
const USE_TEXT_MODE = true; // SET TO true FOR TEXT, false FOR PLOTS
// --- End Configuration ---

const cellSize = 15;
const cellPadding = 1.5;
const leftPadding = 40;
const topPadding = 25;
const noDataColor = "#ebedf0";
const calendarColorScale = d3.scaleSequential(d3.interpolateBlues);
const chartMargin = { top: 20, right: 20, bottom: 60, left: 70 };

// --- Handle Configuration (Only relevant for plot mode) ---
const handleWidth = 3;
const handleColor = "#e63946";
const handleGrabAreaWidth = 10;
const highlightColor = "rgba(108, 117, 125, 0.2)";

// --- DOM Elements ---
const wrappedYearSelect = document.getElementById('wrappedYearSelect');
console.log("Found #wrappedYearSelect element:", wrappedYearSelect);
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyRangeBtn = document.getElementById('applyRangeBtn');
const calendarDiv = document.getElementById('calendar');
const legendDiv = document.getElementById('legend');
const topArtistsUl = document.getElementById('topArtists');
const tooltipDiv = d3.select("#tooltip"); // Keep using d3.select for the tooltip div
const topTracksDiv = document.getElementById('top-tracks-chart');
const timeOfDayDiv = document.getElementById('time-of-day-chart');
const dayOfWeekDiv = document.getElementById('day-of-week-chart');
const filterInfoSpan = document.getElementById('current-filter-info');

// --- Helper Functions ---
const formatDay = d3.timeFormat("%Y-%m-%d");
const formatDate = d3.timeFormat("%a, %b %d, %Y");
const formatMonth = d3.timeFormat("%b"); // Short month name
const formatFullMonthYear = d3.timeFormat("%B %Y"); // Full month name + year
const formatTime = (mins) => {
    if (mins === undefined || mins === null || isNaN(mins)) return "N/A";
    if (mins < 1 && mins > 0) return `< 1 min`;
    if (mins <= 0) return `0 min`;
    if (mins < 60) return `${Math.round(mins)} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = Math.round(mins % 60);
    return `${hours}h ${remainingMins}m`;
};
const formatDateForInput = d3.timeFormat("%Y-%m-%d");
const dayOfWeekNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// --- Global variables ---
let allParsedData = [];
let requiredColumns = {
    track_name: false, platform: false, skipped: false, episode_name: false,
    episode_show_name: false, audiobook_title: false, audiobook_chapter_title: false,
    reason_start: false, reason_end: false, artist: false, shuffle: false,
    album: false, conn_country: false,
};
let currentViewData = []; // Data currently displayed (filtered by year/range)
let selectedStartDate = null; // Start date of the user's selection within the calendar view
let selectedEndDate = null; // End date of the user's selection within the calendar view

// Plot-mode specific globals
let svgInstance = null;
let allDaysInCalendar = [];
let calendarStartDay = null;
let cellWidthWithPadding = cellSize + cellPadding;
let currentCalendarHeight = 0;

// --- Data Processing (Runs once) ---
(async function loadData() {
    try {
        const rawData = await d3.csv("data/astrid_data.csv");

        // Detect available columns
        const columns = new Set(rawData.columns);
        const columnMapping = {
            track_name: 'master_metadata_track_name', artist: 'master_metadata_album_artist_name',
            album: 'master_metadata_album_album_name', platform: 'platform', skipped: 'skipped',
            shuffle: 'shuffle', episode_name: 'episode_name', episode_show_name: 'episode_show_name',
            audiobook_title: 'audiobook_title', audiobook_chapter_title: 'audiobook_chapter_title',
            reason_start: 'reason_start', reason_end: 'reason_end', conn_country: 'conn_country'
        };
        Object.keys(columnMapping).forEach(key => {
            requiredColumns[key] = columns.has(columnMapping[key]);
        });

        allParsedData = rawData.map(d => ({
            ts: new Date(d.ts), ms_played: +d.ms_played, platform: d.platform,
            conn_country: d.conn_country, artist: d.master_metadata_album_artist_name || "Unknown Artist",
            track: requiredColumns.track_name ? (d.master_metadata_track_name || "Unknown Track") : "N/A",
            album: d.master_metadata_album_album_name, episode_name: d.episode_name,
            episode_show_name: d.episode_show_name, audiobook_title: d.audiobook_title,
            audiobook_chapter_title: d.audiobook_chapter_title,
            skipped: ['true', '1', true].includes(String(d.skipped).toLowerCase()),
            shuffle: ['true', '1', true].includes(String(d.shuffle).toLowerCase()),
            reason_start: d.reason_start, reason_end: d.reason_end,
        })).filter(d =>
            d.ts instanceof Date && !isNaN(d.ts) &&
            typeof d.ms_played === 'number' && !isNaN(d.ms_played) && d.ms_played >= 0
        );

        console.log(`Loaded and parsed ${allParsedData.length} valid records.`);

        const years = [...new Set(allParsedData.map(d => d.ts.getFullYear()))].sort((a, b) => a - b);
        console.log("Available years found in data:", years);

        // Handle no valid data found
        if (allParsedData.length === 0) {
            if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">No valid data found after processing the CSV.</p>`;
            if (filterInfoSpan) filterInfoSpan.textContent = 'No data loaded';
             const streamgraphChart = document.getElementById('streamgraph-chart');
             if (streamgraphChart) streamgraphChart.innerHTML = `<p class="empty-message">No data.</p>`;
             const forceGraphChart = document.getElementById('force-graph-chart');
             if (forceGraphChart) forceGraphChart.innerHTML = `<p class="empty-message">No data.</p>`;
             [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv].forEach(el => {
                 if (el) el.innerHTML = `<p class="empty-message">No data.</p>`;
             });
            return; // Stop execution
        }

        // Populate Year Select dropdown
        if (wrappedYearSelect) {
            years.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                wrappedYearSelect.appendChild(opt);
            });
        } else {
            console.error("Cannot append year options: #wrappedYearSelect not found.");
        }

        // --- Initial Load ---
        const defaultYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
        if (wrappedYearSelect) {
            wrappedYearSelect.value = defaultYear;
            // Triggering change will call updateVisualization, which respects USE_TEXT_MODE
            wrappedYearSelect.dispatchEvent(new Event('change'));
       }

        // --- Decide about Timeline ---
        // Currently, Timeline only has a visual version. It will draw if plot mode is active.
        // If you want a text summary for the timeline, create drawTimelineAsText and call it here
        // conditionally based on USE_TEXT_MODE.
        // if (!USE_TEXT_MODE) {
        //     console.log("Drawing initial Timeline plot...");
        //     drawTimeline(allParsedData, 'timeline-chart'); // Example: Assuming a timeline container exists
        // } else {
        //     console.log("Drawing initial Timeline text...");
        //     // drawTimelineAsText(allParsedData, 'timeline-chart'); // Create and call this if needed
        // }


         // Initially clear containers that depend on selection (good for both modes)
        //  const streamgraphContainer = document.getElementById('streamgraph-chart');
        //  if (streamgraphContainer) {
        //      streamgraphContainer.innerHTML = '<p class="empty-message">Select a period using the controls above.</p>';
        //      const descEl = streamgraphContainer.nextElementSibling;
        //      if (descEl && descEl.classList.contains('chart-description')) {
        //          descEl.innerHTML = 'Shows Music vs Podcast rate or summary for the selected period.';
        //      }
        //  }
        //  const forceGraphContainer = document.getElementById('force-graph-chart');
        //  if (forceGraphContainer) {
        //     forceGraphContainer.innerHTML = '<p class="empty-message">Select a period using the controls above.</p>';
        //     const descEl = forceGraphContainer.nextElementSibling;
        //     if (descEl && descEl.classList.contains('chart-description')) {
        //         descEl.innerHTML = 'Shows artist transitions or summary for the selected period.';
        //     }
        //  }

    } catch (error) {
        console.error("Error loading or processing data:", error);
        // Display error messages in relevant containers
        if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Error loading data. Check console.</p>`;
        if (filterInfoSpan) filterInfoSpan.textContent = 'Error loading data';
        const streamgraphChart = document.getElementById('streamgraph-chart');
        if (streamgraphChart) streamgraphChart.innerHTML = `<p class="error-message">Error loading data.</p>`;
        const forceGraphChart = document.getElementById('force-graph-chart');
        if (forceGraphChart) forceGraphChart.innerHTML = `<p class="error-message">Error loading data.</p>`;
        [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv].forEach(el => {
            if (el) el.innerHTML = `<p class="error-message">Error loading data.</p>`;
        });
    }
})(); // Immediately invoke the async function

// --- Tooltip Logic (Only used in plot mode) ---
const showTooltip = (event, content) => {
    if (USE_TEXT_MODE) return; // Don't show tooltips in text mode
    tooltipDiv.style("opacity", 1).html(content)
        .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
};
const moveTooltip = (event) => {
    if (USE_TEXT_MODE) return;
    tooltipDiv.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
};
const hideTooltip = () => {
    if (USE_TEXT_MODE) return;
    tooltipDiv.style("opacity", 0);
};

// --- Calendar Dragging Helper Functions (Only used in plot mode) ---
function getXFromDate(date, firstDayOfGrid, columnWidth) {
    // ... (implementation remains the same)
     if (!date || !firstDayOfGrid || isNaN(date) || isNaN(firstDayOfGrid) || !columnWidth || columnWidth <= 0) return NaN;
    const startOfWeekGrid = d3.timeWeek.floor(firstDayOfGrid);
    const startOfWeekDate = d3.timeWeek.floor(date);
    if (startOfWeekDate < startOfWeekGrid) return 0;
    const weekIndex = d3.timeWeek.count(startOfWeekGrid, startOfWeekDate);
    return weekIndex * columnWidth;
}

function getDateFromX(xPos, daysArray, firstDayOfGrid, columnWidth) {
     // ... (implementation remains the same)
     if (!daysArray || daysArray.length === 0 || !firstDayOfGrid || !columnWidth || columnWidth <= 0 || xPos < -columnWidth / 2) return null;
    const maxWeekIndex = d3.timeWeek.count(d3.timeWeek.floor(firstDayOfGrid), d3.timeWeek.floor(daysArray[daysArray.length - 1]));
    const calculatedIndex = Math.floor((xPos + columnWidth / 2) / columnWidth);
    const weekIndex = Math.max(0, Math.min(calculatedIndex, maxWeekIndex));
    const startOfWeekGrid = d3.timeWeek.floor(firstDayOfGrid);
    const targetWeekStartDate = d3.timeWeek.offset(startOfWeekGrid, weekIndex);
    let foundDate = null;
    const firstDayInArray = daysArray[0];
    const lastDayInArray = daysArray[daysArray.length - 1];
    for (const day of daysArray) {
        if (d3.timeWeek.floor(day).getTime() === targetWeekStartDate.getTime()) {
            foundDate = day; break;
        }
    }
    if (!foundDate) {
        if (targetWeekStartDate <= firstDayInArray) return firstDayInArray;
        else if (targetWeekStartDate >= d3.timeWeek.floor(lastDayInArray)) return lastDayInArray;
        else {
            foundDate = daysArray.slice().reverse().find(d => d < targetWeekStartDate);
            return foundDate || lastDayInArray;
        }
    }
    return foundDate;
}

// --- Filter Info Label Update (Used in both modes) ---
function updateFilterInfoLabel(startDate, endDate) {
     if (!filterInfoSpan) return;
    if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) {
        filterInfoSpan.textContent = `${formatDate(startDate)} → ${formatDate(endDate)}`;
    } else if (currentViewData && currentViewData.length > 0) {
        // If no specific selection, show the full range of the current view
        const [minD, maxD] = d3.extent(currentViewData, d => d.ts);
        if (minD && maxD) {
             filterInfoSpan.textContent = `${formatDate(minD)} → ${formatDate(maxD)} (Full View)`;
        } else {
             filterInfoSpan.textContent = 'Full selected range';
        }
    }
     else {
        filterInfoSpan.textContent = 'No selection or data';
    }
}

// --- Plotting Functions (Only called if USE_TEXT_MODE is false) ---

function drawCalendar(data, initialStartDate, initialEndDate) {
     calendarDiv.innerHTML = ""; legendDiv.innerHTML = "";
     svgInstance = null; allDaysInCalendar = []; calendarStartDay = null;
     currentCalendarHeight = 0; // Reset plot-specific globals

    const listeningData = data.filter(d => d.ms_played > 0);
    if (listeningData.length === 0) {
        if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No listening data for this period.</p>`;
        // No need to call handleBrushUpdate here, updateVisualization handles clearing
        updateFilterInfoLabel(initialStartDate, initialEndDate);
        return;
    }
    const dailyData = d3.rollups(listeningData, v => d3.sum(v, d => d.ms_played / 60000), d => formatDay(d.ts));
    const valueMap = new Map(dailyData);
    const dataStartDate = new Date(initialStartDate); const dataEndDate = new Date(initialEndDate);

     if (!dataStartDate || !dataEndDate || isNaN(dataStartDate) || isNaN(dataEndDate) || dataStartDate > dataEndDate) {
          console.error("drawCalendar: Invalid date range received.", dataStartDate, dataEndDate);
          if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Invalid date range.</p>`;
          return;
     }
    const firstDayOfMonthStart = d3.timeMonth.floor(dataStartDate);
    const lastDayOfMonthEnd = d3.timeMonth.offset(d3.timeMonth.floor(dataEndDate), 1);
    allDaysInCalendar = d3.timeDays(firstDayOfMonthStart, lastDayOfMonthEnd);
    if (allDaysInCalendar.length === 0) {
        console.error("drawCalendar: No days generated for grid.");
        if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Could not generate grid days.</p>`;
        return;
    }
    calendarStartDay = allDaysInCalendar[0]; // Set plot-specific global
    const endDay = allDaysInCalendar[allDaysInCalendar.length - 1];
    const months = d3.timeMonths(calendarStartDay, endDay);
    const weekCount = d3.timeWeek.count(calendarStartDay, endDay) + 1;
    cellWidthWithPadding = cellSize + cellPadding; // Ensure calculated
    const width = weekCount * cellWidthWithPadding + leftPadding + 20;
    currentCalendarHeight = 7 * cellWidthWithPadding; // Set plot-specific global
    const height = currentCalendarHeight + topPadding + 30;
    const maxMinutes = d3.max(valueMap.values());
    calendarColorScale.domain([0, maxMinutes || 1]);

    const svg = d3.select("#calendar").append("svg").attr("width", width).attr("height", height)
                  .append("g").attr("transform", `translate(${leftPadding}, ${topPadding})`);
    svgInstance = svg; // Set plot-specific global

    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    svg.selectAll(".day-label").data(d3.range(7)).enter().append("text").attr("class", "day-label").attr("x", -15)
       .attr("y", d => d * cellWidthWithPadding + cellWidthWithPadding / 2 - cellSize / 2).attr("dy", "0.35em").text(d => dayLabels[d]);

    svg.selectAll(".month-label").data(months).enter().append("text").attr("class", "month-label")
       .attr("x", d => getXFromDate(d3.max([calendarStartDay, d3.timeWeek.floor(d)]), calendarStartDay, cellWidthWithPadding))
       .attr("y", -10).text(formatMonth);

    const cells = svg.selectAll(".day-cell").data(allDaysInCalendar).enter().append("rect").attr("class", "day-cell")
       .attr("width", cellSize).attr("height", cellSize).attr("rx", 2).attr("ry", 2)
       .attr("x", d => getXFromDate(d, calendarStartDay, cellWidthWithPadding))
       .attr("y", d => d.getDay() * cellWidthWithPadding)
       .attr("fill", noDataColor).attr("stroke", "#fff").attr("stroke-width", 0.5)
       .on("mouseover", (event, d) => {
            const key = formatDay(d); const valueMins = valueMap.get(key) || 0;
            showTooltip(event, `${formatDate(d)}<br><b>Listened: ${formatTime(valueMins)}</b>`);
            d3.select(event.currentTarget).attr("stroke", "#333").attr("stroke-width", 1.5);
       })
       .on("mousemove", moveTooltip)
       .on("mouseout", (event) => {
           hideTooltip(); d3.select(event.currentTarget).attr("stroke", "#fff").attr("stroke-width", 0.5);
       });

    cells.transition().duration(500).attr("fill", d => {
        const key = formatDay(d); const value = valueMap.get(key);
        return (value === undefined || value <= 0) ? noDataColor : calendarColorScale(value);
    });

    drawLegend(legendDiv, calendarColorScale, maxMinutes);

    // Set selected dates (used by handles and filter function)
    selectedStartDate = dataStartDate;
    selectedEndDate = dataEndDate;

    drawHandles(selectedStartDate, selectedEndDate); // Draw handles for interaction
    updateFilterInfoLabel(selectedStartDate, selectedEndDate); // Update label
}

function drawHandles(startDate, endDate) {
     // This function is only relevant in plot mode
     if (!svgInstance || !calendarStartDay || !startDate || !endDate || isNaN(startDate) || isNaN(endDate) || currentCalendarHeight <= 0) return;
     // ... (rest of handle drawing logic) ...
     const startX = getXFromDate(startDate, calendarStartDay, cellWidthWithPadding);
    const endHandleDateForPositioning = d3.timeDay.offset(endDate, 1);
    const safeEndPosDate = endHandleDateForPositioning <= startDate ? d3.timeDay.offset(startDate, 1) : endHandleDateForPositioning;
    let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);
    if (isNaN(endX)) endX = getXFromDate(endDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
    endX = Math.max(endX, startX + handleWidth);
    if (isNaN(startX) || isNaN(endX)) { console.error("drawHandles: NaN X position!", { startX, endX }); return; }
    let startHandleGroup = svgInstance.select(".start-handle-group");
    if (startHandleGroup.empty()) {
        startHandleGroup = svgInstance.append("g").attr("class", "start-handle-group");
        startHandleGroup.append("line").attr("class", "drag-handle start-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round");
        startHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize");
    }
    startHandleGroup.attr("transform", `translate(${startX}, 0)`).selectAll("line").attr("y2", currentCalendarHeight + cellPadding);
    startHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "start")).on("end", handleDragEnd)); // Use correct drag end handler
     let endHandleGroup = svgInstance.select(".end-handle-group");
     if (endHandleGroup.empty()) {
        endHandleGroup = svgInstance.append("g").attr("class", "end-handle-group");
        endHandleGroup.append("line").attr("class", "drag-handle end-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round");
        endHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize");
     }
     endHandleGroup.attr("transform", `translate(${endX}, 0)`).selectAll("line").attr("y2", currentCalendarHeight + cellPadding);
     endHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "end")).on("end", handleDragEnd)); // Use correct drag end handler
     updateHighlightRect();
}

function handleDragStart(event) {
    // Only relevant in plot mode
    if (!svgInstance) return;
    d3.select(this).raise().select(".drag-handle").attr("stroke", "black").attr("stroke-opacity", 0.7);
    svgInstance.select(".highlight-rect")?.raise();
    svgInstance.selectAll(".start-handle-group, .end-handle-group").raise();
}

function handleDrag(event, handleType) {
    // Only relevant in plot mode
     if (!svgInstance || !calendarStartDay || allDaysInCalendar.length === 0 || !selectedStartDate || !selectedEndDate || currentCalendarHeight <= 0) return;
    // ... (rest of handle drag logic) ...
    const currentX = event.x;
    let targetDate = getDateFromX(currentX, allDaysInCalendar, calendarStartDay, cellWidthWithPadding);
    if (!targetDate || isNaN(targetDate)) return;
    const minDate = allDaysInCalendar[0]; const maxDate = allDaysInCalendar[allDaysInCalendar.length - 1];
    if (targetDate < minDate) targetDate = minDate; if (targetDate > maxDate) targetDate = maxDate;
    let snappedX; let newStartDate = selectedStartDate; let newEndDate = selectedEndDate; let groupToMove;
    if (handleType === "start") {
        targetDate = d3.min([targetDate, selectedEndDate]); newStartDate = targetDate;
        snappedX = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding);
        groupToMove = svgInstance.select(".start-handle-group");
        if (!isNaN(snappedX)) groupToMove.attr("transform", `translate(${snappedX}, 0)`);
        else console.error("handleDrag (Start): Invalid snappedX.");
    } else {
        targetDate = d3.max([targetDate, selectedStartDate]); newEndDate = targetDate;
        const endHandleDateForPositioning = d3.timeDay.offset(newEndDate, 1);
        const safeEndPosDate = endHandleDateForPositioning <= newStartDate ? d3.timeDay.offset(newStartDate, 1) : endHandleDateForPositioning;
        snappedX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);
         if (isNaN(snappedX)) snappedX = getXFromDate(newEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
         const startXForCompare = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding);
         if (!isNaN(startXForCompare) && !isNaN(snappedX)) snappedX = Math.max(snappedX, startXForCompare + handleWidth);
         else { if(isNaN(snappedX)) return; }
        groupToMove = svgInstance.select(".end-handle-group");
        if (!isNaN(snappedX)) groupToMove.attr("transform", `translate(${snappedX}, 0)`);
        else console.error("handleDrag (End): Invalid snappedX.");
    }
    // Update global selection state
    selectedStartDate = newStartDate;
    selectedEndDate = newEndDate;
    updateHighlightRect(); // Update visual highlight
    updateFilterInfoLabel(selectedStartDate, selectedEndDate); // Update text label
}

function handleDragEnd(event) { // Renamed back from handleDragEndText
     // Style handle back (only if in plot mode)
     if (!USE_TEXT_MODE && svgInstance) {
        d3.select(this).select(".drag-handle").attr("stroke", handleColor).attr("stroke-opacity", 1.0);
     }
     // Update date inputs (useful for both modes)
     if (startDateInput && selectedStartDate) startDateInput.value = formatDateForInput(selectedStartDate);
     if (endDateInput && selectedEndDate) endDateInput.value = formatDateForInput(selectedEndDate);

     // Filter data and update components (respects USE_TEXT_MODE internally)
     filterDataAndUpdateCharts(selectedStartDate, selectedEndDate);
}

function updateHighlightRect() {
    // Only relevant in plot mode
    if (USE_TEXT_MODE || !svgInstance || !selectedStartDate || !selectedEndDate || !calendarStartDay || isNaN(selectedStartDate) || isNaN(selectedEndDate) || currentCalendarHeight <= 0) {
         svgInstance?.select(".highlight-rect").remove(); // Remove if it exists but shouldn't
         return;
    }
    // ... (rest of highlight rect logic) ...
    let highlightRect = svgInstance.select(".highlight-rect");
    if (highlightRect.empty()) {
         highlightRect = svgInstance.insert("rect", ":first-child").attr("class", "highlight-rect").attr("fill", highlightColor).attr("pointer-events", "none");
    }
    const startX = getXFromDate(selectedStartDate, calendarStartDay, cellWidthWithPadding);
    const endHandleDateForPositioning = d3.timeDay.offset(selectedEndDate, 1);
    const safeEndPosDate = endHandleDateForPositioning <= selectedStartDate ? d3.timeDay.offset(selectedStartDate, 1) : endHandleDateForPositioning;
    let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);
    if (isNaN(endX)) endX = getXFromDate(selectedEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
    endX = Math.max(endX, startX);
    if (isNaN(startX) || isNaN(endX) || isNaN(currentCalendarHeight)) { highlightRect.remove(); return; }
    highlightRect.attr("x", startX).attr("y", 0).attr("width", Math.max(0, endX - startX)).attr("height", currentCalendarHeight);
}

function drawLegend(container, scale, maxValue) {
    // Only relevant in plot mode
    container.innerHTML = "";
    if (USE_TEXT_MODE || maxValue === undefined || maxValue <= 0) return;
    // ... (rest of legend drawing logic) ...
    const legendWidth = 200, legendHeight = 20, legendMargin = { top: 0, right: 10, bottom: 15, left: 10 }, barHeight = 8;
    const legendSvg = d3.select(container).append("svg").attr("width", legendWidth).attr("height", legendHeight + legendMargin.top + legendMargin.bottom);
    const legendDefs = legendSvg.append("defs"); const linearGradient = legendDefs.append("linearGradient").attr("id", "calendar-gradient");
    const numStops = 10; const interpolator = typeof scale.interpolator === 'function' ? scale.interpolator() : (t => scale(maxValue * t));
    linearGradient.selectAll("stop").data(d3.range(numStops + 1)).enter().append("stop").attr("offset", d => `${(d / numStops) * 100}%`).attr("stop-color", d => interpolator(d / numStops));
    legendSvg.append("rect").attr("x", legendMargin.left).attr("y", legendMargin.top).attr("width", legendWidth - legendMargin.left - legendMargin.right).attr("height", barHeight).style("fill", "url(#calendar-gradient)").attr("rx", 2).attr("ry", 2);
    legendSvg.append("text").attr("class", "legend-label").attr("x", legendMargin.left).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "start").text("Less");
    legendSvg.append("text").attr("class", "legend-label").attr("x", legendWidth - legendMargin.right).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "end").text("More");
}

// Plotting functions for other charts
function updateTopArtists(data) { /* ... plot version ... */
    const targetUl = document.getElementById('topArtists'); if (!targetUl) return; targetUl.innerHTML = "";
    if (!data || data.length === 0) { targetUl.innerHTML = `<li class="empty-message">No data.</li>`; return; }
    const artistData = d3.rollups( data.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.artist).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (artistData.length === 0) { targetUl.innerHTML = `<li class="empty-message">No artist data in this period.</li>`; return; }
    artistData.forEach(([artist, totalMinutes], index) => { const li = document.createElement("li"); li.innerHTML = `<span class="artist-name">${index + 1}. ${artist}</span> <span class="artist-time">(${formatTime(totalMinutes)})</span>`; targetUl.appendChild(li); });
}
// function updateTopTracksChart(data) { /* ... simple list plot version ... */ }
function updateTopTracksChart2(data) { /* ... sparkline list plot version ... */
    const targetDiv = document.getElementById('top-tracks-chart');
    if (!targetDiv) return;
    targetDiv.innerHTML = ""; // Clear previous content
    if (!requiredColumns.track_name) { targetDiv.innerHTML = `<p class="error-message">Track name data missing.</p>`; return; }
    if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }

    const trackData = d3.rollups(data.filter(d => d.track && d.track !== "Unknown Track" && d.track !== "N/A" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => `${d.track} • ${d.artist}`).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (trackData.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No track data in period.</p>`; return; }

    const list = d3.select(targetDiv).append("ol").attr("class", "top-tracks-sparkline-list");
    const maxMinutes = trackData[0][1];
    const sparklineWidth = 80;
    const sparklineHeight = 12;
    const sparklineScale = d3.scaleLinear().domain([0, maxMinutes || 1]).range([0, sparklineWidth]);

    const items = list.selectAll("li").data(trackData).join("li");
    items.append("span").attr("class", "track-info").html(d => {
       const parts = d[0].split('•');
       const trackName = parts[0] ? parts[0].trim() : 'Unknown Track';
       const artistName = parts[1] ? parts[1].trim() : 'Unknown Artist';
       return `<span class="track-name">${trackName}</span><br><span class="track-artist">${artistName}</span>`;
    });
    items.append("span").attr("class", "track-time").text(d => `(${formatTime(d[1])})`);

    const sparklineSvg = items.append("svg").attr("class", "sparkline").attr("width", sparklineWidth).attr("height", sparklineHeight).style("vertical-align", "middle").style("margin-left", "8px");
    sparklineSvg.append("rect").attr("x", 0).attr("y", 0).attr("width", 0).attr("height", sparklineHeight).attr("fill", "#1DB954").attr("rx", 1).attr("ry", 1)
        .on("mouseover", (event, d) => showTooltip(event, `<b>${d[0]}</b><br>${formatTime(d[1])}`))
        .on("mousemove", moveTooltip).on("mouseout", hideTooltip)
        .transition().duration(500).attr("width", d => sparklineScale(d[1]));
}
function updateTimeOfDayChart(data) { /* ... plot version ... */
     const targetDiv = document.getElementById('time-of-day-chart');
     if (!targetDiv) return;
     targetDiv.innerHTML = ""; if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
     const hourData = d3.rollups( data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getHours());
     const hourMap = new Map(hourData);
     const completeHourData = d3.range(24).map(h => [h, hourMap.get(h) || 0]);
     const containerWidth = targetDiv.parentElement?.clientWidth || 400;
     const chartWidth = containerWidth > 0 ? containerWidth : 400; const chartHeight = 250; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom;
     if (width <= 0 || height <= 0) { targetDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; }
     const svg = d3.select(targetDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);
     const x = d3.scaleBand().range([0, width]).domain(d3.range(24)).padding(0.2); const y = d3.scaleLinear().domain([0, d3.max(completeHourData, d => d[1]) || 1]).range([height, 0]).nice();
     svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickValues(d3.range(0, 24, 3))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("text-anchor", "middle").text("Hour of Day");
     svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Total Listening Time");
     svg.selectAll(".bar").data(completeHourData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#fd7e14").on("mouseover", (event, d) => showTooltip(event, `<b>Hour ${d[0]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1])));
}
function updateDayOfWeekChart(data) { /* ... plot version ... */
     const targetDiv = document.getElementById('day-of-week-chart');
     if (!targetDiv) return;
     targetDiv.innerHTML = ""; if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
     const dayData = d3.rollups( data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getDay());
     const dayMap = new Map(dayData);
     const completeDayData = d3.range(7).map(dayIndex => [dayIndex, dayMap.get(dayIndex) || 0]);
     const containerWidth = targetDiv.parentElement?.clientWidth || 400;
     const chartWidth = containerWidth > 0 ? containerWidth : 400; const chartHeight = 250; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom;
     if (width <= 0 || height <= 0) { targetDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; }
     const svg = d3.select(targetDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);
     const x = d3.scaleBand().range([0, width]).domain(d3.range(7)).padding(0.2); const y = d3.scaleLinear().domain([0, d3.max(completeDayData, d => d[1]) || 1]).range([height, 0]).nice();
     svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickFormat(d => dayOfWeekNames[d])).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("text-anchor", "middle").text("Day of Week");
     svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Total Listening Time");
     svg.selectAll(".bar").data(completeDayData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#6f42c1").on("mouseover", (event, d) => showTooltip(event, `<b>${dayOfWeekNames[d[0]]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1])));
}
async function drawStreamgraph(filteredData, containerId) { /* ... plot version ... */
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    if (!filteredData || filteredData.length === 0) {
        container.innerHTML = '<p class="empty-message">No data for streamgraph.</p>';
        const descEl = container.nextElementSibling; if (descEl && descEl.classList.contains('chart-description')) descEl.innerHTML = 'Select period above.';
        return;
    }
    const streamDataProcessed = filteredData.map(d => { let contentType = 'Music'; if (d.episode_name && String(d.episode_name).trim() !== "") contentType = 'Podcast'; return { ...d, contentType: contentType }; }).filter(d => d.ms_played > 0);
    if (streamDataProcessed.length === 0) { container.innerHTML = '<p class="empty-message">No Music/Podcast data.</p>'; return; }
    const contentTypes = ['Music', 'Podcast']; // Keep consistent
    const [minDate, maxDate] = d3.extent(streamDataProcessed, d => d.ts);
    const timeDiffDays = (maxDate && minDate) ? (maxDate - minDate) / (1000 * 60 * 60 * 24) : 0;
    const timeAggregator = timeDiffDays > 60 ? d3.timeDay.floor : d3.timeHour.floor;
    const timeFormatString = timeDiffDays > 60 ? "%Y-%m-%d" : "%H:%M %a %d";

    const aggregatedData = Array.from( d3.group(streamDataProcessed, d => timeAggregator(d.ts)), ([timeBin, values]) => { const entry = { timeBin: new Date(timeBin) }; let totalMsPlayedInBin = 0; contentTypes.forEach(type => entry[type] = 0); values.forEach(v => { if (entry.hasOwnProperty(v.contentType)) { entry[v.contentType] += v.ms_played; totalMsPlayedInBin += v.ms_played; } }); entry.totalMinutes = totalMsPlayedInBin / 60000; contentTypes.forEach(type => { entry[type] = (totalMsPlayedInBin > 0) ? (entry[type] / totalMsPlayedInBin) : 0; }); return entry; }).sort((a, b) => a.timeBin - b.timeBin);
    if (aggregatedData.length === 0) { container.innerHTML = '<p class="empty-message">No aggregated data.</p>'; return; }

    const margin = { top: 20, right: 30, bottom: 40, left: 50 }; const containerWidth = container.clientWidth || 800; const height = 300 - margin.top - margin.bottom; const width = containerWidth - margin.left - margin.right;
    if (width <= 0 || height <= 0) { container.innerHTML = `<p class="error-message">Container too small.</p>`; return; }
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    const xScale = d3.scaleTime().domain(d3.extent(aggregatedData, d => d.timeBin)).range([0, width]); const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);
    const colorMap = { 'Music': '#1DB954', 'Podcast': '#6f42c1' }; const colorScale = d3.scaleOrdinal().domain(contentTypes).range(contentTypes.map(type => colorMap[type]));
    const stack = d3.stack().keys(contentTypes).offset(d3.stackOffsetNone).order(d3.stackOrderInsideOut);
    let series; try { series = stack(aggregatedData); } catch (error) { console.error("Streamgraph stacking error:", error); container.innerHTML = '<p class="error-message">Stacking error.</p>'; return; }
    if (series.length === 0 || !series[0] || series[0].length === 0) { container.innerHTML = '<p class="empty-message">No stack layers generated.</p>'; return; }

    const areaGen = d3.area().x(d => xScale(d.data.timeBin)).y0(d => yScale(d[0])).y1(d => yScale(d[1])).curve(d3.curveBasis);
    svg.selectAll(".stream-layer").data(series).enter().append("path").attr("class", d => `stream-layer ${String(d.key).toLowerCase()}-layer`).attr("d", areaGen).attr("fill", d => colorScale(d.key)).attr("stroke", "#fff").attr("stroke-width", 0.5)
        .on("mouseover", (event, d_layer) => { /* ... tooltip logic ... */ })
        .on("mousemove", moveTooltip).on("mouseout", (event, d) => { /* ... tooltip logic ... */ });
    let xAxisTicks; if (timeDiffDays <= 2) xAxisTicks = d3.timeHour.every(6); else if (timeDiffDays <= 14) xAxisTicks = d3.timeDay.every(1); else if (timeDiffDays <= 90) xAxisTicks = d3.timeWeek.every(1); else xAxisTicks = d3.timeMonth.every(1);
    svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale).ticks(xAxisTicks).tickFormat(d3.timeFormat(timeDiffDays > 30 ? "%b %Y" : "%a %d"))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", margin.bottom - 10).attr("text-anchor", "middle").text("Date / Time");
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".0%")); svg.append("g").attr("class", "axis axis--y").call(yAxis).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - margin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Listening Time Rate (%)");
    const legendContainer = svg.append("g").attr("class", "streamgraph-legend").attr("transform", `translate(${width - 100}, ${-10})`); const legendItems = legendContainer.selectAll(".legend-item").data(contentTypes).enter().append("g").attr("class", "legend-item").attr("transform", (d, i) => `translate(0, ${i * 15})`); legendItems.append("rect").attr("x", 0).attr("y", 0).attr("width", 10).attr("height", 10).attr("fill", d => colorScale(d)); legendItems.append("text").attr("x", 15).attr("y", 5).attr("dy", "0.35em").style("font-size", "10px").text(d => d);
    const descriptionElement = container.nextElementSibling; if (descriptionElement && descriptionElement.classList.contains('chart-description')) descriptionElement.innerHTML = "Proportional listening rate (%) between Music and Podcasts.";
}
// async function drawForceGraph(filteredData, containerId, topN = 10) { /* ... simple plot version ... */ }
async function drawForceGraph2(filteredData, containerId, topN = 10) { /* ... enhanced plot version ... */
     const container = document.getElementById(containerId);
    if (!container) { console.error(`ForceGraph Error: Container #${containerId} not found.`); return; }
    container.innerHTML = "";

    if (!filteredData || filteredData.length < 2) {
        container.innerHTML = '<p class="empty-message">Not enough data for transitions.</p>';
        const descEl = container.nextElementSibling; if (descEl && descEl.classList.contains('chart-description')) descEl.innerHTML = 'Select period above.';
        return;
    }
    const musicData = filteredData.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0).sort((a, b) => a.ts - b.ts);
    if (musicData.length < 2) { container.innerHTML = '<p class="empty-message">Not enough music plays.</p>'; return; }
    const artistCounts = d3.rollup(musicData, v => v.length, d => d.artist);
    const topArtistsMap = new Map(Array.from(artistCounts.entries()).sort(([, countA], [, countB]) => countB - countA).slice(0, topN));
    if (topArtistsMap.size < 2) { container.innerHTML = `<p class="empty-message">Fewer than 2 top artists.</p>`; return; }
    const transitions = new Map();
    for (let i = 0; i < musicData.length - 1; i++) { const sourceArtist = musicData[i].artist; const targetArtist = musicData[i + 1].artist; if (topArtistsMap.has(sourceArtist) && topArtistsMap.has(targetArtist) && sourceArtist !== targetArtist) { const key = `${sourceArtist}:::${targetArtist}`; transitions.set(key, (transitions.get(key) || 0) + 1); } }
    if (transitions.size === 0) { container.innerHTML = '<p class="empty-message">No transitions between top artists.</p>'; return; }
    const nodes = Array.from(topArtistsMap.keys()).map(artist => ({ id: artist, playCount: topArtistsMap.get(artist) || 0 }));
    const links = Array.from(transitions.entries()).map(([key, count]) => { const [source, target] = key.split(":::"); return { source: source, target: target, value: count }; });

    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const containerWidth = container.clientWidth || 600; const containerHeight = 400;
    const width = containerWidth - margin.left - margin.right; const height = containerHeight - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) { container.innerHTML = '<p class="error-message">Container too small.</p>'; return; }

    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`).attr("preserveAspectRatio", "xMinYMid meet").style("max-width", "100%").style("height", "auto");
    const mainGroup = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    const zoomableGroup = mainGroup.append("g");
    mainGroup.append("rect").attr("width", width).attr("height", height).attr("fill", "none").attr("pointer-events", "all");
    zoomableGroup.append("defs").append("marker").attr("id", "arrowhead").attr("viewBox", "-0 -5 10 10").attr("refX", 15).attr("refY", 0).attr("orient", "auto").attr("markerWidth", 6).attr("markerHeight", 6).attr("xoverflow", "visible").append("svg:path").attr("d", "M 0,-5 L 10 ,0 L 0,5").attr("fill", "#999").style("stroke", "none");

    const minRadius = 5, maxRadius = 15;
    const playCountExtent = d3.extent(nodes, d => d.playCount);
    const nodeRadiusScale = d3.scaleSqrt().domain([playCountExtent[0] || 0, playCountExtent[1] || 1]).range([minRadius, maxRadius]);
    const nodeColorScale = d3.scaleSequential(d3.interpolateViridis).domain([playCountExtent[1] || 1, 0]);
    const maxStrokeWidth = 6;
    const linkWidthScale = d3.scaleLinear().domain([0, d3.max(links, d => d.value) || 1]).range([1, maxStrokeWidth]);

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(90).strength(link => 1 / Math.min(link.source.playCount || 1, link.target.playCount || 1))) // Added || 1 for safety
        .force("charge", d3.forceManyBody().strength(-180))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => nodeRadiusScale(d.playCount) + 6).strength(0.8));

    const linkedByIndex = {}; links.forEach(d => { linkedByIndex[`${d.source.id || d.source},${d.target.id || d.target}`] = 1; }); // Handle both string/object before simulation runs
    function areNeighbors(a, b) { return linkedByIndex[`${a.id},${b.id}`] || linkedByIndex[`${b.id},${a.id}`] || a.id === b.id; }

    const link = zoomableGroup.append("g").attr("class", "force-links").attr("stroke", "#999").attr("stroke-opacity", 0.5)
        .selectAll("line").data(links).join("line").attr("stroke-width", d => linkWidthScale(d.value)).attr("marker-end", "url(#arrowhead)");
    link.append("title").text(d => `${d.source.id || d.source} → ${d.target.id || d.target}\n${d.value} transitions`);

    const node = zoomableGroup.append("g").attr("class", "force-nodes").attr("stroke", "#fff").attr("stroke-width", 1.5)
        .selectAll("circle").data(nodes).join("circle").attr("r", d => nodeRadiusScale(d.playCount)).attr("fill", d => nodeColorScale(d.playCount)).call(drag(simulation));
    node.append("title").text(d => `${d.id}\n${d.playCount} plays`);

    const labels = zoomableGroup.append("g").attr("class", "force-labels").attr("font-family", "sans-serif").attr("font-size", 10).attr("fill", "#333").attr("stroke", "white").attr("stroke-width", 0.3).attr("paint-order", "stroke").attr("pointer-events", "none")
        .selectAll("text").data(nodes).join("text").attr("dx", d => nodeRadiusScale(d.playCount) + 4).attr("dy", "0.35em").text(d => d.id);

    // Hover Interaction functions (highlight, unhighlight, etc.)
    node.on("mouseover", highlight).on("mouseout", unhighlight);
    link.on("mouseover", highlightLink).on("mouseout", unhighlightLink);
    // ... (highlight/unhighlight function implementations remain the same) ...
     function highlight(event, d_hovered) {
        const opacity = 0.15; // How much to fade others
        node.style("opacity", n => areNeighbors(d_hovered, n) ? 1 : opacity);
        node.style("stroke", n => n === d_hovered ? 'black' : '#fff'); // Highlight border of hovered
        node.style("stroke-width", n => n === d_hovered ? 2.5 : 1.5);

        link.style("stroke-opacity", l => (l.source === d_hovered || l.target === d_hovered) ? 0.9 : opacity * 0.5);
        // Arrowhead selection needs to happen within the link selection
        link.filter(l => (l.source === d_hovered || l.target === d_hovered))
            .each(function() {
                d3.select(this).attr("marker-end", "url(#arrowhead-highlight)"); // Use a highlighted marker maybe? Or just change color below
            });
         zoomableGroup.select("#arrowhead path").style("fill", "#555"); // Simpler: change def color (affects all though) - Better to handle within selection

        labels.style("opacity", n => areNeighbors(d_hovered, n) ? 1 : opacity);
    }
    function unhighlight() {
        node.style("opacity", 1).style("stroke", '#fff').style("stroke-width", 1.5);
        link.style("stroke-opacity", 0.5);
        zoomableGroup.select("#arrowhead path").style("fill", "#999"); // Restore default arrow color
        labels.style("opacity", 1);
    }
    function highlightLink(event, d_hovered) { /* ... */ }
    function unhighlightLink(event, d_hovered) { /* ... */ }

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("cx", d => d.x).attr("cy", d => d.y);
        labels.attr("x", d => d.x).attr("y", d => d.y);
    });

    function zoomed(event) { zoomableGroup.attr("transform", event.transform); }
    const zoom = d3.zoom().scaleExtent([0.2, 8]).extent([[0, 0], [width, height]]).translateExtent([[0, 0], [width, height]]).on("zoom", zoomed);
    svg.call(zoom); svg.on("dblclick.zoom", null);

    function drag(simulation) { /* ... drag function implementation remains the same ... */
        function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; d3.select(this).raise(); }
        function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
        function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); if (!event.sourceEvent || !event.sourceEvent.type.includes('zoom')) { d.fx = null; d.fy = null; } if (d3.select(this).style("opacity") == 1) { highlight(event, d); } }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    const descEl = container.nextElementSibling; if (descEl && descEl.classList.contains('chart-description')) { descEl.innerHTML = `Transitions between top ${nodes.length} artists. Size/color = plays. Thickness = transitions. Hover/Pan/Zoom.`; }
}
async function drawTimeline(fullData, containerId) { /* ... plot version ... */
     const container = document.getElementById(containerId);
    if (!container) { console.error(`drawTimeline Error: Container element with ID "${containerId}" not found.`); return; }
    container.innerHTML = ""; // Clear first
    if (!fullData || fullData.length === 0) { container.innerHTML = '<p class="empty-message">No data available for Timeline.</p>'; return; }
    const latestTs = d3.max(fullData, d => d.ts);
    if (!latestTs) { container.innerHTML = '<p class="empty-message">No valid timestamps found for Timeline.</p>'; return; }
    const twentyFourHoursAgo = new Date(latestTs.getTime() - 24 * 60 * 60 * 1000);
    const timelineData = fullData.filter(d => d.ts >= twentyFourHoursAgo && d.ms_played > 0);
    if (timelineData.length === 0) { container.innerHTML = '<p class="empty-message">No listening events in the last 24 hours of data.</p>'; return; }
    const margin = { top: 10, right: 30, bottom: 30, left: 30 };
    const containerWidth = container.clientWidth || 800;
    const height = 100 - margin.top - margin.bottom;
    const width = containerWidth - margin.left - margin.right;
    if (width <= 0 || height <= 0) { container.innerHTML = '<p class="error-message">Container too small for Timeline chart.</p>'; return; }
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    const xScale = d3.scaleTime().domain([twentyFourHoursAgo, latestTs]).range([0, width]);
    const platforms = [...new Set(timelineData.map(d => d.platform || "Unknown"))];
    const colorScale = d3.scaleOrdinal().domain(platforms).range(d3.schemeCategory10);
    svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale).ticks(d3.timeHour.every(3)).tickFormat(d3.timeFormat("%H:%M")));
    const tapeHeight = height * 0.6; const tapeY = (height - tapeHeight) / 2;
    svg.selectAll(".timeline-event").data(timelineData).enter().append("rect").attr("class", "timeline-event")
       .attr("x", d => xScale(d.ts)).attr("y", tapeY)
       .attr("width", d => { const startX = xScale(d.ts); const endTs = new Date(d.ts.getTime() + d.ms_played); const effectiveEndX = xScale(endTs > latestTs ? latestTs : endTs); return Math.max(1, effectiveEndX - startX); })
       .attr("height", tapeHeight).attr("fill", d => colorScale(d.platform || "Unknown"))
       .attr("stroke", d => d.skipped ? handleColor : "#333").attr("stroke-width", d => d.skipped ? 1.5 : 0.5)
       .on("mouseover", (event, d) => {
            d3.select(event.currentTarget).attr("stroke-width", d.skipped ? 2.5 : 1.5);
            const content = `<b>${d.track || d.episode_name || d.audiobook_chapter_title || 'Unknown Title'}</b><br>Artist/Show: ${d.artist || d.episode_show_name || d.audiobook_title || 'N/A'}<br>Album: ${d.album || 'N/A'}<br>Duration: ${formatTime(d.ms_played / 60000)}<br>Time: ${d3.timeFormat('%H:%M:%S')(d.ts)}<br>Platform: ${d.platform || 'Unknown'}<br>Skipped: ${d.skipped ? 'Yes' : 'No'} <br>Reason Start: ${d.reason_start || 'N/A'}<br>Reason End: ${d.reason_end || 'N/A'}`;
            showTooltip(event, content);
       })
       .on("mousemove", moveTooltip).on("mouseout", (event, d) => { d3.select(event.currentTarget).attr("stroke-width", d.skipped ? 1.5 : 0.5); hideTooltip(); });
}

// --- Text Generating Functions (Only called if USE_TEXT_MODE is true) ---

function drawCalendarAsText(data, initialStartDate, initialEndDate) {
    const container = document.getElementById('calendar');
    const legendContainer = document.getElementById('legend'); // Also clear legend
    if (!container || !legendContainer) return;
    container.innerHTML = "";
    legendContainer.innerHTML = ""; // Clear legend area too

    const listeningData = data.filter(d => d.ms_played > 0);
    if (listeningData.length === 0) {
        container.innerHTML = `<p class="empty-message">No listening data for this period (${formatDate(initialStartDate)} to ${formatDate(initialEndDate)}).</p>`;
        return;
    }

    const dailyData = d3.rollups(listeningData, v => d3.sum(v, d => d.ms_played / 60000), d => formatDay(d.ts));
    const valueMap = new Map(dailyData);
    const totalMinutes = d3.sum(valueMap.values());
    const numberOfDaysWithListening = valueMap.size;
    const totalDaysInPeriod = d3.timeDay.count(initialStartDate, d3.timeDay.offset(initialEndDate, 1));
    const averageMinutesPerListeningDay = totalMinutes / (numberOfDaysWithListening || 1);
    const averageMinutesOverall = totalMinutes / (totalDaysInPeriod || 1);

    let peakDayStr = null; let maxMinutesOnPeakDay = 0;
    valueMap.forEach((minutes, dayStr) => { if (minutes > maxMinutesOnPeakDay) { maxMinutesOnPeakDay = minutes; peakDayStr = dayStr; } });

    const monthlyTotals = new Map();
    valueMap.forEach((minutes, dayStr) => { const dayDate = new Date(dayStr); const monthStartDate = d3.timeMonth.floor(dayDate); const monthKey = monthStartDate.toISOString(); monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + minutes); });
    let peakMonthKey = null; let maxMinutesInPeakMonth = 0;
    monthlyTotals.forEach((totalMinutesInMonth, monthKey) => { if (totalMinutesInMonth > maxMinutesInPeakMonth) { maxMinutesInPeakMonth = totalMinutesInMonth; peakMonthKey = monthKey; } });

    let textContent = `<h3>Listening Summary: ${formatDate(initialStartDate)} to ${formatDate(initialEndDate)}</h3>`;
    textContent += `<p>Total listening time: <strong>${formatTime(totalMinutes)}</strong> across ${numberOfDaysWithListening} days (out of ${totalDaysInPeriod} total days).</p>`;
    textContent += `<p>Average per day (overall): ${formatTime(averageMinutesOverall)}.</p>`;
    textContent += `<p>Average per listening day: ${formatTime(averageMinutesPerListeningDay)}.</p>`;
    if (peakDayStr) textContent += `<p>Peak day: <strong>${formatDate(new Date(peakDayStr))}</strong> (${formatTime(maxMinutesOnPeakDay)}).</p>`;
    if (peakMonthKey) textContent += `<p>Peak month: <strong>${formatFullMonthYear(new Date(peakMonthKey))}</strong> (Total: ${formatTime(maxMinutesInPeakMonth)}).</p>`;
    else textContent += `<p>Peak month could not be determined.</p>`;

    container.innerHTML = textContent;
    updateFilterInfoLabel(initialStartDate, initialEndDate); // Update label
}

function updateTopArtistsAsText(data) {
    const targetUl = document.getElementById('topArtists');
    if (!targetUl) return; targetUl.innerHTML = "";
    if (!data || data.length === 0) { targetUl.innerHTML = `<li class="empty-message">No data.</li>`; return; }
    const artistData = d3.rollups(data.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.artist).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (artistData.length === 0) { targetUl.innerHTML = `<li class="empty-message">No artist data.</li>`; return; }
    let listContent = '';
    artistData.forEach(([artist, totalMinutes], index) => { listContent += `<li><span class="artist-name">${index + 1}. ${artist}</span> <span class="artist-time">(${formatTime(totalMinutes)})</span></li>`; });
    targetUl.innerHTML = listContent;
}

function updateTopTracksAsText(data) {
    const targetDiv = document.getElementById('top-tracks-chart');
    if (!targetDiv) return; targetDiv.innerHTML = "";
    if (!requiredColumns.track_name) { targetDiv.innerHTML = `<p class="error-message">Track data missing.</p>`; return; }
    if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
    const trackData = d3.rollups( data.filter(d => d.track && d.track !== "Unknown Track" && d.track !== "N/A" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => `${d.track} • ${d.artist}` ).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (trackData.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No track data.</p>`; return; }
    let listContent = '<ol class="top-tracks-text-list">';
    trackData.forEach(([trackArtist, totalMinutes], index) => {
        const parts = trackArtist.split('•'); const trackName = parts[0]?.trim() || 'Unknown Track'; const artistName = parts[1]?.trim() || 'Unknown Artist';
        listContent += `<li><span class="track-info"><span class="track-name">${trackName}</span><br><span class="track-artist">${artistName}</span></span><span class="track-time"> (${formatTime(totalMinutes)})</span></li>`;
    });
    listContent += '</ol>'; targetDiv.innerHTML = listContent;
}

function updateTimeOfDayChartAsText(data) {
    const targetDiv = document.getElementById('time-of-day-chart');
    if (!targetDiv) return; targetDiv.innerHTML = "";
    if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
    const hourData = d3.rollups( data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getHours() );
    const hourMap = new Map(hourData.sort((a, b) => d3.descending(a[1], b[1])));
    if (hourMap.size === 0) { targetDiv.innerHTML = `<p class="empty-message">No listening time.</p>`; return; }
    const totalMinutes = d3.sum(hourMap.values()); const peakHour = hourMap.keys().next().value; const peakMinutes = hourMap.get(peakHour);
    let textContent = `<h4>Time of Day Summary</h4><p>Total: ${formatTime(totalMinutes)}.</p>`;
    textContent += `<p>Peak hour: <strong>${peakHour}:00 - ${peakHour + 1}:00</strong> (${formatTime(peakMinutes)}).</p>`;
    textContent += `<p>Top 3 Hours:</p><ul>`; let count = 0;
    for (const [hour, minutes] of hourMap.entries()) { if (count < 3) { textContent += `<li>${hour}:00 - ${hour + 1}:00: ${formatTime(minutes)}</li>`; count++; } else break; }
    textContent += `</ul>`; targetDiv.innerHTML = textContent;
}

function updateDayOfWeekChartAsText(data) {
    const targetDiv = document.getElementById('day-of-week-chart');
    if (!targetDiv) return; targetDiv.innerHTML = "";
    if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
    const dayData = d3.rollups( data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getDay() );
    const dayMap = new Map(dayData.sort((a, b) => d3.descending(a[1], b[1])));
    if (dayMap.size === 0) { targetDiv.innerHTML = `<p class="empty-message">No listening time.</p>`; return; }
    const totalMinutes = d3.sum(dayMap.values()); const peakDayIndex = dayMap.keys().next().value; const peakMinutes = dayMap.get(peakDayIndex);
    let textContent = `<h4>Day of Week Summary</h4><p>Total: ${formatTime(totalMinutes)}.</p>`;
    textContent += `<p>Peak day: <strong>${dayOfWeekNames[peakDayIndex]}</strong> (${formatTime(peakMinutes)}).</p>`;
    textContent += `<p>Ranked Days:</p><ol>`;
    for (const [dayIndex, minutes] of dayMap.entries()) { textContent += `<li>${dayOfWeekNames[dayIndex]}: ${formatTime(minutes)}</li>`; }
    for (let i = 0; i < 7; i++) { if (!dayMap.has(i)) textContent += `<li>${dayOfWeekNames[i]}: ${formatTime(0)}</li>`; }
    textContent += `</ol>`; targetDiv.innerHTML = textContent;
}

function drawStreamgraphAsText(filteredData, containerId) {
    const container = document.getElementById(containerId); if (!container) return; container.innerHTML = "";
    if (!filteredData || filteredData.length === 0) { container.innerHTML = '<p class="empty-message">No data.</p>'; return; }
    const streamDataProcessed = filteredData.map(d => { let contentType = 'Music'; if (d.episode_name && String(d.episode_name).trim() !== "") contentType = 'Podcast'; return { ...d, contentType: contentType }; }).filter(d => d.ms_played > 0);
    if (streamDataProcessed.length === 0) { container.innerHTML = '<p class="empty-message">No Music/Podcast data.</p>'; return; }
    const timeByType = d3.rollup( streamDataProcessed, v => d3.sum(v, d => d.ms_played), d => d.contentType );
    const totalMsPlayed = d3.sum(timeByType.values()); const musicMs = timeByType.get('Music') || 0; const podcastMs = timeByType.get('Podcast') || 0;
    const musicPercent = totalMsPlayed > 0 ? (musicMs / totalMsPlayed * 100) : 0; const podcastPercent = totalMsPlayed > 0 ? (podcastMs / totalMsPlayed * 100) : 0;
    let textContent = `<h4>Music vs Podcast Summary</h4><ul>`;
    textContent += `<li><strong>Music:</strong> ${formatTime(musicMs / 60000)} (${musicPercent.toFixed(1)}%)</li>`;
    textContent += `<li><strong>Podcast:</strong> ${formatTime(podcastMs / 60000)} (${podcastPercent.toFixed(1)}%)</li>`;
    textContent += `</ul><p>Total considered: ${formatTime(totalMsPlayed / 60000)}.</p>`;
    container.innerHTML = textContent;
    const descEl = container.nextElementSibling; if (descEl && descEl.classList.contains('chart-description')) descEl.innerHTML = "Total time breakdown for Music/Podcasts.";
}

function drawForceGraphAsText(filteredData, containerId, topN = 10) {
    const container = document.getElementById(containerId); if (!container) return; container.innerHTML = "";
    if (!filteredData || filteredData.length < 2) { container.innerHTML = '<p class="empty-message">Not enough data.</p>'; return; }
    const musicData = filteredData.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0).sort((a, b) => a.ts - b.ts);
    if (musicData.length < 2) { container.innerHTML = '<p class="empty-message">Not enough music plays.</p>'; return; }
    const artistCounts = d3.rollup(musicData, v => v.length, d => d.artist);
    const topArtistsMap = new Map(Array.from(artistCounts.entries()).sort(([, countA], [, countB]) => countB - countA).slice(0, topN));
    if (topArtistsMap.size < 2) { container.innerHTML = `<p class="empty-message">Fewer than 2 top artists.</p>`; return; }
    const transitions = new Map();
    for (let i = 0; i < musicData.length - 1; i++) { const sourceArtist = musicData[i].artist; const targetArtist = musicData[i + 1].artist; if (topArtistsMap.has(sourceArtist) && topArtistsMap.has(targetArtist) && sourceArtist !== targetArtist) { const key = `${sourceArtist}:::${targetArtist}`; transitions.set(key, (transitions.get(key) || 0) + 1); } }
    if (transitions.size === 0) { container.innerHTML = '<p class="empty-message">No transitions between top artists.</p>'; return; }
    let textContent = `<h4>Artist Transitions Summary (Top ${topArtistsMap.size})</h4><p>Top Artists:</p><ul>`;
    topArtistsMap.forEach((count, artist) => { textContent += `<li>${artist} (${count} plays)</li>`; });
    textContent += `</ul>`; const sortedTransitions = Array.from(transitions.entries()).sort((a, b) => d3.descending(a[1], b[1]));
    textContent += `<p>Most Frequent Transitions (${transitions.size} unique):</p><ol>`;
    const maxTransitionsToShow = 10;
    sortedTransitions.slice(0, maxTransitionsToShow).forEach(([key, count]) => { const [source, target] = key.split(":::"); textContent += `<li>${source} → ${target} (${count} times)</li>`; });
    if (sortedTransitions.length > maxTransitionsToShow) textContent += `<li>... (${sortedTransitions.length - maxTransitionsToShow} more)</li>`;
    textContent += `</ol>`; container.innerHTML = textContent;
    const descEl = container.nextElementSibling; if (descEl && descEl.classList.contains('chart-description')) descEl.innerHTML = `Summary of transitions between top ${topArtistsMap.size} artists.`;
}


// --- Main Update Triggers ---

// Updates PLOT components based on filtered data
function handleBrushUpdate(filteredChartData) {
    const dataToUpdate = filteredChartData || [];
    updateTopArtists(dataToUpdate);
    updateTopTracksChart2(dataToUpdate); // Using sparkline version for plots
    updateTimeOfDayChart(dataToUpdate);
    updateDayOfWeekChart(dataToUpdate);
    drawStreamgraph(dataToUpdate, 'streamgraph-chart');
    drawForceGraph2(dataToUpdate, 'force-graph-chart');
}

// Updates TEXT summary components based on filtered data
function handleBrushUpdateAsText(filteredChartData) {
    const dataToUpdate = filteredChartData || [];
    console.log("Updating text components...");
    updateTopArtistsAsText(dataToUpdate);
    updateTopTracksAsText(dataToUpdate);
    updateTimeOfDayChartAsText(dataToUpdate);
    updateDayOfWeekChartAsText(dataToUpdate);
    drawStreamgraphAsText(dataToUpdate, 'streamgraph-chart');
    drawForceGraphAsText(dataToUpdate, 'force-graph-chart');
}

// --- Core Visualization Update Function (Handles Mode Switching) ---
// Called when the main date range (year dropdown, date inputs) changes.
function updateVisualization(filteredData) { // Renamed from updateVisualizationText
     const chartsToClear = [
         topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv,
         document.getElementById('streamgraph-chart'),
         document.getElementById('force-graph-chart')
     ];
     if (calendarDiv) calendarDiv.innerHTML = ""; // Clear main display area
     if (legendDiv) legendDiv.innerHTML = "";   // Clear legend area

     selectedStartDate = null; selectedEndDate = null; // Reset selection state
     currentViewData = filteredData || [];       // Store the data for the current view

     // Handle empty/invalid data for this period
     if (!filteredData || filteredData.length === 0) {
        if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No data for selected period.</p>`;
        chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
        updateFilterInfoLabel(null, null);
        // Clear dependent components using the appropriate handler based on mode
        if (USE_TEXT_MODE) handleBrushUpdateAsText([]);
        else handleBrushUpdate([]);
        return;
    }

    // Determine the date range of the incoming data
    const [viewStartDate, viewEndDate] = d3.extent(filteredData, d => d.ts);

    if (!viewStartDate || !viewEndDate || isNaN(viewStartDate) || isNaN(viewEndDate)) {
         console.error("updateVisualization: Invalid date range in data.");
         if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Invalid date range in data.</p>`;
         chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
         updateFilterInfoLabel(null, null);
         // Clear dependent components based on mode
          if (USE_TEXT_MODE) handleBrushUpdateAsText([]);
          else handleBrushUpdate([]);
         return;
    }

    // --- MODE SWITCH ---
    if (USE_TEXT_MODE) {
        console.log("Rendering in Text Mode");
        // 1. Display the main calendar summary text
        drawCalendarAsText(filteredData, viewStartDate, viewEndDate);
        // 2. Update all other text components with the full initial range data
        handleBrushUpdateAsText(filteredData);
        // 3. Update the filter label to show the full range
        updateFilterInfoLabel(viewStartDate, viewEndDate);

    } else {
        console.log("Rendering in Plot Mode");
        // 1. Draw the interactive visual calendar
        // This function internally sets selectedStartDate/EndDate and calls drawHandles
        drawCalendar(filteredData, viewStartDate, viewEndDate);
        // 2. Filter data and update plots for the initial full range displayed by the calendar
        // Pass the dates explicitly to ensure the correct initial range is used
        filterDataAndUpdateCharts(viewStartDate, viewEndDate);
        // updateFilterInfoLabel is called within drawCalendar or filterDataAndUpdateCharts
    }
}


// --- Filter Data and Update Dependent Components ---
// Called by updateVisualization (in plot mode) or handleDragEnd (plot mode)
function filterDataAndUpdateCharts(startDate, endDate) { // Renamed from filterDataAndUpdateChartsText
    const validStartDate = (startDate instanceof Date && !isNaN(startDate)) ? startDate : selectedStartDate;
    const validEndDate = (endDate instanceof Date && !isNaN(endDate)) ? endDate : selectedEndDate;

    if (!validStartDate || !validEndDate || !currentViewData || isNaN(validStartDate) || isNaN(validEndDate) || validStartDate > validEndDate) {
       console.warn("filterDataAndUpdateCharts: Invalid date range or no data.", { validStartDate, validEndDate });
       if (USE_TEXT_MODE) handleBrushUpdateAsText([]);
       else handleBrushUpdate([]);
       updateFilterInfoLabel(validStartDate, validEndDate);
       return;
    }

    const filterStart = d3.timeDay.floor(validStartDate);
    const filterEnd = d3.timeDay.offset(d3.timeDay.floor(validEndDate), 1);
    const filtered = currentViewData.filter(d => {
       const dDate = d.ts;
       return dDate instanceof Date && !isNaN(dDate) && dDate >= filterStart && dDate < filterEnd;
    });

    console.log(`Filtered data from ${formatDate(validStartDate)} to ${formatDate(validEndDate)}: ${filtered.length} records.`);
    updateFilterInfoLabel(validStartDate, validEndDate); // Update label

    // --- MODE SWITCH ---
    // Call the appropriate update handler based on the global mode
    if (USE_TEXT_MODE) {
       handleBrushUpdateAsText(filtered);
    } else {
       handleBrushUpdate(filtered); // CORRECTED: Call plot handler in plot mode
    }
}


// --- Event Listeners ---
if (wrappedYearSelect) {
    wrappedYearSelect.onchange = () => {
        const selectedYearValue = wrappedYearSelect.value;
        if (!selectedYearValue) {
             console.warn("Empty year selected.");
             // Optionally clear or show all data: updateVisualization(allParsedData);
             return;
        }
        const selectedYear = +selectedYearValue;
        if (!selectedYear || isNaN(selectedYear)) {
           console.warn("Invalid year selected:", selectedYearValue);
           updateVisualization([]); return;
        }
        const yearStart = new Date(selectedYear, 0, 1);
        const yearEndFilter = new Date(selectedYear + 1, 0, 1);
        const filteredByYear = allParsedData.filter(d => d.ts >= yearStart && d.ts < yearEndFilter);
        // Update date inputs to reflect the selected year
        if (startDateInput) startDateInput.value = formatDateForInput(yearStart);
        if (endDateInput) endDateInput.value = formatDateForInput(new Date(selectedYear, 11, 31));
        // Call the main update function which handles the mode switch
        updateVisualization(filteredByYear); // Use the renamed function
    };
} else {
     console.error("Cannot attach change listener: #wrappedYearSelect not found.");
}

if (applyRangeBtn) { // Check if button exists
    applyRangeBtn.onclick = () => {
         const startStr = startDateInput.value; const endStr = endDateInput.value;
         const startMs = Date.parse(startStr); const endMs = Date.parse(endStr);
         let start = !isNaN(startMs) ? d3.timeDay.floor(new Date(startMs)) : null;
         let end = !isNaN(endMs) ? d3.timeDay.floor(new Date(endMs)) : null;
        if (!start || !end) { alert("Invalid date format. Please use YYYY-MM-DD."); return; }
        if (start > end) {
            console.warn("Start date was after end date, swapping them.");
            [start, end] = [end, start]; // Swap
            startDateInput.value = formatDateForInput(start); // Update inputs
            endDateInput.value = formatDateForInput(end);
        }
        // Calculate end filter date (exclusive)
        const filterEnd = d3.timeDay.offset(end, 1);
        // Clear year selection as date range takes precedence
        if (wrappedYearSelect) wrappedYearSelect.value = "";
        // Filter the *entire* dataset by the selected range
        const filteredByRange = allParsedData.filter(d => d.ts >= start && d.ts < filterEnd);
        // Call the main update function which handles the mode switch
        updateVisualization(filteredByRange); // Use the renamed function
    };
} else {
     console.error("Cannot attach click listener: #applyRangeBtn not found.");
}
