// --- Configuration ---
const cellSize = 15;
const cellPadding = 1.5;
const leftPadding = 40;
const topPadding = 25;
const noDataColor = "#ebedf0";
const calendarColorScale = d3.scaleSequential(d3.interpolateBlues);
const chartMargin = { top: 20, right: 20, bottom: 60, left: 50 };

// --- Handle Configuration ---
const handleWidth = 3;
const handleColor = "#e63946";
const handleGrabAreaWidth = 10;
const highlightColor = "rgba(108, 117, 125, 0.2)";

// --- DOM Elements ---
const yearSelect = document.getElementById('yearSelect');
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
const formatMonth = d3.timeFormat("%b");
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
    reason_start: false, reason_end: false, artist: false, album: false, // Added artist/album check keys
    conn_country: false, shuffle: false
};
let currentViewData = [];
let selectedStartDate = null;
let selectedEndDate = null;
let svgInstance = null;
let allDaysInCalendar = [];
let calendarStartDay = null;
let cellWidthWithPadding = cellSize + cellPadding;
let currentCalendarHeight = 0;

// --- Data Processing (Runs once) ---
(async function loadData() {
    try {
        const rawData = await d3.csv("data/spotify_listening_history.csv");

        const columns = new Set(rawData.columns);
        // Map JS keys to potential CSV column names more carefully
        const columnMapping = {
            track_name: 'master_metadata_track_name',
            artist: 'master_metadata_album_artist_name',
            album: 'master_metadata_album_album_name',
            platform: 'platform',
            skipped: 'skipped',
            shuffle: 'shuffle',
            episode_name: 'episode_name',
            episode_show_name: 'episode_show_name',
            audiobook_title: 'audiobook_title',
            audiobook_chapter_title: 'audiobook_chapter_title',
            reason_start: 'reason_start',
            reason_end: 'reason_end',
            conn_country: 'conn_country'
        };

        Object.keys(columnMapping).forEach(key => {
            requiredColumns[key] = columns.has(columnMapping[key]);
        });

        allParsedData = rawData.map(d => ({
            ts: new Date(d.ts),
            ms_played: +d.ms_played,
            platform: d.platform,
            conn_country: d.conn_country,
            artist: d.master_metadata_album_artist_name || "Unknown Artist",
            track: requiredColumns.track_name ? (d.master_metadata_track_name || "Unknown Track") : "N/A",
            album: d.master_metadata_album_album_name,
            episode_name: d.episode_name,
            episode_show_name: d.episode_show_name,
            audiobook_title: d.audiobook_title,
            audiobook_chapter_title: d.audiobook_chapter_title,
            skipped: ['true', '1', true].includes(String(d.skipped).toLowerCase()),
            shuffle: ['true', '1', true].includes(String(d.shuffle).toLowerCase()),
            reason_start: d.reason_start,
            reason_end: d.reason_end,
        })).filter(d =>
            d.ts instanceof Date && !isNaN(d.ts) &&
            typeof d.ms_played === 'number' && !isNaN(d.ms_played) && d.ms_played >= 0
        );

        console.log(`Loaded and parsed ${allParsedData.length} valid records.`);
        if (allParsedData.length === 0) {
            calendarDiv.innerHTML = `<p class="error-message">No valid data found.</p>`;
            if (filterInfoSpan) filterInfoSpan.textContent = 'No data loaded';
            return;
        }

        const years = [...new Set(allParsedData.map(d => d.ts.getFullYear()))].sort((a, b) => a - b);
        years.forEach(y => {
            const opt = document.createElement('option'); opt.value = y; opt.textContent = y; yearSelect.appendChild(opt);
        });

        // --- Initial Load ---
        const defaultYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
        yearSelect.value = defaultYear;
        yearSelect.dispatchEvent(new Event('change')); // Trigger initial load for calendar etc.

        // --- DRAW NON-MAIN-VIEW CHARTS (Initially with full data) ---
        // These are not linked to the calendar filter by default
        console.log("Drawing initial Timeline and Sankey...");
        drawTimeline(allParsedData, 'timeline-chart');
        drawSankey(allParsedData, 'sankey-chart', 10);

    } catch (error) {
        console.error("Error loading or processing data:", error);
        calendarDiv.innerHTML = `<p class="error-message">Error loading data. Check console.</p>`;
        if (filterInfoSpan) filterInfoSpan.textContent = 'Error loading data';

        // === CORRECTED ERROR HANDLING FOR OTHER CHARTS ===
        const timelineChartDiv = document.getElementById('timeline-chart');
        if (timelineChartDiv) {
            timelineChartDiv.innerHTML = `<p class="error-message">Error loading data.</p>`;
        }
        const streamgraphChartDiv = document.getElementById('streamgraph-chart');
        if (streamgraphChartDiv) {
             streamgraphChartDiv.innerHTML = `<p class="error-message">Error loading data.</p>`;
        }
        const sankeyChartDiv = document.getElementById('sankey-chart');
        if (sankeyChartDiv) {
             sankeyChartDiv.innerHTML = `<p class="error-message">Error loading data.</p>`;
        }
        // ==================================================

    }
})(); // Immediately invoke the async function


// --- Tooltip Logic ---
const showTooltip = (event, content) => {
    tooltipDiv.style("opacity", 1).html(content)
        .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
};
const moveTooltip = (event) => {
    tooltipDiv.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
};
const hideTooltip = () => {
    tooltipDiv.style("opacity", 0);
};

// --- Calendar Dragging Helper Functions ---
function getXFromDate(date, firstDayOfGrid, columnWidth) {
    if (!date || !firstDayOfGrid || isNaN(date) || isNaN(firstDayOfGrid) || !columnWidth || columnWidth <= 0) return NaN;
    const startOfWeekGrid = d3.timeWeek.floor(firstDayOfGrid);
    const startOfWeekDate = d3.timeWeek.floor(date);
    if (startOfWeekDate < startOfWeekGrid) return 0;
    const weekIndex = d3.timeWeek.count(startOfWeekGrid, startOfWeekDate);
    return weekIndex * columnWidth;
}
function getDateFromX(xPos, daysArray, firstDayOfGrid, columnWidth) {
     if (!daysArray || daysArray.length === 0 || !firstDayOfGrid || !columnWidth || columnWidth <= 0 || xPos < -columnWidth / 2) return null;
    const maxWeekIndex = d3.timeWeek.count(d3.timeWeek.floor(firstDayOfGrid), d3.timeWeek.floor(daysArray[daysArray.length - 1]));
    const calculatedIndex = Math.floor((xPos + columnWidth / 2) / columnWidth);
    const weekIndex = Math.max(0, Math.min(calculatedIndex, maxWeekIndex));
    const startOfWeekGrid = d3.timeWeek.floor(firstDayOfGrid);
    const targetWeekStartDate = d3.timeWeek.offset(startOfWeekGrid, weekIndex);
    let foundDate = null;
    const firstDayInArray = daysArray[0];
    const lastDayInArray = daysArray[daysArray.length - 1];
    for (const day of daysArray) { if (d3.timeWeek.floor(day).getTime() === targetWeekStartDate.getTime()) { foundDate = day; break; } }
    if (!foundDate) { if (targetWeekStartDate <= firstDayInArray) return firstDayInArray; else if (targetWeekStartDate >= d3.timeWeek.floor(lastDayInArray)) return lastDayInArray; else { foundDate = daysArray.slice().reverse().find(d => d < targetWeekStartDate); return foundDate || lastDayInArray; } }
    return foundDate;
}
function updateFilterInfoLabel(startDate, endDate) {
     if (!filterInfoSpan) return;
    if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) {
        filterInfoSpan.textContent = `${formatDate(startDate)} → ${formatDate(endDate)}`;
    } else {
        filterInfoSpan.textContent = 'Full selected range';
    }
}

// --- Calendar Drawing ---
function drawCalendar(data, initialStartDate, initialEndDate) {
    calendarDiv.innerHTML = ""; legendDiv.innerHTML = "";
    svgInstance = null; allDaysInCalendar = []; calendarStartDay = null;
    currentCalendarHeight = 0; currentViewData = data;
    const listeningData = data.filter(d => d.ms_played > 0);
    if (listeningData.length === 0) { calendarDiv.innerHTML = `<p class="empty-message">No listening data for this period.</p>`; [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv].forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;}); updateFilterInfoLabel(initialStartDate, initialEndDate); if (typeof handleBrushUpdate === 'function') { handleBrushUpdate([]); } return; }
    const dailyData = d3.rollups(listeningData, v => d3.sum(v, d => d.ms_played / 60000), d => formatDay(d.ts));
    const valueMap = new Map(dailyData);
    const dataStartDate = new Date(initialStartDate); const dataEndDate = new Date(initialEndDate);
     if (!dataStartDate || !dataEndDate || isNaN(dataStartDate) || isNaN(dataEndDate) || dataStartDate > dataEndDate) { console.error("drawCalendar: Invalid date range received."); calendarDiv.innerHTML = `<p class="error-message">Invalid date range.</p>`; if (typeof handleBrushUpdate === 'function') { handleBrushUpdate([]); } return; }
    const firstDayOfMonthStart = d3.timeMonth.floor(dataStartDate); const lastDayOfMonthEnd = d3.timeMonth.offset(d3.timeMonth.floor(dataEndDate), 1); allDaysInCalendar = d3.timeDays(firstDayOfMonthStart, lastDayOfMonthEnd);
    if (allDaysInCalendar.length === 0) { console.error("drawCalendar: No days generated for grid."); calendarDiv.innerHTML = `<p class="error-message">Could not generate grid days.</p>`; if (typeof handleBrushUpdate === 'function') { handleBrushUpdate([]); } return; }
    calendarStartDay = allDaysInCalendar[0]; const endDay = allDaysInCalendar[allDaysInCalendar.length - 1]; const months = d3.timeMonths(calendarStartDay, endDay);
    const weekCount = d3.timeWeek.count(calendarStartDay, endDay) + 1; const width = weekCount * cellWidthWithPadding + leftPadding + 20; currentCalendarHeight = 7 * cellWidthWithPadding; const height = currentCalendarHeight + topPadding + 30;
    const maxMinutes = d3.max(valueMap.values()); calendarColorScale.domain([0, maxMinutes || 1]);
    const svg = d3.select("#calendar").append("svg").attr("width", width).attr("height", height).append("g").attr("transform", `translate(${leftPadding}, ${topPadding})`); svgInstance = svg;
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; svg.selectAll(".day-label").data(d3.range(7)).enter().append("text").attr("class", "day-label").attr("x", -15).attr("y", d => d * cellWidthWithPadding + cellWidthWithPadding / 2 - cellSize / 2).attr("dy", "0.35em").text(d => dayLabels[d]);
    svg.selectAll(".month-label").data(months).enter().append("text").attr("class", "month-label").attr("x", d => getXFromDate(d3.max([calendarStartDay, d3.timeWeek.floor(d)]), calendarStartDay, cellWidthWithPadding)).attr("y", -10).text(formatMonth);
    const cells = svg.selectAll(".day-cell").data(allDaysInCalendar).enter().append("rect").attr("class", "day-cell").attr("width", cellSize).attr("height", cellSize).attr("rx", 2).attr("ry", 2).attr("x", d => getXFromDate(d, calendarStartDay, cellWidthWithPadding)).attr("y", d => d.getDay() * cellWidthWithPadding).attr("fill", noDataColor).attr("stroke", "#fff").attr("stroke-width", 0.5)
       .on("mouseover", (event, d) => { const key = formatDay(d); const valueMins = valueMap.get(key) || 0; showTooltip(event, `${formatDate(d)}<br><b>Listened: ${formatTime(valueMins)}</b>`); d3.select(event.currentTarget).attr("stroke", "#333").attr("stroke-width", 1.5); })
       .on("mousemove", moveTooltip).on("mouseout", (event) => { hideTooltip(); d3.select(event.currentTarget).attr("stroke", "#fff").attr("stroke-width", 0.5); });
    cells.transition().duration(500).attr("fill", d => { const key = formatDay(d); const value = valueMap.get(key); return (value === undefined || value <= 0) ? noDataColor : calendarColorScale(value); });
    drawLegend(legendDiv, calendarColorScale, maxMinutes);
    selectedStartDate = dataStartDate; selectedEndDate = dataEndDate;
    drawHandles(selectedStartDate, selectedEndDate); updateFilterInfoLabel(selectedStartDate, selectedEndDate);
}

// --- Drag Handle Drawing & Events ---
function drawHandles(startDate, endDate) {
     if (!svgInstance || !calendarStartDay || !startDate || !endDate || isNaN(startDate) || isNaN(endDate) || currentCalendarHeight <= 0) return;
    const startX = getXFromDate(startDate, calendarStartDay, cellWidthWithPadding); const endHandleDateForPositioning = d3.timeDay.offset(endDate, 1); const safeEndPosDate = endHandleDateForPositioning <= startDate ? d3.timeDay.offset(startDate, 1) : endHandleDateForPositioning; let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding); if (isNaN(endX)) endX = getXFromDate(endDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding; endX = Math.max(endX, startX + handleWidth); if (isNaN(startX) || isNaN(endX)) { console.error("drawHandles: NaN X position!", { startX, endX }); return; }
    let startHandleGroup = svgInstance.select(".start-handle-group"); if (startHandleGroup.empty()) { startHandleGroup = svgInstance.append("g").attr("class", "start-handle-group"); startHandleGroup.append("line").attr("class", "drag-handle start-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round"); startHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize"); } startHandleGroup.attr("transform", `translate(${startX}, 0)`).selectAll("line").attr("y2", currentCalendarHeight + cellPadding); startHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "start")).on("end", handleDragEnd));
     let endHandleGroup = svgInstance.select(".end-handle-group"); if (endHandleGroup.empty()) { endHandleGroup = svgInstance.append("g").attr("class", "end-handle-group"); endHandleGroup.append("line").attr("class", "drag-handle end-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round"); endHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize"); } endHandleGroup.attr("transform", `translate(${endX}, 0)`).selectAll("line").attr("y2", currentCalendarHeight + cellPadding); endHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "end")).on("end", handleDragEnd)); updateHighlightRect();
}
function handleDragStart(event) { d3.select(this).raise().select(".drag-handle").attr("stroke", "black").attr("stroke-opacity", 0.7); svgInstance.select(".highlight-rect")?.raise(); svgInstance.selectAll(".start-handle-group, .end-handle-group").raise(); }
function handleDrag(event, handleType) {
     if (!svgInstance || !calendarStartDay || allDaysInCalendar.length === 0 || !selectedStartDate || !selectedEndDate || currentCalendarHeight <= 0) return; const currentX = event.x; let targetDate = getDateFromX(currentX, allDaysInCalendar, calendarStartDay, cellWidthWithPadding); if (!targetDate || isNaN(targetDate)) return; const minDate = allDaysInCalendar[0]; const maxDate = allDaysInCalendar[allDaysInCalendar.length - 1]; if (targetDate < minDate) targetDate = minDate; if (targetDate > maxDate) targetDate = maxDate; let snappedX; let newStartDate = selectedStartDate; let newEndDate = selectedEndDate; let groupToMove;
    if (handleType === "start") { targetDate = d3.min([targetDate, selectedEndDate]); newStartDate = targetDate; snappedX = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding); groupToMove = svgInstance.select(".start-handle-group"); if (!isNaN(snappedX)) groupToMove.attr("transform", `translate(${snappedX}, 0)`); else console.error("handleDrag (Start): Invalid snappedX."); } else { targetDate = d3.max([targetDate, selectedStartDate]); newEndDate = targetDate; const endHandleDateForPositioning = d3.timeDay.offset(newEndDate, 1); const safeEndPosDate = endHandleDateForPositioning <= newStartDate ? d3.timeDay.offset(newStartDate, 1) : endHandleDateForPositioning; snappedX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding); if (isNaN(snappedX)) snappedX = getXFromDate(newEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding; const startXForCompare = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding); if (!isNaN(startXForCompare) && !isNaN(snappedX)) snappedX = Math.max(snappedX, startXForCompare + handleWidth); else { if(isNaN(snappedX)) return; } groupToMove = svgInstance.select(".end-handle-group"); if (!isNaN(snappedX)) groupToMove.attr("transform", `translate(${snappedX}, 0)`); else console.error("handleDrag (End): Invalid snappedX."); }
    selectedStartDate = newStartDate; selectedEndDate = newEndDate; updateHighlightRect(); updateFilterInfoLabel(selectedStartDate, selectedEndDate);
}
function handleDragEnd(event) { d3.select(this).select(".drag-handle").attr("stroke", handleColor).attr("stroke-opacity", 1.0); if (startDateInput && selectedStartDate) startDateInput.value = formatDateForInput(selectedStartDate); if (endDateInput && selectedEndDate) endDateInput.value = formatDateForInput(selectedEndDate); filterDataAndUpdateCharts(selectedStartDate, selectedEndDate); }
function updateHighlightRect() {
     if (!svgInstance || !selectedStartDate || !selectedEndDate || !calendarStartDay || isNaN(selectedStartDate) || isNaN(selectedEndDate) || currentCalendarHeight <= 0) { svgInstance?.select(".highlight-rect").remove(); return; } let highlightRect = svgInstance.select(".highlight-rect"); if (highlightRect.empty()) { highlightRect = svgInstance.insert("rect", ":first-child").attr("class", "highlight-rect").attr("fill", highlightColor).attr("pointer-events", "none"); } const startX = getXFromDate(selectedStartDate, calendarStartDay, cellWidthWithPadding); const endHandleDateForPositioning = d3.timeDay.offset(selectedEndDate, 1); const safeEndPosDate = endHandleDateForPositioning <= selectedStartDate ? d3.timeDay.offset(selectedStartDate, 1) : endHandleDateForPositioning; let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding); if (isNaN(endX)) endX = getXFromDate(selectedEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding; endX = Math.max(endX, startX); if (isNaN(startX) || isNaN(endX) || isNaN(currentCalendarHeight)) { highlightRect.remove(); return; } highlightRect.attr("x", startX).attr("y", 0).attr("width", Math.max(0, endX - startX)).attr("height", currentCalendarHeight);
}
function filterDataAndUpdateCharts(startDate, endDate) {
     if (!startDate || !endDate || !currentViewData || isNaN(startDate) || isNaN(endDate) || startDate > endDate) { handleBrushUpdate([]); updateFilterInfoLabel(startDate, endDate); return; }
     const filterStart = d3.timeDay.floor(new Date(startDate)); const filterEnd = d3.timeDay.offset(d3.timeDay.floor(new Date(endDate)), 1); const filtered = currentViewData.filter(d => { const dDate = d.ts; return dDate instanceof Date && !isNaN(dDate) && dDate >= filterStart && dDate < filterEnd; }); updateFilterInfoLabel(startDate, endDate); handleBrushUpdate(filtered);
}

// --- Legend Drawing ---
function drawLegend(container, scale, maxValue) { container.innerHTML = ""; if (maxValue === undefined || maxValue <= 0) return; const legendWidth = 200, legendHeight = 20, legendMargin = { top: 0, right: 10, bottom: 15, left: 10 }, barHeight = 8; const legendSvg = d3.select(container).append("svg").attr("width", legendWidth).attr("height", legendHeight + legendMargin.top + legendMargin.bottom); const legendDefs = legendSvg.append("defs"); const linearGradient = legendDefs.append("linearGradient").attr("id", "calendar-gradient"); const numStops = 10; const interpolator = typeof scale.interpolator === 'function' ? scale.interpolator() : (t => scale(maxValue * t)); linearGradient.selectAll("stop").data(d3.range(numStops + 1)).enter().append("stop").attr("offset", d => `${(d / numStops) * 100}%`).attr("stop-color", d => interpolator(d / numStops)); legendSvg.append("rect").attr("x", legendMargin.left).attr("y", legendMargin.top).attr("width", legendWidth - legendMargin.left - legendMargin.right).attr("height", barHeight).style("fill", "url(#calendar-gradient)").attr("rx", 2).attr("ry", 2); legendSvg.append("text").attr("class", "legend-label").attr("x", legendMargin.left).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "start").text("Less"); legendSvg.append("text").attr("class", "legend-label").attr("x", legendWidth - legendMargin.right).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "end").text("More"); }

// --- Existing Chart Update Functions ---
function updateTopArtists(data) { const targetUl = document.getElementById('topArtists'); if (!targetUl) return; targetUl.innerHTML = ""; if (!data || data.length === 0) { targetUl.innerHTML = `<li class="empty-message">No data.</li>`; return; } const artistData = d3.rollups(data.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.artist).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5); if (artistData.length === 0) { targetUl.innerHTML = `<li class="empty-message">No artist data.</li>`; return; } artistData.forEach(([artist, totalMinutes], index) => { const li = document.createElement("li"); li.innerHTML = `<span class="artist-name">${index + 1}. ${artist}</span> <span class="artist-time">(${formatTime(totalMinutes)})</span>`; targetUl.appendChild(li); }); }
function updateTopTracksChart(data) { topTracksDiv.innerHTML = ""; if (!requiredColumns.track_name) { topTracksDiv.innerHTML = `<p class="info-message">'Track Name' column missing.</p>`; return; } if (!data || data.length === 0) { topTracksDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; } const trackData = d3.rollups(data.filter(d => d.track && d.track !== "Unknown Track" && d.track !== "N/A" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => `${d.track} • ${d.artist}`).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 15); if (trackData.length === 0) { topTracksDiv.innerHTML = `<p class="empty-message">No track data.</p>`; return; } const chartHeight = trackData.length * 25 + chartMargin.top + chartMargin.bottom; const containerWidth = topTracksDiv.parentElement?.clientWidth || 400; const chartWidth = containerWidth > 0 ? containerWidth : 400; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom; if (width <= 0 || height <= 0) { topTracksDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; } const svg = d3.select(topTracksDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`); const y = d3.scaleBand().range([0, height]).domain(trackData.map(d => d[0])).padding(0.2); const x = d3.scaleLinear().domain([0, d3.max(trackData, d => d[1]) || 1]).range([0, width]); svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("fill", "currentColor").attr("text-anchor", "middle").text("Total Listening Time"); const yAxis = svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).tickSize(0).tickPadding(5)); yAxis.select(".domain").remove(); yAxis.selectAll("text").attr("x", -5); svg.selectAll(".bar").data(trackData).enter().append("rect").attr("class", "bar").attr("y", d => y(d[0])).attr("height", y.bandwidth()).attr("x", 0).attr("width", 0).attr("fill", "#1DB954").on("mouseover", (event, d) => showTooltip(event, `<b>${d[0]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("width", d => Math.max(0, x(d[1]))); }
function updateTimeOfDayChart(data) { timeOfDayDiv.innerHTML = ""; if (!data || data.length === 0) { timeOfDayDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; } const hourData = d3.rollups(data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getHours()); const hourMap = new Map(hourData); const completeHourData = d3.range(24).map(h => [h, hourMap.get(h) || 0]); const containerWidth = timeOfDayDiv.parentElement?.clientWidth || 400; const chartWidth = containerWidth > 0 ? containerWidth : 400; const chartHeight = 250; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom; if (width <= 0 || height <= 0) { timeOfDayDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; } const svg = d3.select(timeOfDayDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`); const x = d3.scaleBand().range([0, width]).domain(d3.range(24)).padding(0.2); const y = d3.scaleLinear().domain([0, d3.max(completeHourData, d => d[1]) || 1]).range([height, 0]).nice(); svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickValues(d3.range(0, 24, 3))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("fill", "currentColor").attr("text-anchor", "middle").text("Hour of Day"); svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("fill", "currentColor").attr("text-anchor", "middle").text("Total Listening Time"); svg.selectAll(".bar").data(completeHourData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#fd7e14").on("mouseover", (event, d) => showTooltip(event, `<b>Hour ${d[0]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1]))); }
function updateDayOfWeekChart(data) { dayOfWeekDiv.innerHTML = ""; if (!data || data.length === 0) { dayOfWeekDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; } const dayData = d3.rollups(data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getDay()); const dayMap = new Map(dayData); const completeDayData = d3.range(7).map(dayIndex => [dayIndex, dayMap.get(dayIndex) || 0]); const containerWidth = dayOfWeekDiv.parentElement?.clientWidth || 400; const chartWidth = containerWidth > 0 ? containerWidth : 400; const chartHeight = 250; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom; if (width <= 0 || height <= 0) { dayOfWeekDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; } const svg = d3.select(dayOfWeekDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`); const x = d3.scaleBand().range([0, width]).domain(d3.range(7)).padding(0.2); const y = d3.scaleLinear().domain([0, d3.max(completeDayData, d => d[1]) || 1]).range([height, 0]).nice(); svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickFormat(d => dayOfWeekNames[d])).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("fill", "currentColor").attr("text-anchor", "middle").text("Day of Week"); svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("fill", "currentColor").attr("text-anchor", "middle").text("Total Listening Time"); svg.selectAll(".bar").data(completeDayData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#6f42c1").on("mouseover", (event, d) => showTooltip(event, `<b>${dayOfWeekNames[d[0]]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1]))); }

// --- Main Update Triggers ---
function handleBrushUpdate(filteredChartData) {
    const dataToUpdate = filteredChartData || [];
    updateTopArtists(dataToUpdate);
    updateTopTracksChart(dataToUpdate);
    updateTimeOfDayChart(dataToUpdate);
    updateDayOfWeekChart(dataToUpdate);
    // *** ADDED STREAMGRAPH UPDATE ***
    drawStreamgraph(dataToUpdate, 'streamgraph-chart');
}

function updateVisualization(filteredData) {
     const chartsToClear = [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv, document.getElementById('streamgraph-chart')]; // Added streamgraph to clear list
     selectedStartDate = null; selectedEndDate = null;
     if (!filteredData || filteredData.length === 0) {
        calendarDiv.innerHTML = `<p class="empty-message">No data for selected period.</p>`; legendDiv.innerHTML = "";
        chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
        updateFilterInfoLabel(null, null); return;
    }
    const [viewStartDate, viewEndDate] = d3.extent(filteredData, d => d.ts);
    if (!viewStartDate || !viewEndDate || isNaN(viewStartDate) || isNaN(viewEndDate)) {
         console.error("updateVisualization: Invalid date range in data."); calendarDiv.innerHTML = `<p class="error-message">Invalid date range.</p>`;
         legendDiv.innerHTML = ""; chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
         updateFilterInfoLabel(null, null); return;
    }
     drawCalendar(filteredData, viewStartDate, viewEndDate);
     // Call filterDataAndUpdateCharts which now calls handleBrushUpdate (which includes streamgraph)
     filterDataAndUpdateCharts(viewStartDate, viewEndDate);
}

// --- Event Listeners ---
yearSelect.onchange = () => {
    const selectedYear = +yearSelect.value; if (!selectedYear || isNaN(selectedYear)) { updateVisualization([]); return; }
    const yearStart = new Date(selectedYear, 0, 1); const yearEndFilter = new Date(selectedYear + 1, 0, 1);
    const filteredByYear = allParsedData.filter(d => d.ts >= yearStart && d.ts < yearEndFilter);
    startDateInput.value = formatDateForInput(yearStart); endDateInput.value = formatDateForInput(new Date(selectedYear, 11, 31));
    updateVisualization(filteredByYear);
};

applyRangeBtn.onclick = () => {
    const startStr = startDateInput.value; const endStr = endDateInput.value;
    const startMs = Date.parse(startStr); const endMs = Date.parse(endStr);
    let start = !isNaN(startMs) ? d3.timeDay.floor(new Date(startMs)) : null;
    let end = !isNaN(endMs) ? d3.timeDay.floor(new Date(endMs)) : null;
    if (!start || !end) { alert("Invalid date format. Please use YYYY-MM-DD."); return; }
    if (start > end) { // Swap if needed
        console.warn("Start date was after end date, swapping them.");
        [start, end] = [end, start]; // Destructuring assignment to swap
        startDateInput.value = formatDateForInput(start);
        endDateInput.value = formatDateForInput(end);
    }
    const filterEnd = d3.timeDay.offset(end, 1); yearSelect.value = ""; // Clear year select
    const filteredByRange = allParsedData.filter(d => d.ts >= start && d.ts < filterEnd);
    updateVisualization(filteredByRange);
};


// ============================================== //
// === NEW CHART DRAWING FUNCTIONS ============= //
// ============================================== //

async function drawTimeline(fullData, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !fullData || fullData.length === 0) { container.innerHTML = '<p class="empty-message">No data.</p>'; return; }
    container.innerHTML = "";
    const latestTs = d3.max(fullData, d => d.ts);
    if (!latestTs) { container.innerHTML = '<p class="empty-message">No timestamp.</p>'; return; }
    const twentyFourHoursAgo = new Date(latestTs.getTime() - 24 * 60 * 60 * 1000);
    const timelineData = fullData.filter(d => d.ts >= twentyFourHoursAgo && d.ms_played > 0);
    if (timelineData.length === 0) { container.innerHTML = '<p class="empty-message">No events in last 24h.</p>'; return; }
    const margin = { top: 10, right: 30, bottom: 30, left: 30 };
    const containerWidth = container.clientWidth || 800; const height = 100 - margin.top - margin.bottom; const width = containerWidth - margin.left - margin.right;
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`).attr("preserveAspectRatio", "xMinYMid meet")
                  .append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    const xScale = d3.scaleTime().domain([twentyFourHoursAgo, latestTs]).range([0, width]);
    const platforms = [...new Set(timelineData.map(d => d.platform || "Unknown"))];
    const colorScale = d3.scaleOrdinal().domain(platforms).range(d3.schemeCategory10);
    svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale).ticks(d3.timeHour.every(3)).tickFormat(d3.timeFormat("%H:%M")));
    const tapeHeight = height * 0.6; const tapeY = (height - tapeHeight) / 2;
    svg.selectAll(".timeline-event").data(timelineData).enter().append("rect").attr("class", "timeline-event")
       .attr("x", d => xScale(d.ts)).attr("y", tapeY)
       .attr("width", d => { const startX = xScale(d.ts); const endTs = new Date(d.ts.getTime() + d.ms_played); const effectiveEndX = xScale(endTs > latestTs ? latestTs : endTs); return Math.max(1, effectiveEndX - startX); })
       .attr("height", tapeHeight).attr("fill", d => colorScale(d.platform || "Unknown")).attr("stroke", d => d.skipped ? handleColor : "#333").attr("stroke-width", d => d.skipped ? 1.5 : 0.5)
       .on("mouseover", (event, d) => {
            d3.select(event.currentTarget).attr("stroke-width", d.skipped ? 2.5 : 1.5);
            const content = `<b>${d.track || d.episode_name || d.audiobook_chapter_title || 'Unknown Title'}</b><br>Artist/Show: ${d.artist || d.episode_show_name || d.audiobook_title || 'N/A'}<br>Album: ${d.album || 'N/A'}<br>Duration: ${formatTime(d.ms_played / 60000)}<br>Platform: ${d.platform || 'Unknown'}<br>Skipped: ${d.skipped ? 'Yes' : 'No'} <br>Reason Start: ${d.reason_start || 'N/A'}<br>Reason End: ${d.reason_end || 'N/A'}`;
            showTooltip(event, content);
       })
       .on("mousemove", moveTooltip)
       .on("mouseout", (event, d) => {
           d3.select(event.currentTarget).attr("stroke-width", d.skipped ? 1.5 : 0.5); hideTooltip();
       });
}

// ** MODIFIED Streamgraph Function (Uses Filtered Data) **
async function drawStreamgraph(chartData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) { console.error("Streamgraph container not found:", containerId); return; } // Added container check

    // Use the passed chartData for checks
     if (!chartData || chartData.length === 0) {
        container.innerHTML = '<p class="empty-message">No data for the selected period.</p>';
        return;
    }
    container.innerHTML = ""; // Clear previous

    // --- 1. Prepare Data (No date filtering needed here anymore) ---
    const dataToProcess = chartData; // Use the passed data

    // Derive Content Type (Music vs Podcast)
    dataToProcess.forEach(d => { if (d.episode_name && d.episode_name.trim() !== "") d.contentType = 'Podcast'; else d.contentType = 'Music'; });
    const derivedTypesCount = d3.rollup(dataToProcess, v => v.length, d => d.contentType);
    const contentTypes = ['Music', 'Podcast'].filter(type => derivedTypesCount.has(type));
    if (contentTypes.length === 0) { container.innerHTML = '<p class="empty-message">No Music or Podcast data found.</p>'; return; }

    // Aggregate Data by Hour (Summing minutes)
    const aggregatedData = Array.from( d3.group(dataToProcess, d => d3.timeHour.floor(d.ts)), ([timeBin, values]) => {
        const entry = { timeBin: new Date(timeBin) };
        contentTypes.forEach(type => entry[type] = 0); // Initialize keys
        values.forEach(v => { if (entry.hasOwnProperty(v.contentType)) entry[v.contentType] += v.ms_played; });
        contentTypes.forEach(type => entry[type] = entry[type] / 60000); // Convert to minutes
        return entry;
    }).sort((a, b) => a.timeBin - b.timeBin);

    if (aggregatedData.length === 0) { container.innerHTML = '<p class="empty-message">Could not aggregate data.</p>'; return; }

    // Filter out time bins where total is 0 to avoid division by zero issues with stackOffsetExpand
    const filteredAggregatedData = aggregatedData.filter(d => d3.sum(contentTypes, type => d[type]) > 0);

    if (filteredAggregatedData.length === 0) { container.innerHTML = '<p class="empty-message">No listening time found for aggregation.</p>'; return; }


    // --- 2. Setup SVG ---
    const margin = { top: 20, right: 30, bottom: 30, left: 50 };
    const containerWidth = container.clientWidth || 800;
    const height = 300 - margin.top - margin.bottom;
    const width = containerWidth - margin.left - margin.right;
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`)
                  .attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    // --- 3. Scales ---
    // *** X SCALE DOMAIN USES chartData EXTENT ***
    const [minDate, maxDate] = d3.extent(chartData, d => d.ts); // Get extent from original filtered data
    const xScale = d3.scaleTime()
        .domain([minDate, maxDate]) // Base domain on the input filtered data
        .range([0, width]);

    // Y Scale for normalized data (0 to 100%)
    const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);

    const colorMap = { 'Music': '#1DB954', 'Podcast': '#6f42c1' };
    const colorScale = d3.scaleOrdinal().domain(contentTypes).range(contentTypes.map(type => colorMap[type]));

    // --- 4. Stacking (Normalized) ---
    const stack = d3.stack().keys(contentTypes).offset(d3.stackOffsetExpand).order(d3.stackOrderAppearance);
    let series;
    try { series = stack(filteredAggregatedData); } catch (error) { console.error("Streamgraph - Stack error:", error); container.innerHTML = '<p class="error-message">Error processing data.</p>'; return; }
    if (series.length === 0){ container.innerHTML = '<p class="empty-message">No layers generated.</p>'; return; }

    // --- 5. Area Generator ---
    const areaGen = d3.area().x(d => xScale(d.data.timeBin)).y0(d => yScale(d[0])).y1(d => yScale(d[1])).curve(d3.curveBasis);

    // --- 6. Draw Areas ---
    svg.selectAll(".stream-layer").data(series).enter().append("path")
       .attr("class", "stream-layer")
       .attr("d", areaGen)
       .attr("fill", d => colorScale(d.key))
       .attr("stroke", "#fff").attr("stroke-width", 0.5)
       .on("mouseover", (event, d) => { /* ... tooltip ... */
             d3.selectAll(".stream-layer").style("fill-opacity", 0.3);
             d3.select(event.currentTarget).style("fill-opacity", 0.9).attr("stroke-width", 1.5).attr("stroke", "#000");
             showTooltip(event, `<b>${d.key}</b>`);
        })
       .on("mousemove", moveTooltip) // *** Uses moveTooltip ***
       .on("mouseout", (event, d) => { /* ... tooltip ... */
            d3.selectAll(".stream-layer").style("fill-opacity", 1);
            d3.select(event.currentTarget).attr("stroke-width", 0.5).attr("stroke", "#fff");
            hideTooltip();
        });

    // --- 7. Draw Axes ---
    // Determine appropriate time ticks based on duration
    const durationDays = d3.timeDay.count(minDate, maxDate);
    let tickInterval;
    if (durationDays <= 2) {
        tickInterval = d3.timeHour.every(6);
    } else if (durationDays <= 14) {
        tickInterval = d3.timeDay.every(1);
    } else if (durationDays <= 60) {
        tickInterval = d3.timeWeek.every(1);
    } else if (durationDays <= 370){
         tickInterval = d3.timeMonth.every(1);
    } else {
        tickInterval = d3.timeYear.every(1);
    }

    svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).ticks(tickInterval).tickFormat(d3.timeFormat("%b %d"))); // Example format

    // Y Axis showing Percentage
    svg.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".0%")))
        .append("text")
             .attr("class", "axis-label")
             .attr("transform", "rotate(-90)")
             .attr("y", 0 - margin.left + 10)
             .attr("x", 0 - (height / 2))
             .attr("dy", "1em")
             .attr("fill", "currentColor")
             .attr("text-anchor", "middle")
             .text("Share of Listening Time");

     // Update the chart title/description dynamically (Optional)
     const titleElement = container.previousElementSibling;
     if (titleElement && titleElement.tagName === 'H2') {
         titleElement.textContent = `Content Type River (${formatDate(minDate)} → ${formatDate(maxDate)})`;
     }
      const descElement = container.nextElementSibling;
      if (descElement && descElement.tagName === 'P') {
          descElement.textContent = `Shows the relative share (%) of listening time between Music and Podcasts over the selected period.`;
      }
}


// async function drawSankey(fullData, containerId, topN = 10) {
//     const container = document.getElementById(containerId);
//      if (!container || !fullData || fullData.length === 0) { container.innerHTML = '<p class="empty-message">No data.</p>'; return; }
//      if (typeof d3.sankey !== 'function') { container.innerHTML = '<p class="error-message">Error: d3-sankey library not loaded.</p>'; console.error("d3-sankey library required."); return; }
//     container.innerHTML = "";
//     const musicData = fullData.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0).sort((a, b) => a.ts - b.ts);
//     if (musicData.length < 2) { container.innerHTML = '<p class="empty-message">Not enough data.</p>'; return; }
//     const artistCounts = d3.rollup(musicData, v => v.length, d => d.artist);
//     const topArtists = new Set(Array.from(artistCounts.entries()).sort(([, countA], [, countB]) => countB - countA).slice(0, topN).map(([artist]) => artist));
//     const transitions = new Map();
//     for (let i = 0; i < musicData.length - 1; i++) { const sourceArtist = musicData[i].artist; const targetArtist = musicData[i + 1].artist; if (topArtists.has(sourceArtist) && topArtists.has(targetArtist) && sourceArtist !== targetArtist) { const key = `${sourceArtist} -> ${targetArtist}`; transitions.set(key, (transitions.get(key) || 0) + 1); } }
//     if (transitions.size === 0) { container.innerHTML = `<p class="empty-message">No transitions found.</p>`; return; }
//     const nodes = Array.from(topArtists).map(artist => ({ nodeId: artist }));
//     const links = Array.from(transitions.entries()).map(([key, count]) => { const [source, target] = key.split(" -> "); return { source: source, target: target, value: count }; });
//     const graphData = { nodes, links };
//     const margin = { top: 20, right: 150, bottom: 20, left: 150 }; const containerWidth = container.clientWidth || 800; const height = 400 - margin.top - margin.bottom; const width = containerWidth - margin.left - margin.right;
//     if (width <= 0 || height <= 0) { container.innerHTML = '<p class="error-message">Container too small for Sankey.</p>'; return; }
//     const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
//     const sankey = d3.sankey().nodeId(d => d.nodeId).nodeWidth(15).nodePadding(10).extent([[1, 1], [width - 1, height - 5]]);
//     const { nodes: layoutNodes, links: layoutLinks } = sankey(graphData);
//     const link = svg.append("g").attr("class", "sankey-links").attr("fill", "none").attr("stroke-opacity", 0.3).selectAll("path").data(layoutLinks).join("path").attr("d", d3.sankeyLinkHorizontal()).attr("stroke", "#999").attr("stroke-width", d => Math.max(1, d.width));
//     link.append("title").text(d => `${d.source.nodeId} → ${d.target.nodeId}\n${d.value} transitions`);
//     link.on("mouseover", function() { d3.select(this).attr("stroke-opacity", 0.6); }).on("mouseout", function() { d3.select(this).attr("stroke-opacity", 0.3); });
//     const node = svg.append("g").attr("class", "sankey-nodes").attr("stroke", "#000").selectAll("rect").data(layoutNodes).join("rect").attr("x", d => d.x0).attr("y", d => d.y0).attr("height", d => Math.max(1, d.y1 - d.y0)).attr("width", d => d.x1 - d.x0).attr("fill", "#1DB954");
//     node.append("title").text(d => `${d.nodeId}\nTotal Value: ${d.value.toLocaleString()}`);
//     node.on("mouseover", function() { d3.select(this).attr("stroke-width", 1.5); }).on("mouseout", function() { d3.select(this).attr("stroke-width", 1); });
//     svg.append("g").attr("class", "sankey-labels").attr("font-family", "sans-serif").attr("font-size", 10).selectAll("text").data(layoutNodes).join("text").attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6).attr("y", d => (d.y1 + d.y0) / 2).attr("dy", "0.35em").attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end").text(d => d.nodeId);
// }

async function drawSankey(fullData, containerId, topN = 10) {
    const container = document.getElementById(containerId);
     if (!container) { console.error("Sankey container not found:", containerId); return; }
     if (!fullData || fullData.length === 0) { container.innerHTML = '<p class="empty-message">No data for Sankey.</p>'; return; }
     if (typeof d3.sankey !== 'function') { container.innerHTML = '<p class="error-message">Error: d3-sankey library not loaded.</p>'; console.error("d3-sankey library required."); return; }

    console.log("--- Drawing Sankey ---"); // Log start
    container.innerHTML = ""; // Clear previous

    // --- 1. Process Data ---
    const musicData = fullData
        .filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0)
        .sort((a, b) => a.ts - b.ts);

    console.log(`Sankey - Filtered music data count: ${musicData.length}`);
    if (musicData.length < 2) { container.innerHTML = '<p class="empty-message">Not enough sequential music plays.</p>'; return; }

    const artistCounts = d3.rollup(musicData, v => v.length, d => d.artist);
    const topArtistsArray = Array.from(artistCounts.entries())
             .sort(([, countA], [, countB]) => countB - countA)
             .slice(0, topN)
             .map(([artist]) => artist);
    const topArtists = new Set(topArtistsArray);

    console.log(`Sankey - Top ${topN} artists:`, topArtistsArray); // Log the actual top artists

    const transitions = new Map();
    for (let i = 0; i < musicData.length - 1; i++) {
        const sourceArtist = musicData[i].artist;
        const targetArtist = musicData[i + 1].artist;
        if (topArtists.has(sourceArtist) && topArtists.has(targetArtist) && sourceArtist !== targetArtist) {
            const key = `${sourceArtist}:::${targetArtist}`; // Use a less common separator just in case
            transitions.set(key, (transitions.get(key) || 0) + 1);
        }
    }

    console.log(`Sankey - Transitions found: ${transitions.size}`, transitions); // Log the transitions map
     if (transitions.size === 0) { container.innerHTML = `<p class="empty-message">No transitions found between top ${topN} artists.</p>`; return; }

    // Format for d3.sankey
    // Use the derived topArtistsArray to ensure consistent node order if needed, though Set is fine for lookup
    const nodes = topArtistsArray.map(artist => ({ nodeId: artist }));
    const links = Array.from(transitions.entries()).map(([key, count]) => {
        const [source, target] = key.split(":::");
        return { source: source, target: target, value: count };
    });

    const graphData = { nodes, links };
    console.log("Sankey - graphData for layout:", JSON.parse(JSON.stringify(graphData))); // Log deep copy

    // --- 2. Setup SVG ---
    const margin = { top: 20, right: 150, bottom: 20, left: 150 };
    const containerWidth = container.clientWidth || 800;
    const height = 400 - margin.top - margin.bottom; // Fixed height
    const width = containerWidth - margin.left - margin.right;

    console.log(`Sankey - Calculated dimensions: width=${width}, height=${height}`);
    if (width <= 0 || height <= 0) { container.innerHTML = '<p class="error-message">Container too small for Sankey.</p>'; return; }

    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`)
                  .attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    // --- 3. Initialize & Compute Sankey Layout ---
    const sankey = d3.sankey()
        .nodeId(d => d.nodeId)
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[1, 1], [width - 1, height - 5]]); // Use calculated extent

    let layoutResult;
    try {
         layoutResult = sankey(graphData);
         console.log("Sankey - Layout calculation result:", layoutResult); // Log the output of the layout function
    } catch (error) {
        console.error("Sankey - Error during layout calculation:", error);
        container.innerHTML = '<p class="error-message">Error calculating Sankey layout.</p>';
        return;
    }

    // Check if layout produced valid nodes/links
    if (!layoutResult || !layoutResult.nodes || !layoutResult.links || layoutResult.nodes.length === 0 ) {
        console.error("Sankey - Layout function did not produce valid nodes/links.");
        container.innerHTML = '<p class="error-message">Could not generate Sankey layout.</p>';
        return;
    }
    const { nodes: layoutNodes, links: layoutLinks } = layoutResult;


    // --- 4. Draw Links ---
    const link = svg.append("g").attr("class", "sankey-links").attr("fill", "none").attr("stroke-opacity", 0.3)
                   .selectAll("path").data(layoutLinks).join("path")
                   .attr("d", d3.sankeyLinkHorizontal())
                   .attr("stroke", "#999")
                   .attr("stroke-width", d => Math.max(1, d.width)); // Use calculated width
    link.append("title").text(d => `${d.source.nodeId} → ${d.target.nodeId}\n${d.value} transitions`);
    link.on("mouseover", function() { d3.select(this).attr("stroke-opacity", 0.6); }).on("mouseout", function() { d3.select(this).attr("stroke-opacity", 0.3); });
    console.log(`Sankey - Drew ${layoutLinks.length} links.`); // Log link count

    // --- 5. Draw Nodes ---
    const node = svg.append("g").attr("class", "sankey-nodes").attr("stroke", "#000")
                   .selectAll("rect").data(layoutNodes).join("rect")
                   .attr("x", d => d.x0)
                   .attr("y", d => d.y0)
                   .attr("height", d => Math.max(1, d.y1 - d.y0)) // Ensure min height
                   .attr("width", d => d.x1 - d.x0)
                   .attr("fill", "#1DB954"); // Node color
    node.append("title").text(d => `${d.nodeId}\nTotal Value: ${d.value?.toLocaleString() ?? 'N/A'}`); // Use optional chaining and nullish coalescing
    node.on("mouseover", function() { d3.select(this).attr("stroke-width", 1.5); }).on("mouseout", function() { d3.select(this).attr("stroke-width", 1); });
    console.log(`Sankey - Drew ${layoutNodes.length} nodes.`); // Log node count

    // --- 6. Add Labels ---
    svg.append("g").attr("class", "sankey-labels").attr("font-family", "sans-serif").attr("font-size", 10)
       .selectAll("text").data(layoutNodes).join("text")
       .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6) // Position left/right
       .attr("y", d => (d.y1 + d.y0) / 2) // Center vertically
       .attr("dy", "0.35em")
       .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
       .text(d => d.nodeId);
    console.log("Sankey - Added labels.");
    console.log("--- Sankey Draw Complete ---");
}