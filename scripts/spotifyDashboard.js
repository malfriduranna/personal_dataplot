// --- Configuration ---
const cellSize = 9; // Smaller cells for multi-year view
const cellPadding = 1; // Smaller padding
const leftPadding = 40; // Space for day/year labels
const topPadding = 20;  // Space above month labels within a year block
const yearLabelPadding = 25; // Extra space above each year for the label
const spaceBetweenYears = 30; // Vertical space between year blocks
const noDataColor = "#ebedf0";
const calendarColorScale = d3.scaleSequential(d3.interpolateBlues);
const chartMargin = { top: 20, right: 20, bottom: 60, left: 70 }; // General chart margins
const topListChartMargin = { top: 10, right: 50, bottom: 20, left: 120 }; // Margins for top list bar charts
const barHeight = 20; // Height for bars in top list charts

// --- Handle Configuration (Only relevant for plot mode & single year view) ---
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
const topArtistsContainer = document.getElementById('top-artists-chart'); // Target the DIV now
const tooltipDiv = d3.select("#tooltip");
const topTracksContainer = document.getElementById('top-tracks-chart'); // Target the DIV
const timeOfDayDiv = document.getElementById('time-of-day-chart');
const dayOfWeekDiv = document.getElementById('day-of-week-chart');
const filterInfoSpan = document.getElementById('current-filter-info');
const forceGraphSlider = document.getElementById('forceGraphSlider');
const forceGraphSliderValueSpan = document.getElementById('forceGraphSliderValue');


// --- Helper Functions ---
const formatDay = d3.timeFormat("%Y-%m-%d");
const formatDate = d3.timeFormat("%a, %b %d, %Y");
const formatMonth = d3.timeFormat("%b");
const formatFullMonthYear = d3.timeFormat("%B %Y");
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

function truncateText(text, maxLength) {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
}

// --- Global variables ---
let allParsedData = [];
let requiredColumns = {
    track_name: false, platform: false, skipped: false, episode_name: false,
    episode_show_name: false, audiobook_title: false, audiobook_chapter_title: false,
    reason_start: false, reason_end: false, artist: false, shuffle: false,
    album: false, conn_country: false,
};
let currentViewData = []; // Data filtered by year/range from controls
let selectedStartDate = null; // Start date of brush/handle selection (plot mode, single year)
let selectedEndDate = null; // End date of brush/handle selection (plot mode, single year)
// Plot-mode specific globals
let svgInstance = null; // Main calendar SVG instance
let allDaysInCalendar = []; // Used only by single-year handle drag logic
let calendarStartDay = null; // Start day of the grid (for single-year handle logic)
let cellWidthWithPadding = cellSize + cellPadding; // Calculated width+padding
let currentCalendarHeight = 0; // Height of the single-year grid (for handle logic)
let currentForceGraphTopN = 5; // Default for force graph slider, matches HTML slider value

// --- Data Processing (Runs once) ---
(async function loadData() {
    try {
        const rawData = await d3.csv("data/astrid_data.csv");

        // Detect available columns
        const columns = new Set(rawData.columns);
        const columnMapping = { /* ... mapping ... */
            track_name: 'master_metadata_track_name', artist: 'master_metadata_album_artist_name',
            album: 'master_metadata_album_album_name', platform: 'platform', skipped: 'skipped',
            shuffle: 'shuffle', episode_name: 'episode_name', episode_show_name: 'episode_show_name',
            audiobook_title: 'audiobook_title', audiobook_chapter_title: 'audiobook_chapter_title',
            reason_start: 'reason_start', reason_end: 'reason_end', conn_country: 'conn_country'
        };
        Object.keys(columnMapping).forEach(key => { requiredColumns[key] = columns.has(columnMapping[key]); });

        allParsedData = rawData.map(d => ({ /* ... parsing ... */
            ts: new Date(d.ts), ms_played: +d.ms_played, platform: d.platform,
            conn_country: d.conn_country, artist: d.master_metadata_album_artist_name || "Unknown Artist",
            track: requiredColumns.track_name ? (d.master_metadata_track_name || "Unknown Track") : "N/A",
            album: d.master_metadata_album_album_name, episode_name: d.episode_name,
            episode_show_name: d.episode_show_name, audiobook_title: d.audiobook_title,
            audiobook_chapter_title: d.audiobook_chapter_title,
            skipped: ['true', '1', true].includes(String(d.skipped).toLowerCase()),
            shuffle: ['true', '1', true].includes(String(d.shuffle).toLowerCase()),
            reason_start: d.reason_start, reason_end: d.reason_end,
         })).filter(d => d.ts instanceof Date && !isNaN(d.ts) && typeof d.ms_played === 'number' && !isNaN(d.ms_played) && d.ms_played >= 0);

        console.log(`Loaded and parsed ${allParsedData.length} valid records.`);
        const years = [...new Set(allParsedData.map(d => d.ts.getFullYear()))].sort((a, b) => a - b);
        console.log("Available years:", years);

        // Handle no valid data
        if (allParsedData.length === 0) { /* ... error messages ... */
            if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">No valid data found.</p>`;
            if (filterInfoSpan) filterInfoSpan.textContent = 'No data loaded';
            [topArtistsContainer, topTracksContainer, timeOfDayDiv, dayOfWeekDiv,
             document.getElementById('streamgraph-chart'), document.getElementById('force-graph-chart')
            ].forEach(el => { if (el) el.innerHTML = `<p class="empty-message">No data.</p>`; });
            return;
        }

        // Populate Year Select
        if (wrappedYearSelect) { /* ... populate options ... */
             years.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y; opt.textContent = y; wrappedYearSelect.appendChild(opt);
            });
        } else { console.error("Cannot find #wrappedYearSelect."); }

        // Initial Load
        const defaultYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
        if (wrappedYearSelect) {
            wrappedYearSelect.value = defaultYear;
            wrappedYearSelect.dispatchEvent(new Event('change')); // Triggers updateVisualization
       }
    } catch (error) { /* ... error handling ... */
         console.error("Error loading or processing data:", error);
        if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Error loading data.</p>`;
        if (filterInfoSpan) filterInfoSpan.textContent = 'Error loading data';
        [topArtistsContainer, topTracksContainer, timeOfDayDiv, dayOfWeekDiv,
         document.getElementById('streamgraph-chart'), document.getElementById('force-graph-chart')
        ].forEach(el => { if (el) el.innerHTML = `<p class="error-message">Error loading data.</p>`; });
    }
})();

// --- Tooltip Logic ---
const showTooltip = (event, content) => { /* ... implementation ... */
    tooltipDiv.style("opacity", 1).html(content)
        .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
};
const moveTooltip = (event) => { /* ... implementation ... */
     tooltipDiv.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
};
const hideTooltip = () => { /* ... implementation ... */
    tooltipDiv.style("opacity", 0);
};

// --- Calendar Dragging Helper Functions (Plot Mode - Single Year Only) ---
function getXFromDate(date, firstDayOfGrid, columnWidth) { /* ... implementation ... */
     if (!date || !firstDayOfGrid || isNaN(date) || isNaN(firstDayOfGrid) || !columnWidth || columnWidth <= 0) return NaN;
    const startOfWeekGrid = d3.timeWeek.floor(firstDayOfGrid);
    const startOfWeekDate = d3.timeWeek.floor(date);
    if (startOfWeekDate < startOfWeekGrid) return 0; // Clamp to start
    const weekIndex = d3.timeWeek.count(startOfWeekGrid, startOfWeekDate);
    return weekIndex * columnWidth;
}
function getDateFromX(xPos, daysArray, firstDayOfGrid, columnWidth) { /* ... implementation ... */
    // This logic needs the daysArray for the *specific year* being dragged over.
     if (!daysArray || daysArray.length === 0 || !firstDayOfGrid || !columnWidth || columnWidth <= 0 || xPos < -columnWidth / 2) return null;
    const firstDayInArray = daysArray[0]; const lastDayInArray = daysArray[daysArray.length - 1];
    const maxWeekIndex = d3.timeWeek.count(d3.timeWeek.floor(firstDayOfGrid), d3.timeWeek.floor(lastDayInArray));
    const calculatedIndex = Math.floor((xPos + columnWidth / 2) / columnWidth);
    const weekIndex = Math.max(0, Math.min(calculatedIndex, maxWeekIndex)); // Clamp index
    const targetWeekStartDate = d3.timeWeek.offset(firstDayOfGrid, weekIndex);
    let foundDate = daysArray.find(d => d3.timeWeek.floor(d).getTime() === targetWeekStartDate.getTime());
    if (!foundDate) { if (targetWeekStartDate <= firstDayInArray) return firstDayInArray; if (targetWeekStartDate >= d3.timeWeek.floor(lastDayInArray)) return lastDayInArray; foundDate = daysArray.slice().reverse().find(d => d < targetWeekStartDate); return foundDate || lastDayInArray; }
    return foundDate;
}

// --- Filter Info Label Update ---
function updateFilterInfoLabel(startDate, endDate) { /* ... implementation ... */
    if (!filterInfoSpan) return;
    if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) { filterInfoSpan.textContent = `${formatDate(startDate)} → ${formatDate(endDate)}`; }
    else if (currentViewData && currentViewData.length > 0) { const [minD, maxD] = d3.extent(currentViewData, d => d.ts); if (minD && maxD) filterInfoSpan.textContent = `${formatDate(minD)} → ${formatDate(maxD)} (Full View)`; else filterInfoSpan.textContent = 'Full selected range'; }
    else { filterInfoSpan.textContent = 'No selection or data'; }
}

// --- Plotting Functions ---

// Multi-Year Calendar Plot (Final Version - Renamed from drawCalendar3)
function drawCalendar2(data, initialStartDate, initialEndDate) {
    calendarDiv.innerHTML = ""; legendDiv.innerHTML = "";
    svgInstance = null; allDaysInCalendar = []; calendarStartDay = null; currentCalendarHeight = 0;

    const listeningData = data.filter(d => d.ms_played > 0);
    if (listeningData.length === 0) { /* ... no data message ... */
        if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No listening data.</p>`;
        updateFilterInfoLabel(initialStartDate, initialEndDate);
        drawLegend(legendDiv, calendarColorScale, 0);
        return;
    }

    const dailyData = d3.rollups(listeningData, v => d3.sum(v, d => d.ms_played / 60000), d => formatDay(d.ts));
    const valueMap = new Map(dailyData); const maxMinutesOverall = d3.max(valueMap.values()) || 0;
    calendarColorScale.domain([0, maxMinutesOverall || 1]);
    const dataStartDate = new Date(initialStartDate); const dataEndDate = new Date(initialEndDate);
    if (!dataStartDate || !dataEndDate || isNaN(dataStartDate) || isNaN(dataEndDate) || dataStartDate > dataEndDate) { /* ... error ... */ return; }

    const startYear = dataStartDate.getFullYear(); const endYear = dataEndDate.getFullYear();
    const years = d3.range(startYear, endYear + 1); years.reverse(); const multiYear = years.length > 1;
    cellWidthWithPadding = cellSize + cellPadding;
    const singleYearWidth = (53 * cellWidthWithPadding) + leftPadding + 20;
    const singleYearHeight = (7 * cellWidthWithPadding) + topPadding + yearLabelPadding;
    const totalWidth = singleYearWidth; const totalHeight = (years.length * (singleYearHeight + spaceBetweenYears)) - spaceBetweenYears;

    const svg = d3.select("#calendar").append("svg").attr("width", totalWidth).attr("height", totalHeight); svgInstance = svg;
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // Draw Day Labels
    svg.append("g").attr("transform", `translate(${leftPadding - 15}, ${topPadding + yearLabelPadding})`).selectAll(".day-label").data(d3.range(7)).enter().append("text").attr("class", "day-label").attr("x", -5).attr("y", d => d * cellWidthWithPadding + cellWidthWithPadding / 2 - cellSize / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(d => dayLabels[d]);

    years.forEach((year, yearIndex) => { // Loop through each year
        const yearGroup = svg.append("g").attr("class", `year-group year-${year}`).attr("transform", `translate(${leftPadding}, ${yearIndex * (singleYearHeight + spaceBetweenYears)})`);
        const yearStartDate = new Date(year, 0, 1); const yearEndDate = new Date(year, 11, 31); const currentYearActualStart = d3.max([yearStartDate, dataStartDate]); const currentYearActualEnd = d3.min([yearEndDate, dataEndDate]);
        const daysInYearRange = d3.timeDays(currentYearActualStart, d3.timeDay.offset(currentYearActualEnd, 1)); if (daysInYearRange.length === 0) return;
        const firstDayOfYearGrid = d3.timeWeek.floor(new Date(year, 0, 1)); const monthsInYear = d3.timeMonths(d3.max([yearStartDate, d3.timeMonth.floor(currentYearActualStart)]), d3.timeMonth.offset(currentYearActualEnd, 1));
        yearGroup.append("text").attr("class", "year-label").attr("x", 0).attr("y", topPadding - 5).text(year); // Year Label
        yearGroup.selectAll(".month-label").data(monthsInYear).enter().append("text").attr("class", "month-label") // Month Labels
            .attr("x", d => { const displayWeekStart = d3.max([firstDayOfYearGrid, d3.timeWeek.floor(d)]); return d3.timeWeek.count(firstDayOfYearGrid, displayWeekStart) * cellWidthWithPadding; })
            .attr("y", topPadding + yearLabelPadding - 10).text(formatMonth);
        yearGroup.append("g").attr("transform", `translate(0, ${topPadding + yearLabelPadding})`) // Cells
             .selectAll(".day-cell").data(daysInYearRange).enter().append("rect").attr("class", "day-cell").attr("width", cellSize).attr("height", cellSize).attr("rx", 2).attr("ry", 2).attr("x", d => d3.timeWeek.count(firstDayOfYearGrid, d) * cellWidthWithPadding).attr("y", d => d.getDay() * cellWidthWithPadding).attr("fill", noDataColor).attr("stroke", "#fff").attr("stroke-width", 0.5)
             .each(function(d) { const dayStr = formatDay(d); const value = valueMap.get(dayStr); d3.select(this).attr("fill", (value === undefined || value <= 0) ? noDataColor : calendarColorScale(value)); })
             .on("mouseover", (event, d) => { /* ... tooltip ... */
                 const key = formatDay(d); const valueMins = valueMap.get(key) || 0;
                 showTooltip(event, `${formatDate(d)}<br><b>Listened: ${formatTime(valueMins)}</b>`);
                 d3.select(event.currentTarget).attr("stroke", "#333").attr("stroke-width", 1.5);
              })
             .on("mousemove", moveTooltip).on("mouseout", (event) => { /* ... tooltip ... */
                hideTooltip(); d3.select(event.currentTarget).attr("stroke", "#fff").attr("stroke-width", 0.5);
              });
        if (!multiYear) { currentCalendarHeight = 7 * cellWidthWithPadding; calendarStartDay = firstDayOfYearGrid; allDaysInCalendar = daysInYearRange; }
    });

    drawLegend(legendDiv, calendarColorScale, maxMinutesOverall); updateFilterInfoLabel(dataStartDate, dataEndDate);
    selectedStartDate = dataStartDate; selectedEndDate = dataEndDate; // Set initial selection
    if (!multiYear) { console.log("Drawing handles for single year view."); drawHandles(selectedStartDate, selectedEndDate); }
    else { console.log("Multi-year view: Handles disabled."); svgInstance?.selectAll(".start-handle-group, .end-handle-group, .highlight-rect").remove(); }
    updateHighlightRect();
}

// Drag Handle Drawing & Events (Only drawn/used in single-year plot mode)
function drawHandles(startDate, endDate) {
    if (!svgInstance || !calendarStartDay || !startDate || !endDate || isNaN(startDate) || isNaN(endDate) || currentCalendarHeight <= 0) return;
    const startX = getXFromDate(startDate, calendarStartDay, cellWidthWithPadding);
    const endHandleDateForPositioning = d3.timeDay.offset(endDate, 1); const safeEndPosDate = endHandleDateForPositioning <= startDate ? d3.timeDay.offset(startDate, 1) : endHandleDateForPositioning;
    let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding); if (isNaN(endX)) endX = getXFromDate(endDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
    endX = Math.max(endX, startX + handleWidth); if (isNaN(startX) || isNaN(endX)) { console.error("drawHandles: NaN X position!", { startX, endX }); return; }
    const yearGroup = svgInstance.select(`.year-group.year-${startDate.getFullYear()}`); if (yearGroup.empty()) { console.error("Cannot find year group to draw handles."); return; }
    const handleBaseY = topPadding + yearLabelPadding;
    let startHandleGroup = yearGroup.select(".start-handle-group");
    if (startHandleGroup.empty()) {
        startHandleGroup = yearGroup.append("g").attr("class", "start-handle-group");
        startHandleGroup.append("line").attr("class", "drag-handle start-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round");
        startHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize");
    }
    startHandleGroup.attr("transform", `translate(${startX}, ${handleBaseY})`).selectAll("line").attr("y2", currentCalendarHeight + cellPadding);
    startHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "start")).on("end", handleDragEnd));
    let endHandleGroup = yearGroup.select(".end-handle-group");
     if (endHandleGroup.empty()) {
        endHandleGroup = yearGroup.append("g").attr("class", "end-handle-group");
        endHandleGroup.append("line").attr("class", "drag-handle end-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round");
        endHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize");
     }
     endHandleGroup.attr("transform", `translate(${endX}, ${handleBaseY})`).selectAll("line").attr("y2", currentCalendarHeight + cellPadding);
     endHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "end")).on("end", handleDragEnd));
     updateHighlightRect();
}
function handleDragStart(event) {
    if (!svgInstance) return; d3.select(this).raise().select(".drag-handle").attr("stroke", "black").attr("stroke-opacity", 0.7);
    const year = selectedStartDate.getFullYear(); svgInstance.select(`.year-group.year-${year} .highlight-rect`)?.raise(); svgInstance.selectAll(".start-handle-group, .end-handle-group").raise();
}
function handleDrag(event, handleType) {
    if (!svgInstance || !calendarStartDay || allDaysInCalendar.length === 0 || !selectedStartDate || !selectedEndDate || currentCalendarHeight <= 0) return;
    const currentX = event.x; let targetDate = getDateFromX(currentX, allDaysInCalendar, calendarStartDay, cellWidthWithPadding); if (!targetDate || isNaN(targetDate)) return;
    const minDate = allDaysInCalendar[0]; const maxDate = allDaysInCalendar[allDaysInCalendar.length - 1]; if (targetDate < minDate) targetDate = minDate; if (targetDate > maxDate) targetDate = maxDate;
    let snappedX; let newStartDate = selectedStartDate; let newEndDate = selectedEndDate; let groupToMove; const yearGroup = svgInstance.select(`.year-group.year-${selectedStartDate.getFullYear()}`); if (yearGroup.empty()) return; const handleBaseY = topPadding + yearLabelPadding;
    if (handleType === "start") { targetDate = d3.min([targetDate, selectedEndDate]); newStartDate = targetDate; snappedX = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding); groupToMove = yearGroup.select(".start-handle-group"); if (!isNaN(snappedX)) groupToMove.attr("transform", `translate(${snappedX}, ${handleBaseY})`); else console.error("handleDrag (Start): Invalid snappedX."); }
    else { targetDate = d3.max([targetDate, selectedStartDate]); newEndDate = targetDate; const endHandleDateForPositioning = d3.timeDay.offset(newEndDate, 1); const safeEndPosDate = endHandleDateForPositioning <= newStartDate ? d3.timeDay.offset(newStartDate, 1) : endHandleDateForPositioning; snappedX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding); if (isNaN(snappedX)) snappedX = getXFromDate(newEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding; const startXForCompare = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding); if (!isNaN(startXForCompare) && !isNaN(snappedX)) snappedX = Math.max(snappedX, startXForCompare + handleWidth); else if(isNaN(snappedX)) return; groupToMove = yearGroup.select(".end-handle-group"); if (!isNaN(snappedX)) groupToMove.attr("transform", `translate(${snappedX}, ${handleBaseY})`); else console.error("handleDrag (End): Invalid snappedX."); }
    selectedStartDate = newStartDate; selectedEndDate = newEndDate; updateHighlightRect(); updateFilterInfoLabel(selectedStartDate, selectedEndDate);
}
function handleDragEnd(event) {
    if (svgInstance) { d3.select(this).select(".drag-handle").attr("stroke", handleColor).attr("stroke-opacity", 1.0); }
    if (startDateInput && selectedStartDate) startDateInput.value = formatDateForInput(selectedStartDate); if (endDateInput && selectedEndDate) endDateInput.value = formatDateForInput(selectedEndDate);
    filterDataAndUpdateCharts(selectedStartDate, selectedEndDate);
}
function updateHighlightRect() {
    if (!svgInstance || !selectedStartDate || !selectedEndDate || !calendarStartDay || isNaN(selectedStartDate) || isNaN(selectedEndDate) || currentCalendarHeight <= 0) { svgInstance?.selectAll(".highlight-rect").remove(); return; }
    const year = selectedStartDate.getFullYear(); const yearGroup = svgInstance.select(`.year-group.year-${year}`); if (yearGroup.empty()) { svgInstance?.selectAll(".highlight-rect").remove(); return; }
    const gridOffsetY = topPadding + yearLabelPadding; let highlightRect = yearGroup.select(".highlight-rect"); if (highlightRect.empty()) { highlightRect = yearGroup.insert("rect", ":first-child").attr("class", "highlight-rect").attr("fill", highlightColor).attr("pointer-events", "none"); }
    const startX = getXFromDate(selectedStartDate, calendarStartDay, cellWidthWithPadding); const endHandleDateForPositioning = d3.timeDay.offset(selectedEndDate, 1); const safeEndPosDate = endHandleDateForPositioning <= selectedStartDate ? d3.timeDay.offset(selectedStartDate, 1) : endHandleDateForPositioning;
    let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding); if (isNaN(endX)) endX = getXFromDate(selectedEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding; endX = Math.max(endX, startX); if (isNaN(startX) || isNaN(endX)) { highlightRect.remove(); return; }
    highlightRect.attr("x", startX).attr("y", gridOffsetY).attr("width", Math.max(0, endX - startX)).attr("height", currentCalendarHeight);
}
function drawLegend(container, scale, maxValue) {
     container.innerHTML = ""; if (maxValue === undefined) return;
    const legendWidth = 200, legendHeight = 20, legendMargin = { top: 0, right: 10, bottom: 15, left: 10 }, barHeight = 8;
    const legendSvg = d3.select(container).append("svg").attr("width", legendWidth).attr("height", legendHeight + legendMargin.top + legendMargin.bottom); const legendDefs = legendSvg.append("defs"); const linearGradient = legendDefs.append("linearGradient").attr("id", "calendar-gradient"); const numStops = 10;
    const interpolator = (maxValue <= 0 || typeof scale.interpolator !== 'function') ? (() => noDataColor) : scale.interpolator();
    linearGradient.selectAll("stop").data(d3.range(numStops + 1)).enter().append("stop").attr("offset", d => `${(d / numStops) * 100}%`).attr("stop-color", d => interpolator(d / numStops));
    legendSvg.append("rect").attr("x", legendMargin.left).attr("y", legendMargin.top).attr("width", legendWidth - legendMargin.left - legendMargin.right).attr("height", barHeight).style("fill", maxValue <= 0 ? noDataColor : "url(#calendar-gradient)").attr("rx", 2).attr("ry", 2);
    legendSvg.append("text").attr("class", "legend-label").attr("x", legendMargin.left).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "start").text("Less"); legendSvg.append("text").attr("class", "legend-label").attr("x", legendWidth - legendMargin.right).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "end").text("More");
}

// Top Artists Bar Chart
function updateTopArtistsChart(data) {
    const containerId = 'top-artists-chart'; const container = document.getElementById(containerId); if (!container) return; container.innerHTML = "";
    if (!data || data.length === 0) { container.innerHTML = `<p class="empty-message">No artist data.</p>`; return; }
    const artistData = d3.rollups(data.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.artist).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (artistData.length === 0) { container.innerHTML = `<p class="empty-message">No artist data.</p>`; return; }
    const margin = topListChartMargin; const calculatedHeight = artistData.length * (barHeight + 5) + margin.top + margin.bottom; const containerWidth = container.clientWidth > 0 ? container.clientWidth : 300; const width = containerWidth - margin.left - margin.right; const height = calculatedHeight - margin.top - margin.bottom; if (width <= 0 || height <= 0) { container.innerHTML = '<p class="error-message">Container too small.</p>'; return; }
    const svg = d3.select(container).append("svg").attr("width", containerWidth).attr("height", calculatedHeight).append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    const yScale = d3.scaleBand().domain(artistData.map(d => d[0])).range([0, height]).padding(0.2); const maxTime = d3.max(artistData, d => d[1]); const xScale = d3.scaleLinear().domain([0, maxTime || 1]).range([0, width]).nice(); const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);
    svg.append("g").attr("class", "axis axis--y artist-axis").call(yAxis).selectAll(".tick text").text(d => truncateText(d, 18)).append("title").text(d => d); svg.selectAll(".axis--y path.domain").remove();
    svg.selectAll(".bar").data(artistData).join("rect").attr("class", "bar artist-bar").attr("y", d => yScale(d[0])).attr("height", yScale.bandwidth()).attr("x", 0).attr("fill", "#1DB954").attr("width", 0).on("mouseover", (event, d) => showTooltip(event, `<b>${d[0]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("width", d => Math.max(0, xScale(d[1])));
    svg.selectAll(".bar-label").data(artistData).join("text").attr("class", "bar-label").attr("x", d => xScale(d[1]) + 5).attr("y", d => yScale(d[0]) + yScale.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "start").style("font-size", "10px").style("fill", "#333").style("opacity", 0).text(d => formatTime(d[1])).transition().duration(500).delay(250).style("opacity", 1);
}

// Top Tracks Bar Chart
function updateTopTracksChart(data) {
    const containerId = 'top-tracks-chart'; const container = document.getElementById(containerId); if (!container) return; container.innerHTML = "";
    if (!requiredColumns.track_name) { container.innerHTML = `<p class="error-message">Track data missing.</p>`; return; } if (!data || data.length === 0) { container.innerHTML = `<p class="empty-message">No track data.</p>`; return; }
    const trackData = d3.rollups( data.filter(d => d.track && d.track !== "Unknown Track" && d.track !== "N/A" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => `${d.track} • ${d.artist}` ).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (trackData.length === 0) { container.innerHTML = `<p class="empty-message">No track data.</p>`; return; }
    const getTrackArtist = (key) => { const parts = key.split('•'); return { track: parts[0]?.trim() || 'Unknown Track', artist: parts[1]?.trim() || 'Unknown Artist' }; };
    const margin = topListChartMargin; const calculatedHeight = trackData.length * (barHeight + 15) + margin.top + margin.bottom; const containerWidth = container.clientWidth > 0 ? container.clientWidth : 300; const width = containerWidth - margin.left - margin.right; const height = calculatedHeight - margin.top - margin.bottom; if (width <= 0 || height <= 0) { container.innerHTML = '<p class="error-message">Container too small.</p>'; return; }
    const svg = d3.select(container).append("svg").attr("width", containerWidth).attr("height", calculatedHeight).append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    const yScale = d3.scaleBand().domain(trackData.map(d => d[0])).range([0, height]).padding(0.25); const maxTime = d3.max(trackData, d => d[1]); const xScale = d3.scaleLinear().domain([0, maxTime || 1]).range([0, width]).nice(); const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);
    svg.append("g").attr("class", "axis axis--y track-axis").call(yAxis).selectAll(".tick").selectAll("text").remove();
    svg.selectAll(".axis--y .tick").append("text").attr("x", -10).attr("dy", "-0.1em").attr("text-anchor", "end").each(function(d) { const { track, artist } = getTrackArtist(d); const truncatedTrack = truncateText(track, 18); const truncatedArtist = truncateText(artist, 20); d3.select(this).append("tspan").attr("class", "axis-label-track").attr("x", -10).attr("dy", "0em").text(truncatedTrack).append("title").text(track); d3.select(this).append("tspan").attr("class", "axis-label-artist").style("font-size", "0.8em").style("fill", "#666").attr("x", -10).attr("dy", "1.2em").text(truncatedArtist).append("title").text(artist); });
    svg.selectAll(".axis--y path.domain").remove();
    svg.selectAll(".bar").data(trackData).join("rect").attr("class", "bar track-bar").attr("y", d => yScale(d[0])).attr("height", yScale.bandwidth()).attr("x", 0).attr("fill", "#6f42c1").attr("width", 0).on("mouseover", (event, d) => { const { track, artist } = getTrackArtist(d[0]); showTooltip(event, `<b>${track}</b><br>${artist}<br>${formatTime(d[1])}`) }).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("width", d => Math.max(0, xScale(d[1])));
    svg.selectAll(".bar-label").data(trackData).join("text").attr("class", "bar-label").attr("x", d => xScale(d[1]) + 5).attr("y", d => yScale(d[0]) + yScale.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "start").style("font-size", "10px").style("fill", "#333").style("opacity", 0).text(d => formatTime(d[1])).transition().duration(500).delay(250).style("opacity", 1);
}

// Other Chart Functions (Time of Day, Day of Week, Streamgraph)
function updateTimeOfDayChart(data) { /* ... implementation ... */
    const targetDiv = document.getElementById('time-of-day-chart'); if (!targetDiv) return; targetDiv.innerHTML = ""; if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
    const hourData = d3.rollups(data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getHours()); const hourMap = new Map(hourData); const completeHourData = d3.range(24).map(h => [h, hourMap.get(h) || 0]);
    const containerWidth = targetDiv.parentElement?.clientWidth || 400; const chartWidth = containerWidth > 0 ? containerWidth : 400; const chartHeight = 250; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom; if (width <= 0 || height <= 0) { targetDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; }
    const svg = d3.select(targetDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);
    const x = d3.scaleBand().range([0, width]).domain(d3.range(24)).padding(0.2); const y = d3.scaleLinear().domain([0, d3.max(completeHourData, d => d[1]) || 1]).range([height, 0]).nice();
    svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickValues(d3.range(0, 24, 3))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("text-anchor", "middle").text("Hour of Day");
    svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Total Listening Time");
    svg.selectAll(".bar").data(completeHourData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#fd7e14").on("mouseover", (event, d) => showTooltip(event, `<b>Hour ${d[0]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1])));
}
function updateDayOfWeekChart(data) { /* ... implementation ... */
    const targetDiv = document.getElementById('day-of-week-chart'); if (!targetDiv) return; targetDiv.innerHTML = ""; if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
    const dayData = d3.rollups(data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getDay()); const dayMap = new Map(dayData); const completeDayData = d3.range(7).map(dayIndex => [dayIndex, dayMap.get(dayIndex) || 0]);
    const containerWidth = targetDiv.parentElement?.clientWidth || 400; const chartWidth = containerWidth > 0 ? containerWidth : 400; const chartHeight = 250; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom; if (width <= 0 || height <= 0) { targetDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; }
    const svg = d3.select(targetDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);
    const x = d3.scaleBand().range([0, width]).domain(d3.range(7)).padding(0.2); const y = d3.scaleLinear().domain([0, d3.max(completeDayData, d => d[1]) || 1]).range([height, 0]).nice();
    svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickFormat(d => dayOfWeekNames[d])).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("text-anchor", "middle").text("Day of Week");
    svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Total Listening Time");
    svg.selectAll(".bar").data(completeDayData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#6f42c1").on("mouseover", (event, d) => showTooltip(event, `<b>${dayOfWeekNames[d[0]]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1])));
}
async function drawStreamgraph(filteredData, containerId) { /* ... implementation ... */
    const container = document.getElementById(containerId); if (!container) return; container.innerHTML = ""; if (!filteredData || filteredData.length === 0) { container.innerHTML = '<p class="empty-message">No data.</p>'; return; }
    const streamDataProcessed = filteredData.map(d => { let contentType = 'Music'; if (d.episode_name && String(d.episode_name).trim() !== "") contentType = 'Podcast'; return { ...d, contentType: contentType }; }).filter(d => d.ms_played > 0); if (streamDataProcessed.length === 0) { container.innerHTML = '<p class="empty-message">No Music/Podcast data.</p>'; return; }
    const contentTypes = ['Music', 'Podcast']; const [minDate, maxDate] = d3.extent(streamDataProcessed, d => d.ts); const timeDiffDays = (maxDate && minDate) ? (maxDate - minDate) / (1000*60*60*24) : 0; const timeAggregator = timeDiffDays > 60 ? d3.timeDay.floor : d3.timeHour.floor; const timeFormatString = timeDiffDays > 60 ? "%Y-%m-%d" : "%H:%M %a %d"; const aggregatedData = Array.from( d3.group(streamDataProcessed, d => timeAggregator(d.ts)), ([timeBin, values]) => { const entry = { timeBin: new Date(timeBin) }; let totalMsPlayedInBin = 0; contentTypes.forEach(type => entry[type] = 0); values.forEach(v => { if (entry.hasOwnProperty(v.contentType)) { entry[v.contentType] += v.ms_played; totalMsPlayedInBin += v.ms_played; } }); entry.totalMinutes = totalMsPlayedInBin / 60000; contentTypes.forEach(type => { entry[type] = (totalMsPlayedInBin > 0) ? (entry[type] / totalMsPlayedInBin) : 0; }); return entry; }).sort((a, b) => a.timeBin - b.timeBin); if (aggregatedData.length === 0) { container.innerHTML = '<p class="empty-message">No aggregated data.</p>'; return; }
    const margin = { top: 20, right: 30, bottom: 40, left: 50 }; const containerWidth = container.clientWidth || 800; const height = 300 - margin.top - margin.bottom; const width = containerWidth - margin.left - margin.right; if (width <= 0 || height <= 0) { container.innerHTML = `<p class="error-message">Container too small.</p>`; return; }
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    const xScale = d3.scaleTime().domain(d3.extent(aggregatedData, d => d.timeBin)).range([0, width]); const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]); const colorMap = { 'Music': '#1DB954', 'Podcast': '#6f42c1' }; const colorScale = d3.scaleOrdinal().domain(contentTypes).range(contentTypes.map(type => colorMap[type])); const stack = d3.stack().keys(contentTypes).offset(d3.stackOffsetNone).order(d3.stackOrderInsideOut); let series; try { series = stack(aggregatedData); } catch (error) { console.error("Streamgraph stacking error:", error); container.innerHTML = '<p class="error-message">Stacking error.</p>'; return; } if (series.length === 0 || !series[0] || series[0].length === 0) { container.innerHTML = '<p class="empty-message">No stack layers.</p>'; return; }
    const areaGen = d3.area().x(d => xScale(d.data.timeBin)).y0(d => yScale(d[0])).y1(d => yScale(d[1])).curve(d3.curveBasis); svg.selectAll(".stream-layer").data(series).enter().append("path").attr("class", d => `stream-layer ${String(d.key).toLowerCase()}-layer`).attr("d", areaGen).attr("fill", d => colorScale(d.key)).attr("stroke", "#fff").attr("stroke-width", 0.5).on("mouseover", (event, d_layer) => { /* ... */ }).on("mousemove", moveTooltip).on("mouseout", (event, d) => { /* ... */ });
    let xAxisTicks; if (timeDiffDays <= 2) xAxisTicks = d3.timeHour.every(6); else if (timeDiffDays <= 14) xAxisTicks = d3.timeDay.every(1); else if (timeDiffDays <= 90) xAxisTicks = d3.timeWeek.every(1); else xAxisTicks = d3.timeMonth.every(1); svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale).ticks(xAxisTicks).tickFormat(d3.timeFormat(timeDiffDays > 30 ? "%b %Y" : "%a %d"))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", margin.bottom - 10).attr("text-anchor", "middle").text("Date / Time"); const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".0%")); svg.append("g").attr("class", "axis axis--y").call(yAxis).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - margin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Listening Time Rate (%)"); const legendContainer = svg.append("g").attr("class", "streamgraph-legend").attr("transform", `translate(${width - 100}, ${-10})`); const legendItems = legendContainer.selectAll(".legend-item").data(contentTypes).enter().append("g").attr("class", "legend-item").attr("transform", (d, i) => `translate(0, ${i * 15})`); legendItems.append("rect").attr("x", 0).attr("y", 0).attr("width", 10).attr("height", 10).attr("fill", d => colorScale(d)); legendItems.append("text").attr("x", 15).attr("y", 5).attr("dy", "0.35em").style("font-size", "10px").text(d => d); const descEl = container.nextElementSibling; if (descEl && descEl.classList.contains('chart-description')) descEl.innerHTML = "Proportional listening rate (%)";
}

// --- Force Graph Function (Renamed from drawForceGraph3) ---
async function drawForceGraph2(filteredData, containerId, topN = currentForceGraphTopN) {
    const container = document.getElementById(containerId); if (!container) return; container.innerHTML = "";
    if (forceGraphSliderValueSpan) forceGraphSliderValueSpan.textContent = topN;

    if (!filteredData || filteredData.length < 2) { /* ... */ container.innerHTML = '<p class="empty-message">Not enough data.</p>'; return; }
    const musicData = filteredData.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0).sort((a, b) => a.ts - b.ts);
    if (musicData.length < 2) { /* ... */ container.innerHTML = '<p class="empty-message">Not enough music plays.</p>'; return; }

    const artistCounts = d3.rollup(musicData, v => v.length, d => d.artist);
    const topArtistsMap = new Map(Array.from(artistCounts.entries()).sort(([, countA], [, countB]) => countB - countA).slice(0, topN));
    if (topArtistsMap.size < 2) { /* ... */ container.innerHTML = `<p class="empty-message">Fewer than 2 top artists found (showing ${topArtistsMap.size}).</p>`; return; }

    const transitions = new Map();
    for (let i = 0; i < musicData.length - 1; i++) { const sourceArtist = musicData[i].artist; const targetArtist = musicData[i + 1].artist; if (topArtistsMap.has(sourceArtist) && topArtistsMap.has(targetArtist) && sourceArtist !== targetArtist) { const key = `${sourceArtist}:::${targetArtist}`; transitions.set(key, (transitions.get(key) || 0) + 1); } }
    if (transitions.size === 0) { /* ... */ container.innerHTML = '<p class="empty-message">No transitions between top artists.</p>'; return; }

    const nodes = Array.from(topArtistsMap.keys()).map(artist => ({ id: artist, playCount: topArtistsMap.get(artist) || 0 }));
    const links = Array.from(transitions.entries()).map(([key, count]) => { const [source, target] = key.split(":::"); return { source: source, target: target, value: count }; });

    // --- Chart Setup ---
    const margin = { top: 10, right: 10, bottom: 10, left: 10 }; const containerWidth = container.clientWidth || 600; const containerHeight = 400; const width = containerWidth - margin.left - margin.right; const height = containerHeight - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) { /* ... */ container.innerHTML = '<p class="error-message">Container too small.</p>'; return; }
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`).attr("preserveAspectRatio", "xMinYMid meet").style("max-width", "100%").style("height", "auto");
    const mainGroup = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`); const zoomableGroup = mainGroup.append("g");
    mainGroup.append("rect").attr("width", width).attr("height", height).attr("fill", "none").attr("pointer-events", "all");
    zoomableGroup.append("defs").append("marker").attr("id", "arrowhead").attr("viewBox", "-0 -5 10 10").attr("refX", 15).attr("refY", 0).attr("orient", "auto").attr("markerWidth", 6).attr("markerHeight", 6).attr("xoverflow", "visible").append("svg:path").attr("d", "M 0,-5 L 10 ,0 L 0,5").attr("fill", "#999").style("stroke", "none");

    // --- Scales ---
    const minRadius = 5, maxRadius = 15; const playCountExtent = d3.extent(nodes, d => d.playCount); const nodeRadiusScale = d3.scaleSqrt().domain([playCountExtent[0] || 0, playCountExtent[1] || 1]).range([minRadius, maxRadius]);
    const nodeColorScale = d3.scaleSequential(d3.interpolateViridis).domain([playCountExtent[1] || 1, 0]);
    const maxStrokeWidth = 6; const linkWidthScale = d3.scaleLinear().domain([0, d3.max(links, d => d.value) || 1]).range([1, maxStrokeWidth]);

    // --- Simulation ---
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(90).strength(link => 1 / Math.min(link.source.playCount || 1, link.target.playCount || 1)))
        .force("charge", d3.forceManyBody().strength(-180))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => nodeRadiusScale(d.playCount) + 6).strength(0.8));

    const linkedByIndex = {}; links.forEach(d => { linkedByIndex[`${d.source.id || d.source},${d.target.id || d.target}`] = 1; });
    function areNeighbors(a, b) { return linkedByIndex[`${a.id},${b.id}`] || linkedByIndex[`${b.id},${a.id}`] || a.id === b.id; }

    // --- Draw Elements ---
    const link = zoomableGroup.append("g").attr("class", "force-links").attr("stroke", "#999").attr("stroke-opacity", 0.5).selectAll("line").data(links).join("line").attr("stroke-width", d => linkWidthScale(d.value)).attr("marker-end", "url(#arrowhead)");
    link.append("title").text(d => `${d.source.id || d.source} → ${d.target.id || d.target}\n${d.value} transitions`);
    const node = zoomableGroup.append("g").attr("class", "force-nodes").attr("stroke", "#fff").attr("stroke-width", 1.5).selectAll("circle").data(nodes).join("circle").attr("r", d => nodeRadiusScale(d.playCount)).attr("fill", d => nodeColorScale(d.playCount)).call(drag(simulation));
    node.append("title").text(d => `${d.id}\n${d.playCount} plays`);
    const labels = zoomableGroup.append("g").attr("class", "force-labels").attr("font-family", "sans-serif").attr("font-size", 10).attr("fill", "#333").attr("stroke", "white").attr("stroke-width", 0.3).attr("paint-order", "stroke").attr("pointer-events", "none").selectAll("text").data(nodes).join("text").attr("dx", d => nodeRadiusScale(d.playCount) + 4).attr("dy", "0.35em").text(d => d.id);

    // --- Interaction ---
    node.on("mouseover", highlight).on("mouseout", unhighlight); link.on("mouseover", highlightLink).on("mouseout", unhighlightLink);
    function highlight(event, d_hovered) { /* ... highlight logic ... */
        const opacity = 0.15; node.style("opacity", n => areNeighbors(d_hovered, n) ? 1 : opacity); node.style("stroke", n => n === d_hovered ? 'black' : '#fff'); node.style("stroke-width", n => n === d_hovered ? 2.5 : 1.5);
        link.style("stroke-opacity", l => (l.source === d_hovered || l.target === d_hovered) ? 0.9 : opacity * 0.5); link.filter(l => (l.source === d_hovered || l.target === d_hovered)).select("path").style("fill", "#555"); // Find better way if needed
        labels.style("opacity", n => areNeighbors(d_hovered, n) ? 1 : opacity);
     }
    function unhighlight() { /* ... unhighlight logic ... */
        node.style("opacity", 1).style("stroke", '#fff').style("stroke-width", 1.5); link.style("stroke-opacity", 0.5); link.select("path").style("fill", "#999"); labels.style("opacity", 1);
     }
    function highlightLink(event, d_hovered) { /* ... */ } function unhighlightLink(event, d_hovered) { /* ... */ }

    simulation.on("tick", () => { link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y); node.attr("cx", d => d.x).attr("cy", d => d.y); labels.attr("x", d => d.x).attr("y", d => d.y); });
    function zoomed(event) { zoomableGroup.attr("transform", event.transform); }
    const zoom = d3.zoom().scaleExtent([0.2, 8]).extent([[0, 0], [width, height]]).translateExtent([[0, 0], [width, height]]).on("zoom", zoomed);
    svg.call(zoom); svg.on("dblclick.zoom", null);
    function drag(simulation) { /* ... drag implementation ... */
        function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; d3.select(this).raise(); }
        function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
        function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); if (!event.sourceEvent || !event.sourceEvent.type.includes('zoom')) { d.fx = null; d.fy = null; } if (d3.select(this).style("opacity") == 1) { highlight(event, d); } }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
     }

    const descEl = container.nextElementSibling; // Update description
    if (descEl && descEl.classList.contains('chart-description')) {
        descEl.innerHTML = `Transitions between top ${nodes.length} artists (max ${topN} selected).`;
    }
}

// --- Main Update Trigger ---
function handleBrushUpdate(filteredChartData) {
    const dataToUpdate = filteredChartData || [];
    updateTopArtistsChart(dataToUpdate);
    updateTopTracksChart(dataToUpdate);
    updateTimeOfDayChart(dataToUpdate);
    updateDayOfWeekChart(dataToUpdate);
    drawStreamgraph(dataToUpdate, 'streamgraph-chart');
    // Call the RENAMED force graph function
    drawForceGraph2(dataToUpdate, 'force-graph-chart', currentForceGraphTopN);
}

// --- Core Visualization Update Function ---
function updateVisualization(filteredData) {
    const chartsToClear = [ topArtistsContainer, topTracksContainer, timeOfDayDiv, dayOfWeekDiv, document.getElementById('streamgraph-chart'), document.getElementById('force-graph-chart') ];
    if (calendarDiv) calendarDiv.innerHTML = ""; if (legendDiv) legendDiv.innerHTML = "";
    selectedStartDate = null; selectedEndDate = null; currentViewData = filteredData || [];

    if (!filteredData || filteredData.length === 0) { /* ... error handling ... */ return; }
    const [viewStartDate, viewEndDate] = d3.extent(filteredData, d => d.ts);
    if (!viewStartDate || !viewEndDate || isNaN(viewStartDate) || isNaN(viewEndDate)) { /* ... error handling ... */ return; }

    const multiYearView = viewStartDate.getFullYear() !== viewEndDate.getFullYear();
    console.log(`Rendering Plot Mode (${multiYearView ? 'Multi-Year' : 'Single-Year'})`);

    // Draw calendar (use the final version - RENAMED from drawCalendar3)
    drawCalendar2(filteredData, viewStartDate, viewEndDate); // RENAMED

    // Update dependent charts
    if (multiYearView) { handleBrushUpdate(filteredData); updateFilterInfoLabel(viewStartDate, viewEndDate); }
    else { filterDataAndUpdateCharts(viewStartDate, viewEndDate); }
}

// --- Filter Data and Update Dependent Charts (Plot Mode Only) ---
function filterDataAndUpdateCharts(startDate, endDate) {
    const validStartDate = (startDate instanceof Date && !isNaN(startDate)) ? startDate : selectedStartDate;
    const validEndDate = (endDate instanceof Date && !isNaN(endDate)) ? endDate : selectedEndDate;
    if (!validStartDate || !validEndDate || !currentViewData || isNaN(validStartDate) || isNaN(validEndDate) || validStartDate > validEndDate) { /*...*/ handleBrushUpdate([]); return; }
    const filterStart = d3.timeDay.floor(validStartDate); const filterEnd = d3.timeDay.offset(d3.timeDay.floor(validEndDate), 1);
    const filtered = currentViewData.filter(d => { const dDate = d.ts; return dDate instanceof Date && !isNaN(dDate) && dDate >= filterStart && dDate < filterEnd; });
    console.log(`Filtered plot data: ${filtered.length} records.`);
    updateFilterInfoLabel(validStartDate, validEndDate);
    handleBrushUpdate(filtered); // Update plots with the filtered selection
}

// --- Event Listeners ---
if (wrappedYearSelect) {
    wrappedYearSelect.onchange = () => { /* ... implementation ... */
        const selectedYearValue = wrappedYearSelect.value; if (!selectedYearValue) return; const selectedYear = +selectedYearValue; if (!selectedYear || isNaN(selectedYear)) { updateVisualization([]); return; }
        const yearStart = new Date(selectedYear, 0, 1); const yearEndFilter = new Date(selectedYear + 1, 0, 1); const filteredByYear = allParsedData.filter(d => d.ts >= yearStart && d.ts < yearEndFilter);
        if (startDateInput) startDateInput.value = formatDateForInput(yearStart); if (endDateInput) endDateInput.value = formatDateForInput(new Date(selectedYear, 11, 31));
        updateVisualization(filteredByYear);
     };
} else { console.error("#wrappedYearSelect not found."); }

if (applyRangeBtn) {
    applyRangeBtn.onclick = () => { /* ... implementation ... */
        const startStr = startDateInput.value; const endStr = endDateInput.value; let start = !isNaN(Date.parse(startStr)) ? d3.timeDay.floor(new Date(startStr)) : null; let end = !isNaN(Date.parse(endStr)) ? d3.timeDay.floor(new Date(endStr)) : null;
        if (!start || !end) { alert("Invalid date format."); return; } if (start > end) { [start, end] = [end, start]; startDateInput.value = formatDateForInput(start); endDateInput.value = formatDateForInput(end); }
        const filterEnd = d3.timeDay.offset(end, 1); if (wrappedYearSelect) wrappedYearSelect.value = "";
        const filteredByRange = allParsedData.filter(d => d.ts >= start && d.ts < filterEnd);
        updateVisualization(filteredByRange);
     };
} else { console.error("#applyRangeBtn not found."); }

// --- Slider Event Listener ---
if (forceGraphSlider && forceGraphSliderValueSpan) {
    forceGraphSlider.addEventListener('input', () => { forceGraphSliderValueSpan.textContent = forceGraphSlider.value; });
    forceGraphSlider.addEventListener('change', () => {
        currentForceGraphTopN = +forceGraphSlider.value; forceGraphSliderValueSpan.textContent = currentForceGraphTopN;
        console.log(`Force Graph TopN changed to: ${currentForceGraphTopN}`);
        // Trigger update using the currently viewed data
        handleBrushUpdate(currentViewData);
    });
} else { console.error("Force graph slider elements not found."); }

// ============================================== //
// === END OF spotifyDashboard.js ============ //
// ============================================== //