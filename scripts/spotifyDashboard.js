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
// No need to declare containers globally if accessed via getElementById within functions

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
    reason_start: false, reason_end: false, artist: false, shuffle: false,
    album: false, conn_country: false,
};
let currentViewData = [];
let selectedStartDate = null;
let selectedEndDate = null;
let svgInstance = null; // Specific to calendar
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

        // --- CORRECTED: Handle case where no valid data is found after parsing ---
        if (allParsedData.length === 0) {
            // Check if elements exist before setting innerHTML
            if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">No valid data found after processing the CSV.</p>`;
            if (filterInfoSpan) filterInfoSpan.textContent = 'No data loaded';

             const timelineChart = document.getElementById('timeline-chart');
             if (timelineChart) timelineChart.innerHTML = `<p class="empty-message">No data.</p>`;

             const streamgraphChart = document.getElementById('streamgraph-chart');
             if (streamgraphChart) streamgraphChart.innerHTML = `<p class="empty-message">No data.</p>`;

             const forceGraphChart = document.getElementById('force-graph-chart');
             if (forceGraphChart) forceGraphChart.innerHTML = `<p class="empty-message">No data.</p>`;

             [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv].forEach(el => {
                 if (el) el.innerHTML = `<p class="empty-message">No data.</p>`;
             });
            return; // Stop execution if no data
        }
        // --- END CORRECTION ---

        // Populate Year Select dropdown
        const years = [...new Set(allParsedData.map(d => d.ts.getFullYear()))].sort((a, b) => a - b);
        years.forEach(y => {
            const opt = document.createElement('option'); opt.value = y; opt.textContent = y; yearSelect.appendChild(opt);
        });

        // --- Initial Load ---
        const defaultYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
        yearSelect.value = defaultYear;
        yearSelect.dispatchEvent(new Event('change')); // Trigger initial load for calendar etc.

        // --- DRAW CHARTS THAT ONLY NEED TO BE DRAWN ONCE ---
        console.log("Drawing initial Timeline...");
        drawTimeline(allParsedData, 'timeline-chart');
        // REMOVED: drawSankey(allParsedData, 'sankey-chart', 10); // No longer calling Sankey

         // Initially clear the containers that depend on selection
         const streamgraphContainer = document.getElementById('streamgraph-chart');
         if (streamgraphContainer) {
             streamgraphContainer.innerHTML = '<p class="empty-message">Select a period in the calendar above to view Music vs Podcast rate.</p>';
             const descEl = streamgraphContainer.nextElementSibling;
             console.log("descEl:", descEl);
             if (descEl) {
                console.log("descEl.classList:", descEl.classList);
                console.log("descEl.classList.contains:", typeof descEl.classList.contains);
            
                if (descEl.classList.contains('chart-description')) {
                    console.log("✅ descEl has class 'chart-description'");
                    descEl.innerHTML = 'Select a period in the calendar above to see the Music vs Podcast rate.';
                } else {
                    console.warn("⚠️ descEl does NOT have class 'chart-description'");
                }
            } else {
                console.warn("⚠️ descEl is null or undefined");
            }
         }
         const forceGraphContainer = document.getElementById('force-graph-chart');
         if (forceGraphContainer) {
            forceGraphContainer.innerHTML = '<p class="empty-message">Select a period in the calendar above to view artist transitions.</p>';
            const descEl = forceGraphContainer.nextElementSibling;
            if (descEl && descEl.classList.contains('chart-description')) {
                descEl.innerHTML = 'Select a period in the calendar above to view artist transitions.';
            }
         }

    } catch (error) {
        console.error("Error loading or processing data:", error);
        // --- CORRECTED: Catch block ---
        if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Error loading data. Check console for details.</p>`;
        if (filterInfoSpan) filterInfoSpan.textContent = 'Error loading data';

        const timelineChart = document.getElementById('timeline-chart');
        if (timelineChart) timelineChart.innerHTML = `<p class="error-message">Error loading data.</p>`;

        const streamgraphChart = document.getElementById('streamgraph-chart');
        if (streamgraphChart) streamgraphChart.innerHTML = `<p class="error-message">Error loading data.</p>`;

        const forceGraphChart = document.getElementById('force-graph-chart');
        if (forceGraphChart) forceGraphChart.innerHTML = `<p class="error-message">Error loading data.</p>`;

        [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv].forEach(el => {
            if (el) el.innerHTML = `<p class="error-message">Error loading data.</p>`;
        });
        // --- END CORRECTION ---
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
    if (listeningData.length === 0) {
        if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No listening data for this period.</p>`; // Added check
        const chartsToClear = [
            topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv,
            document.getElementById('streamgraph-chart'),
            document.getElementById('force-graph-chart')
        ];
        chartsToClear.forEach(el => { if (el) el.innerHTML = `<p class="empty-message">No data.</p>`; });
        updateFilterInfoLabel(initialStartDate, initialEndDate);
        if (typeof handleBrushUpdate === 'function') handleBrushUpdate([]);
        return;
    }
    const dailyData = d3.rollups(listeningData, v => d3.sum(v, d => d.ms_played / 60000), d => formatDay(d.ts));
    const valueMap = new Map(dailyData);
    const dataStartDate = new Date(initialStartDate); const dataEndDate = new Date(initialEndDate);
     if (!dataStartDate || !dataEndDate || isNaN(dataStartDate) || isNaN(dataEndDate) || dataStartDate > dataEndDate) {
          console.error("drawCalendar: Invalid date range received.", dataStartDate, dataEndDate);
          if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Invalid date range.</p>`; // Added check
          if (typeof handleBrushUpdate === 'function') handleBrushUpdate([]);
          return;
     }
    const firstDayOfMonthStart = d3.timeMonth.floor(dataStartDate);
    const lastDayOfMonthEnd = d3.timeMonth.offset(d3.timeMonth.floor(dataEndDate), 1);
    allDaysInCalendar = d3.timeDays(firstDayOfMonthStart, lastDayOfMonthEnd);
    if (allDaysInCalendar.length === 0) {
        console.error("drawCalendar: No days generated for grid.");
        if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Could not generate grid days.</p>`; // Added check
        if (typeof handleBrushUpdate === 'function') handleBrushUpdate([]);
        return;
    }
    calendarStartDay = allDaysInCalendar[0];
    const endDay = allDaysInCalendar[allDaysInCalendar.length - 1];
    const months = d3.timeMonths(calendarStartDay, endDay);
    const weekCount = d3.timeWeek.count(calendarStartDay, endDay) + 1;
    const width = weekCount * cellWidthWithPadding + leftPadding + 20;
    currentCalendarHeight = 7 * cellWidthWithPadding;
    const height = currentCalendarHeight + topPadding + 30;
    const maxMinutes = d3.max(valueMap.values());
    calendarColorScale.domain([0, maxMinutes || 1]);
    const svg = d3.select("#calendar").append("svg").attr("width", width).attr("height", height)
                  .append("g").attr("transform", `translate(${leftPadding}, ${topPadding})`);
    svgInstance = svg;
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    svg.selectAll(".day-label").data(d3.range(7)).enter().append("text").attr("class", "day-label").attr("x", -15)
       .attr("y", d => d * cellWidthWithPadding + cellWidthWithPadding / 2 - cellSize / 2).attr("dy", "0.35em").text(d => dayLabels[d]);
    svg.selectAll(".month-label").data(months).enter().append("text").attr("class", "month-label")
       .attr("x", d => getXFromDate(d3.max([calendarStartDay, d3.timeWeek.floor(d)]), calendarStartDay, cellWidthWithPadding))
       .attr("y", -10).text(formatMonth);
    const cells = svg.selectAll(".day-cell").data(allDaysInCalendar).enter().append("rect").attr("class", "day-cell")
       .attr("width", cellSize).attr("height", cellSize).attr("rx", 2).attr("ry", 2)
       .attr("x", d => getXFromDate(d, calendarStartDay, cellWidthWithPadding)).attr("y", d => d.getDay() * cellWidthWithPadding)
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
    selectedStartDate = dataStartDate; selectedEndDate = dataEndDate;
    drawHandles(selectedStartDate, selectedEndDate);
    updateFilterInfoLabel(selectedStartDate, selectedEndDate);
}

// --- Drag Handle Drawing & Events ---
function drawHandles(startDate, endDate) {
     if (!svgInstance || !calendarStartDay || !startDate || !endDate || isNaN(startDate) || isNaN(endDate) || currentCalendarHeight <= 0) return;
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
    startHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "start")).on("end", handleDragEnd));
     let endHandleGroup = svgInstance.select(".end-handle-group");
     if (endHandleGroup.empty()) {
        endHandleGroup = svgInstance.append("g").attr("class", "end-handle-group");
        endHandleGroup.append("line").attr("class", "drag-handle end-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round");
        endHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize");
     }
     endHandleGroup.attr("transform", `translate(${endX}, 0)`).selectAll("line").attr("y2", currentCalendarHeight + cellPadding);
     endHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "end")).on("end", handleDragEnd));
     updateHighlightRect();
}

function handleDragStart(event) {
     d3.select(this).raise().select(".drag-handle").attr("stroke", "black").attr("stroke-opacity", 0.7);
     svgInstance.select(".highlight-rect")?.raise();
     svgInstance.selectAll(".start-handle-group, .end-handle-group").raise();
}

function handleDrag(event, handleType) {
     if (!svgInstance || !calendarStartDay || allDaysInCalendar.length === 0 || !selectedStartDate || !selectedEndDate || currentCalendarHeight <= 0) return;
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
    selectedStartDate = newStartDate; selectedEndDate = newEndDate;
    updateHighlightRect(); updateFilterInfoLabel(selectedStartDate, selectedEndDate);
}

function handleDragEnd(event) {
     d3.select(this).select(".drag-handle").attr("stroke", handleColor).attr("stroke-opacity", 1.0);
     if (startDateInput && selectedStartDate) startDateInput.value = formatDateForInput(selectedStartDate);
     if (endDateInput && selectedEndDate) endDateInput.value = formatDateForInput(selectedEndDate);
     filterDataAndUpdateCharts(selectedStartDate, selectedEndDate);
}

function updateHighlightRect() {
     if (!svgInstance || !selectedStartDate || !selectedEndDate || !calendarStartDay || isNaN(selectedStartDate) || isNaN(selectedEndDate) || currentCalendarHeight <= 0) {
         svgInstance?.select(".highlight-rect").remove();
         return;
    }
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

function filterDataAndUpdateCharts(startDate, endDate) {
     if (!startDate || !endDate || !currentViewData || isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
        console.warn("filterDataAndUpdateCharts: Invalid date range or no data. Clearing dependent charts.", {startDate, endDate});
        handleBrushUpdate([]);
        updateFilterInfoLabel(startDate, endDate);
        return;
    }
    const filterStart = d3.timeDay.floor(new Date(startDate));
    const filterEnd = d3.timeDay.offset(d3.timeDay.floor(new Date(endDate)), 1);
    const filtered = currentViewData.filter(d => {
        const dDate = d.ts;
        return dDate instanceof Date && !isNaN(dDate) && dDate >= filterStart && dDate < filterEnd;
    });
    console.log(`Filtered data for ${formatDate(startDate)} to ${formatDate(endDate)}: ${filtered.length} records.`);
    updateFilterInfoLabel(startDate, endDate);
    handleBrushUpdate(filtered);
}

// --- Legend Drawing ---
function drawLegend(container, scale, maxValue) {
    container.innerHTML = ""; if (maxValue === undefined || maxValue <= 0) return;
    const legendWidth = 200, legendHeight = 20, legendMargin = { top: 0, right: 10, bottom: 15, left: 10 }, barHeight = 8;
    const legendSvg = d3.select(container).append("svg").attr("width", legendWidth).attr("height", legendHeight + legendMargin.top + legendMargin.bottom);
    const legendDefs = legendSvg.append("defs"); const linearGradient = legendDefs.append("linearGradient").attr("id", "calendar-gradient");
    const numStops = 10; const interpolator = typeof scale.interpolator === 'function' ? scale.interpolator() : (t => scale(maxValue * t));
    linearGradient.selectAll("stop").data(d3.range(numStops + 1)).enter().append("stop").attr("offset", d => `${(d / numStops) * 100}%`).attr("stop-color", d => interpolator(d / numStops));
    legendSvg.append("rect").attr("x", legendMargin.left).attr("y", legendMargin.top).attr("width", legendWidth - legendMargin.left - legendMargin.right).attr("height", barHeight).style("fill", "url(#calendar-gradient)").attr("rx", 2).attr("ry", 2);
    legendSvg.append("text").attr("class", "legend-label").attr("x", legendMargin.left).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "start").text("Less");
    legendSvg.append("text").attr("class", "legend-label").attr("x", legendWidth - legendMargin.right).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "end").text("More");
}

// --- Existing Chart Update Functions ---
function updateTopArtists(data) {
    const targetUl = document.getElementById('topArtists'); if (!targetUl) return; targetUl.innerHTML = "";
    if (!data || data.length === 0) { targetUl.innerHTML = `<li class="empty-message">No data.</li>`; return; }
    const artistData = d3.rollups( data.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.artist).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (artistData.length === 0) { targetUl.innerHTML = `<li class="empty-message">No artist data in this period.</li>`; return; }
    artistData.forEach(([artist, totalMinutes], index) => { const li = document.createElement("li"); li.innerHTML = `<span class="artist-name">${index + 1}. ${artist}</span> <span class="artist-time">(${formatTime(totalMinutes)})</span>`; targetUl.appendChild(li); });
}

function updateTopTracksChart(data) {
    const targetUl = document.getElementById('top-tracks-chart'); if (!targetUl) return; targetUl.innerHTML = "";
    if (!data || data.length === 0) { targetUl.innerHTML = `<li class="empty-message">No data.</li>`; return; }
    const trackData = d3.rollups( data.filter(d => d.track && d.track !== "Unknown Track" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.track).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (trackData.length === 0) { targetUl.innerHTML = `<li class="empty-message">No Track data in this period.</li>`; return; }
    trackData.forEach(([track, totalMinutes], index) => { const li = document.createElement("li"); li.innerHTML = `<span class="track-name">${index + 1}. ${track}</span> <span class="track-time">(${formatTime(totalMinutes)})</span>`; targetUl.appendChild(li); });
}



function updateTopTracksChart2(data) { // Renamed function
    const targetDiv = document.getElementById('top-tracks-chart');
    if (!targetDiv) return;
    targetDiv.innerHTML = ""; // Clear previous content
    if (!requiredColumns.track_name) { /* ... error handling ... */ return; }
    if (!data || data.length === 0) { /* ... no data message ... */ return; }

    // Data aggregation (same as before)
    const trackData = d3.rollups(data.filter(d => d.track && d.track !== "Unknown Track" && d.track !== "N/A" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => `${d.track} • ${d.artist}`).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (trackData.length === 0) { /* ... no track data message ... */ return; }

    // --- Create List Structure ---
    const list = d3.select(targetDiv).append("ol") // Use ordered list for ranking
        .attr("class", "top-tracks-sparkline-list"); // Add class for styling

    // --- Sparkline Configuration ---
    const maxMinutes = trackData[0][1]; // Duration of the #1 track
    const sparklineWidth = 80; // Width of the mini bar chart
    const sparklineHeight = 12; // Height of the mini bar chart
    const sparklineScale = d3.scaleLinear()
        .domain([0, maxMinutes || 1])
        .range([0, sparklineWidth]);

    // --- Bind Data and Create List Items ---
    const items = list.selectAll("li")
        .data(trackData)
        .join("li");

 
    items.append("span")
    .attr("class", "track-info")
    .html(d => {
       const parts = d[0].split('•');
       const trackName = parts[0] ? parts[0].trim() : 'Unknown Track';
       const artistName = parts[1] ? parts[1].trim() : 'Unknown Artist';
       // Insert <br> between track span and artist span
       // Also removed the "•" as it looks better on a separate line
       return `<span class="track-name">${trackName}</span><br><span class="track-artist">${artistName}</span>`; // NEW LINE with <br>
    });
    items.append("span")
         .attr("class", "track-time")
         .text(d => `(${formatTime(d[1])})`);

    // Add SVG for Sparkline
    const sparklineSvg = items.append("svg")
        .attr("class", "sparkline")
        .attr("width", sparklineWidth)
        .attr("height", sparklineHeight)
        .style("vertical-align", "middle") // Align with text
        .style("margin-left", "8px");

    // Add Sparkline Bar
    sparklineSvg.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 0) // Start at 0 for animation
        .attr("height", sparklineHeight)
        .attr("fill", "#1DB954")
        .attr("rx", 1) // Slight rounding
        .attr("ry", 1)
        .on("mouseover", (event, d) => showTooltip(event, `<b>${d[0]}</b><br>${formatTime(d[1])}`)) // Optional tooltip on bar
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)
        .transition().duration(500)
        .attr("width", d => sparklineScale(d[1])); // Animate width


}




function updateTimeOfDayChart(data) {
     const targetDiv = document.getElementById('time-of-day-chart'); // Use descriptive name
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
     svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickValues(d3.range(0, 24, 3))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("fill", "currentColor").attr("text-anchor", "middle").text("Hour of Day");
     svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("fill", "currentColor").attr("text-anchor", "middle").text("Total Listening Time");
     svg.selectAll(".bar").data(completeHourData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#fd7e14").on("mouseover", (event, d) => showTooltip(event, `<b>Hour ${d[0]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1])));
}

function updateDayOfWeekChart(data) {
     const targetDiv = document.getElementById('day-of-week-chart'); // Use descriptive name
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
     svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickFormat(d => dayOfWeekNames[d])).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("fill", "currentColor").attr("text-anchor", "middle").text("Day of Week");
     svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("fill", "currentColor").attr("text-anchor", "middle").text("Total Listening Time");
     svg.selectAll(".bar").data(completeDayData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#6f42c1").on("mouseover", (event, d) => showTooltip(event, `<b>${dayOfWeekNames[d[0]]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1])));
}

// --- Main Update Triggers ---
function handleBrushUpdate(filteredChartData) {
    const dataToUpdate = filteredChartData || [];
    updateTopArtists(dataToUpdate);
    updateTopTracksChart(dataToUpdate);
    updateTimeOfDayChart(dataToUpdate);
    updateDayOfWeekChart(dataToUpdate);
    drawStreamgraph(dataToUpdate, 'streamgraph-chart');
    drawForceGraph2(dataToUpdate, 'force-graph-chart'); // Use new function/ID
}

function updateVisualization(filteredData) {
     const chartsToClear = [
         topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv,
         document.getElementById('streamgraph-chart'),
         document.getElementById('force-graph-chart') // Use new ID
     ];
     selectedStartDate = null; selectedEndDate = null;
     if (!filteredData || filteredData.length === 0) {
        if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No data for selected period.</p>`; // Added check
        if (legendDiv) legendDiv.innerHTML = ""; // Added check
        chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
        updateFilterInfoLabel(null, null);
        handleBrushUpdate([]); // Explicitly clear dependent charts
        return;
    }
    const [viewStartDate, viewEndDate] = d3.extent(filteredData, d => d.ts);
    if (!viewStartDate || !viewEndDate || isNaN(viewStartDate) || isNaN(viewEndDate)) {
         console.error("updateVisualization: Invalid date range in data.");
         if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Invalid date range in data.</p>`; // Added check
         if (legendDiv) legendDiv.innerHTML = ""; // Added check
         chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
         updateFilterInfoLabel(null, null);
         handleBrushUpdate([]); // Clear charts on error too
         return;
    }
     drawCalendar(filteredData, viewStartDate, viewEndDate);
     filterDataAndUpdateCharts(viewStartDate, viewEndDate); // This will call handleBrushUpdate
}

// --- Event Listeners ---
yearSelect.onchange = () => {
     const selectedYear = +yearSelect.value;
     if (!selectedYear || isNaN(selectedYear)) {
        console.warn("Invalid year selected."); updateVisualization([]); return;
     }
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEndFilter = new Date(selectedYear + 1, 0, 1);
    const filteredByYear = allParsedData.filter(d => d.ts >= yearStart && d.ts < yearEndFilter);
    startDateInput.value = formatDateForInput(yearStart);
    endDateInput.value = formatDateForInput(new Date(selectedYear, 11, 31));
    updateVisualization(filteredByYear);
};

applyRangeBtn.onclick = () => {
     const startStr = startDateInput.value; const endStr = endDateInput.value;
     const startMs = Date.parse(startStr); const endMs = Date.parse(endStr);
     let start = !isNaN(startMs) ? d3.timeDay.floor(new Date(startMs)) : null;
     let end = !isNaN(endMs) ? d3.timeDay.floor(new Date(endMs)) : null;
    if (!start || !end) { alert("Invalid date format. Please use YYYY-MM-DD."); return; }
    if (start > end) {
        console.warn("Start date was after end date, swapping them.");
        [start, end] = [end, start];
        startDateInput.value = formatDateForInput(start);
        endDateInput.value = formatDateForInput(end);
    }
    const filterEnd = d3.timeDay.offset(end, 1);
    yearSelect.value = ""; // Clear year selection
    const filteredByRange = allParsedData.filter(d => d.ts >= start && d.ts < filterEnd);
    updateVisualization(filteredByRange);
};

// ============================================== //
// === CHART DRAWING FUNCTIONS ================ //
// ============================================== //

async function drawTimeline(fullData, containerId) {
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


async function drawStreamgraph(filteredData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    if (!filteredData || filteredData.length === 0) {
        container.innerHTML = '<p class="empty-message">No data available for the selected period.</p>';
        const descEl = container.nextElementSibling; if (descEl && descEl.classList.contains('chart-description')) descEl.innerHTML = 'Select a period in the calendar above to see the Music vs Podcast rate.';
        return;
    }
    const streamDataProcessed = filteredData.map(d => { let contentType = 'Music'; if (d.episode_name && String(d.episode_name).trim() !== "") contentType = 'Podcast'; return { ...d, contentType: contentType }; }).filter(d => d.ms_played > 0);
    if (streamDataProcessed.length === 0) { container.innerHTML = '<p class="empty-message">No Music or Podcast listening events found in this period.</p>'; return; }
    const contentTypes = ['Music', 'Podcast'];
    const [minDate, maxDate] = d3.extent(streamDataProcessed, d => d.ts);
    const timeDiffDays = (maxDate && minDate) ? (maxDate - minDate) / (1000 * 60 * 60 * 24) : 0;
    const timeAggregator = timeDiffDays > 60 ? d3.timeDay.floor : d3.timeHour.floor;
    const timeFormatString = timeDiffDays > 60 ? "%Y-%m-%d" : "%H:%M %a %d";
    console.log(`Streamgraph: Period length ${timeDiffDays.toFixed(1)} days. Aggregating by ${timeDiffDays > 60 ? 'Day' : 'Hour'}.`);
    const aggregatedData = Array.from( d3.group(streamDataProcessed, d => timeAggregator(d.ts)), ([timeBin, values]) => { const entry = { timeBin: new Date(timeBin) }; let totalMsPlayedInBin = 0; contentTypes.forEach(type => entry[type] = 0); values.forEach(v => { if (entry.hasOwnProperty(v.contentType)) { entry[v.contentType] += v.ms_played; totalMsPlayedInBin += v.ms_played; } }); entry.totalMinutes = totalMsPlayedInBin / 60000; contentTypes.forEach(type => { entry[type] = (totalMsPlayedInBin > 0) ? (entry[type] / totalMsPlayedInBin) : 0; }); return entry; }).sort((a, b) => a.timeBin - b.timeBin);
    if (aggregatedData.length === 0) { container.innerHTML = '<p class="empty-message">Could not aggregate data for proportions in this period.</p>'; return; }
    const margin = { top: 20, right: 30, bottom: 40, left: 50 }; const containerWidth = container.clientWidth || 800; const height = 300 - margin.top - margin.bottom; const width = containerWidth - margin.left - margin.right;
    if (width <= 0 || height <= 0) { container.innerHTML = `<p class="error-message">Container too small for chart.</p>`; return; }
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    const xScale = d3.scaleTime().domain(d3.extent(aggregatedData, d => d.timeBin)).range([0, width]); const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);
    const colorMap = { 'Music': '#1DB954', 'Podcast': '#6f42c1' }; const colorScale = d3.scaleOrdinal().domain(contentTypes).range(contentTypes.map(type => colorMap[type]));
    const stack = d3.stack().keys(contentTypes).offset(d3.stackOffsetNone).order(d3.stackOrderInsideOut);
    let series; try { series = stack(aggregatedData); } catch (error) { console.error("Streamgraph - Error during stacking:", error); container.innerHTML = '<p class="error-message">Error processing data for stacking.</p>'; return; }
    if (series.length === 0 || !series[0] || series[0].length === 0) { const nonZeroTypes = contentTypes.filter(type => aggregatedData.some(d => d[type] > 0)); if (nonZeroTypes.length === 1) { console.warn(`Streamgraph - Only found data for: ${nonZeroTypes[0]}. Drawing single layer.`); series = nonZeroTypes.map(key => { const layer = aggregatedData.map((d, i) => { const point = [0, d[key]]; point.data = d; return point; }); layer.key = key; return layer; }); } else { container.innerHTML = '<p class="empty-message">No stack layers generated (no music/podcast data found?).</p>'; return; } }
    const areaGen = d3.area().x(d => xScale(d.data.timeBin)).y0(d => yScale(d[0])).y1(d => yScale(d[1])).curve(d3.curveBasis);
    svg.selectAll(".stream-layer").data(series).enter().append("path").attr("class", d => `stream-layer ${String(d.key).toLowerCase()}-layer`).attr("d", areaGen).attr("fill", d => colorScale(d.key)).attr("stroke", "#fff").attr("stroke-width", 0.5)
        .on("mouseover", (event, d_layer) => { const [pointerX] = d3.pointer(event, svg.node()); const hoveredDate = xScale.invert(pointerX); const bisectDate = d3.bisector(d => d.timeBin).left; const index = bisectDate(aggregatedData, hoveredDate, 1); const d0 = aggregatedData[index - 1]; const d1 = aggregatedData[index]; const closestData = (d1 && d0 && (hoveredDate - d0.timeBin > d1.timeBin - hoveredDate)) ? d1 : d0; let tooltipContent = `<b>${d_layer.key}</b><br>(No time data)`; if (closestData) { tooltipContent = `<b>Time: ${d3.timeFormat(timeFormatString)(closestData.timeBin)}</b><br>Total Listen: ${formatTime(closestData.totalMinutes)}<br><hr>`; contentTypes.forEach(type => { const percentage = (closestData[type] * 100).toFixed(1); const isHoveredType = type === d_layer.key; tooltipContent += `${isHoveredType ? '<b>' : ''}${type}: ${percentage}%${isHoveredType ? '</b>' : ''}<br>`; }); } svg.selectAll(".stream-layer").style("fill-opacity", 0.3); d3.select(event.currentTarget).style("fill-opacity", 1).attr("stroke", "#000").attr("stroke-width", 1.5); showTooltip(event, tooltipContent.trim()); })
        .on("mousemove", moveTooltip).on("mouseout", (event, d) => { svg.selectAll(".stream-layer").style("fill-opacity", 1).attr("stroke", "#fff").attr("stroke-width", 0.5); hideTooltip(); });
    let xAxisTicks; if (timeDiffDays <= 2) xAxisTicks = d3.timeHour.every(6); else if (timeDiffDays <= 14) xAxisTicks = d3.timeDay.every(1); else if (timeDiffDays <= 90) xAxisTicks = d3.timeWeek.every(1); else xAxisTicks = d3.timeMonth.every(1);
    svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale).ticks(xAxisTicks).tickFormat(d3.timeFormat(timeDiffDays > 30 ? "%b %Y" : "%a %d"))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", margin.bottom - 10).attr("fill", "currentColor").attr("text-anchor", "middle").text("Date / Time");
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".0%")); svg.append("g").attr("class", "axis axis--y").call(yAxis).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - margin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("fill", "currentColor").attr("text-anchor", "middle").text("Listening Time Rate (%)");
    const legendContainer = svg.append("g").attr("class", "streamgraph-legend").attr("transform", `translate(${width - 100}, ${-10})`); const legendItems = legendContainer.selectAll(".legend-item").data(contentTypes).enter().append("g").attr("class", "legend-item").attr("transform", (d, i) => `translate(0, ${i * 15})`); legendItems.append("rect").attr("x", 0).attr("y", 0).attr("width", 10).attr("height", 10).attr("fill", d => colorScale(d)); legendItems.append("text").attr("x", 15).attr("y", 5).attr("dy", "0.35em").style("font-size", "10px").text(d => d);
    const descriptionElement = container.nextElementSibling; if (descriptionElement && descriptionElement.classList.contains('chart-description')) descriptionElement.innerHTML = "Shows the proportional rate (%) of listening time between Music and Podcasts for the time period selected above.";
}




async function drawForceGraph(filteredData, containerId, topN = 10) {
    const container = document.getElementById(containerId);

    // --- Robust Initial Checks ---
    if (!container) {
        console.error(`drawForceGraph Error: Container element with ID "${containerId}" not found.`);
        return;
    }
    container.innerHTML = ""; // Clear previous content

    if (!filteredData || filteredData.length < 2) {
        container.innerHTML = '<p class="empty-message">Not enough data in this period to show transitions.</p>';
        return;
    }

    // --- Data Preparation (Same as before) ---
    const musicData = filteredData.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0)
                                 .sort((a, b) => a.ts - b.ts);
    if (musicData.length < 2) { /* ... */ container.innerHTML = '<p>...</p>'; return; }
    const artistCounts = d3.rollup(musicData, v => v.length, d => d.artist);
    const topArtistsMap = new Map( Array.from(artistCounts.entries()).sort(([, countA], [, countB]) => countB - countA).slice(0, topN) );
    if (topArtistsMap.size < 2) { /* ... */ container.innerHTML = '<p>...</p>'; return; }
    const transitions = new Map();
    for (let i = 0; i < musicData.length - 1; i++) { const sourceArtist = musicData[i].artist; const targetArtist = musicData[i + 1].artist; if (topArtistsMap.has(sourceArtist) && topArtistsMap.has(targetArtist) && sourceArtist !== targetArtist) { const key = `${sourceArtist}:::${targetArtist}`; transitions.set(key, (transitions.get(key) || 0) + 1); } }
    if (transitions.size === 0) { /* ... */ container.innerHTML = '<p>...</p>'; return; }
    const nodes = Array.from(topArtistsMap.keys()).map(artist => ({ id: artist, playCount: topArtistsMap.get(artist) || 0 }));
    const links = Array.from(transitions.entries()).map(([key, count]) => { const [source, target] = key.split(":::"); return { source: source, target: target, value: count }; });
    // --- End Data Preparation ---

    // --- D3 Force Simulation Setup ---
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const containerWidth = container.clientWidth || 600;
    const containerHeight = 400; // Keep height fixed, adjust if needed for your layout
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) { /* ... */ container.innerHTML = '<p>...</p>'; return; }

    // --- SVG Setup with Zoom ---
    const svg = d3.select(container).append("svg")
        .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
        .attr("preserveAspectRatio", "xMinYMid meet");
        // Note: No transform applied to svg itself

    // Add group for MARGINS
    const mainGroup = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Add the group that will ACTUALLY be transformed by zoom/pan
    const zoomableGroup = mainGroup.append("g");

    // OPTIONAL: Background rectangle to catch zoom events across the whole area
    // If you attach zoom to svg, this might not be strictly needed, but can be helpful
    mainGroup.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "none")
        .attr("pointer-events", "all"); // Make sure it captures events

    // --- Scales (Same as before) ---
    const minRadius = 4, maxRadius = 12;
    const nodeRadiusScale = d3.scaleSqrt().domain([0, d3.max(nodes, d => d.playCount) || 1]).range([minRadius, maxRadius]);
    const maxStrokeWidth = 5;
    const linkWidthScale = d3.scaleLinear().domain([0, d3.max(links, d => d.value) || 1]).range([1, maxStrokeWidth]);

    // --- Force Simulation (Using adjusted values from previous step) ---
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(80).strength(0.5)) // Increased distance
        .force("charge", d3.forceManyBody().strength(-150)) // Increased repulsion
        .force("center", d3.forceCenter(width / 2, height / 2)) // Center within the margin-adjusted area
        .force("collide", d3.forceCollide().radius(d => nodeRadiusScale(d.playCount) + 5).strength(0.7)); // Increased collision buffer

    // --- Draw Links (Lines) - Appended to zoomableGroup ---
    const link = zoomableGroup.append("g") // Changed from svg to zoomableGroup
        .attr("class", "force-links")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
          .attr("stroke-width", d => linkWidthScale(d.value));
    link.append("title").text(d => `${d.source.id} → ${d.target.id}\n${d.value} transitions`);

    // --- Draw Nodes (Circles) - Appended to zoomableGroup ---
    const node = zoomableGroup.append("g") // Changed from svg to zoomableGroup
        .attr("class", "force-nodes")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.0)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
          .attr("r", d => nodeRadiusScale(d.playCount))
          .attr("fill", "#1DB954")
          .call(drag(simulation)); // Drag behavior still works
    node.append("title").text(d => `${d.id}\n${d.playCount} plays in period`);

    // --- Draw Labels (Text) - Appended to zoomableGroup ---
    const labels = zoomableGroup.append("g") // Changed from svg to zoomableGroup
        .attr("class", "force-labels")
        .attr("font-family", "sans-serif")
        .attr("font-size", 9) // Font size might need adjustment depending on zoom
        .attr("fill", "#333")
        .attr("pointer-events", "none") // Prevent labels interfering with node drag/zoom
        .selectAll("text")
        .data(nodes)
        .join("text")
          .attr("dx", d => nodeRadiusScale(d.playCount) + 3)
          .attr("dy", "0.35em")
          .text(d => d.id);

    // --- Simulation Tick Handler (Updates elements within zoomableGroup) ---
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        labels // Update label positions too
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    });

    // --- Define Zoom Handler ---
    function zoomed(event) {
        // Apply the transformations (pan and zoom) to the zoomableGroup
        zoomableGroup.attr("transform", event.transform);
        // Optional: Adjust label font size based on zoom?
        // labels.attr("font-size", 9 / event.transform.k); // Example: smaller when zoomed out
    }

    // --- Create and Configure Zoom Behavior ---
    const zoom = d3.zoom()
        .scaleExtent([0.3, 7]) // Limit zoom: e.g., 30% to 700%
        .extent([[0, 0], [width, height]]) // Define panning area (within margins)
        .translateExtent([[0, 0], [width, height]]) // Prevent panning outside the box
        .on("zoom", zoomed); // Call the 'zoomed' function on zoom events

    // --- Attach Zoom Behavior to the SVG ---
    // Interactions on the main SVG area will trigger zoom/pan
    svg.call(zoom);

    // Optional: Disable double-click zoom if it conflicts with other interactions
    svg.on("dblclick.zoom", null);


    // --- Drag Functions (remain the same) ---
    function drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
        }
        function dragged(event, d) {
            d.fx = event.x; d.fy = event.y;
        }
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
        }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }
}

async function drawForceGraph2(filteredData, containerId, topN = 10) {
    const container = document.getElementById(containerId);

    // --- Robust Initial Checks ---
    if (!container) {
        console.error(`drawForceGraph Error: Container element with ID "${containerId}" not found.`);
        return;
    }
    container.innerHTML = ""; // Clear previous content

    if (!filteredData || filteredData.length < 2) {
        container.innerHTML = '<p class="empty-message">Not enough data in this period to show transitions (need at least 2 plays).</p>';
        const descEl = container.nextElementSibling;
        if (descEl && descEl.classList.contains('chart-description')) {
            descEl.innerHTML = 'Select a period with more listening history to view artist transitions.';
        }
        return;
    }

    // --- Data Preparation ---
    const musicData = filteredData
        .filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0)
        .sort((a, b) => a.ts - b.ts); // Sort by time to get transitions right

    if (musicData.length < 2) {
        container.innerHTML = '<p class="empty-message">Not enough *music* plays in this period to show transitions.</p>';
        return;
    }

    // Aggregate play counts for top N artists
    const artistCounts = d3.rollup(musicData, v => v.length, d => d.artist);
    const topArtistsMap = new Map(
        Array.from(artistCounts.entries())
             .sort(([, countA], [, countB]) => countB - countA)
             .slice(0, topN)
    );

    if (topArtistsMap.size < 2) {
        container.innerHTML = `<p class="empty-message">Fewer than 2 distinct top artists found in this period. Cannot draw transitions.</p>`;
        return;
    }

    // Calculate transitions *only* between the top N artists
    const transitions = new Map();
    for (let i = 0; i < musicData.length - 1; i++) {
        const sourceArtist = musicData[i].artist;
        const targetArtist = musicData[i + 1].artist;
        // Only count if *both* are in the top N and they are different artists
        if (topArtistsMap.has(sourceArtist) && topArtistsMap.has(targetArtist) && sourceArtist !== targetArtist) {
            const key = `${sourceArtist}:::${targetArtist}`; // Use a separator unlikely in names
            transitions.set(key, (transitions.get(key) || 0) + 1);
        }
    }

    if (transitions.size === 0) {
        container.innerHTML = '<p class="empty-message">No transitions found *between* the top artists in this period.</p>';
        return;
    }

    // Prepare nodes and links for D3 simulation
    const nodes = Array.from(topArtistsMap.keys()).map(artist => ({
        id: artist,
        playCount: topArtistsMap.get(artist) || 0
    }));

    const links = Array.from(transitions.entries()).map(([key, count]) => {
        const [source, target] = key.split(":::");
        return {
            source: source, // D3 simulation will resolve these to node objects
            target: target,
            value: count // Number of transitions
        };
    });
    // --- End Data Preparation ---


    // --- D3 Force Simulation Setup ---
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const containerWidth = container.clientWidth || 600;
    const containerHeight = 400; // Fixed height, adjust if needed
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) {
        container.innerHTML = '<p class="error-message">Container is too small to draw the graph.</p>';
        return;
    }

    // --- SVG Setup with Zoom ---
    const svg = d3.select(container).append("svg")
        .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
        .attr("preserveAspectRatio", "xMinYMid meet")
        .style("max-width", "100%") // Ensure responsiveness
        .style("height", "auto");   // Ensure responsiveness

    // Add group for MARGINS
    const mainGroup = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Add the group that will ACTUALLY be transformed by zoom/pan
    const zoomableGroup = mainGroup.append("g");

    // Background rectangle to catch zoom events (optional but good practice)
    mainGroup.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "none")
        .attr("pointer-events", "all");

    // --- Define Arrowhead Marker ---
    zoomableGroup.append("defs").append("marker") // Append defs to zoomableGroup
        .attr("id", "arrowhead")
        .attr("viewBox", "-0 -5 10 10") // Adjust viewBox as needed
        .attr("refX", 15) // Distance arrow sits away from node center (tune with node radius)
        .attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("xoverflow", "visible")
        .append("svg:path")
        .attr("d", "M 0,-5 L 10 ,0 L 0,5") // Arrow shape
        .attr("fill", "#999") // Arrow color
        .style("stroke", "none");


    // --- Scales ---
    const minRadius = 5, maxRadius = 15; // Slightly larger radii
    const playCountExtent = d3.extent(nodes, d => d.playCount);
    const nodeRadiusScale = d3.scaleSqrt()
        .domain([playCountExtent[0] || 0, playCountExtent[1] || 1])
        .range([minRadius, maxRadius]);

    // NEW: Node Color Scale (using Viridis - good for colorblindness)
    const nodeColorScale = d3.scaleSequential(d3.interpolateViridis)
         // Use 0 as min if extent[0] is 0 or undefined, prevents issues if min playcount > 0
        .domain([playCountExtent[1] || 1, 0]);


    const maxStrokeWidth = 6; // Slightly thicker max link
    const linkWidthScale = d3.scaleLinear()
        .domain([0, d3.max(links, d => d.value) || 1])
        .range([1, maxStrokeWidth]); // Start from 1px

    // --- Force Simulation ---
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id)
            .distance(90) // Increased distance
            .strength(link => 1 / Math.min(link.source.playCount, link.target.playCount)) // Weaker links between popular nodes
        )
        .force("charge", d3.forceManyBody().strength(-180)) // Increased repulsion
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => nodeRadiusScale(d.playCount) + 6).strength(0.8)); // Increased collision buffer

    // --- Adjacency List for Hover ---
    const linkedByIndex = {};
    links.forEach(d => {
        linkedByIndex[`${d.source.id},${d.target.id}`] = 1;
    });

    function areNeighbors(a, b) {
        return linkedByIndex[`${a.id},${b.id}`] || linkedByIndex[`${b.id},${a.id}`] || a.id === b.id;
    }

    // --- Draw Links (Lines) - Appended to zoomableGroup ---
    const link = zoomableGroup.append("g")
        .attr("class", "force-links")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.5) // Slightly more transparent default
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => linkWidthScale(d.value))
        .attr("marker-end", "url(#arrowhead)"); // Apply the marker

    link.append("title") // Basic HTML tooltip for links
        .text(d => `${d.source.id} → ${d.target.id}\n${d.value} transitions`);

    // --- Draw Nodes (Circles) - Appended to zoomableGroup ---
    const node = zoomableGroup.append("g")
        .attr("class", "force-nodes")
        .attr("stroke", "#fff") // White border for contrast
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", d => nodeRadiusScale(d.playCount))
        .attr("fill", d => nodeColorScale(d.playCount)) // Use color scale
        .call(drag(simulation)); // Attach drag behavior

    node.append("title") // Basic HTML tooltip for nodes
        .text(d => `${d.id}\n${d.playCount} plays in period`);

    // --- Draw Labels (Text) - Appended to zoomableGroup ---
    const labels = zoomableGroup.append("g")
        .attr("class", "force-labels")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10) // Slightly larger font
        .attr("fill", "#333")
        .attr("stroke", "white") // White outline for readability
        .attr("stroke-width", 0.3)
        .attr("paint-order", "stroke") // Draw stroke first, then fill
        .attr("pointer-events", "none") // Prevent labels interfering
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("dx", d => nodeRadiusScale(d.playCount) + 4) // Position based on radius
        .attr("dy", "0.35em")
        .text(d => d.id);


    // --- Hover Interaction ---
    node.on("mouseover", highlight)
        .on("mouseout", unhighlight);
    link.on("mouseover", highlightLink) // Optional: highlight link itself slightly more
        .on("mouseout", unhighlightLink)

    function highlight(event, d_hovered) {
        const opacity = 0.15; // How much to fade others
        node.style("opacity", n => areNeighbors(d_hovered, n) ? 1 : opacity);
        node.style("stroke", n => n === d_hovered ? 'black' : '#fff'); // Highlight border of hovered
        node.style("stroke-width", n => n === d_hovered ? 2.5 : 1.5);

        link.style("stroke-opacity", l => (l.source === d_hovered || l.target === d_hovered) ? 0.9 : opacity * 0.5);
        link.select("path") // Select the path inside the marker
            .style("fill", l => (l.source === d_hovered || l.target === d_hovered) ? "#555" : "#ccc"); // Darken arrow if connected

        labels.style("opacity", n => areNeighbors(d_hovered, n) ? 1 : opacity);
    }

    function unhighlight() {
        node.style("opacity", 1);
        node.style("stroke", '#fff');
        node.style("stroke-width", 1.5);
        link.style("stroke-opacity", 0.5); // Restore default link opacity
        link.select("path").style("fill", "#999"); // Restore default arrow color
        labels.style("opacity", 1);
    }

     function highlightLink(event, d_hovered) {
        d3.select(event.currentTarget)
          .style("stroke-opacity", 1)
          .style("stroke", "#333")
          .attr("stroke-width", linkWidthScale(d_hovered.value) + 1); // Slightly thicker
        d3.select(event.currentTarget).select("path").style("fill", "#333"); // Darken arrow
     }

    function unhighlightLink(event, d_hovered) {
         d3.select(event.currentTarget)
           .style("stroke-opacity", 0.5) // Check if also node-hovered before setting final opacity? Simpler to just reset.
           .style("stroke", "#999")
           .attr("stroke-width", linkWidthScale(d_hovered.value));
         d3.select(event.currentTarget).select("path").style("fill", "#999");
         // Re-apply node hover if necessary (could happen if mouse moves quickly off link onto node)
         const relatedNode = d3.select(".force-nodes circle[style*='stroke: black']").datum(); // Find if a node is actively hovered
         if (relatedNode) {
             highlight(null, relatedNode); // Re-trigger highlight based on node state
         }
    }

    // --- Simulation Tick Handler ---
    simulation.on("tick", () => {
        // Update link positions, adjusting for node radius + arrow offset
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        // Update node positions
        node.attr("cx", d => d.x)
            .attr("cy", d => d.y);

        // Update label positions
        labels.attr("x", d => d.x)
              .attr("y", d => d.y);
    });

    // --- Define Zoom Handler ---
    function zoomed(event) {
        zoomableGroup.attr("transform", event.transform);
        // Optional: Adjust arrow size/stroke width based on zoom? (Can get complex)
        // const k = event.transform.k;
        // link.attr("stroke-width", d => linkWidthScale(d.value) / k);
        // node.attr("stroke-width", 1.5 / k);
    }

    // --- Create and Configure Zoom Behavior ---
    const zoom = d3.zoom()
        .scaleExtent([0.2, 8]) // Wider zoom range
        .extent([[0, 0], [width, height]])
        .translateExtent([[0, 0], [width, height]]) // Limit panning
        .on("zoom", zoomed);

    // --- Attach Zoom Behavior to the SVG ---
    svg.call(zoom);
    svg.on("dblclick.zoom", null); // Disable double-click zoom

    // --- Drag Functions (remain the same) ---
    function drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
            d3.select(this).raise(); // Bring dragged node to front
        }
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            // Only unfix if not actively zooming/panning (prevents jitter)
            if (!event.sourceEvent || !event.sourceEvent.type.includes('zoom')) {
               d.fx = null;
               d.fy = null;
            }
             // Reapply hover if needed after drag ends
             if (d3.select(this).style("opacity") == 1) { // Check if it *should* be highlighted
                 highlight(event, d);
             }
        }
        return d3.drag()
                 .on("start", dragstarted)
                 .on("drag", dragged)
                 .on("end", dragended);
    }

    // Update description
    const descEl = container.nextElementSibling;
    if (descEl && descEl.classList.contains('chart-description')) {
        descEl.innerHTML = `Shows transitions between the top ${nodes.length} most played artists in the selected period. Node size/color indicates play count. Link thickness indicates transition frequency. Hover over nodes to highlight connections. Pan/Zoom enabled.`;
    }
}

