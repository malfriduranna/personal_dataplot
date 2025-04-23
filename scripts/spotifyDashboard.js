// // --- Configuration ---
// const cellSize = 9;
// const cellPadding = 1.5;
// const leftPadding = 40;
// const topPadding = 25;
// const noDataColor = "#ebedf0";
// const calendarColorScale = d3.scaleSequential(d3.interpolateBlues);
// const chartMargin = { top: 20, right: 20, bottom: 60, left: 70 };

// // --- Handle Configuration ---
// const handleWidth = 3;
// const handleColor = "#e63946";
// const handleGrabAreaWidth = 10;
// const highlightColor = "rgba(108, 117, 125, 0.2)";

// // --- DOM Elements ---
// // Use the correct ID from your wrapped_page.html
// const wrappedYearSelect = document.getElementById('wrappedYearSelect');
// // Add a check to make sure it's found
// console.log("Found #wrappedYearSelect element:", wrappedYearSelect);
// const startDateInput = document.getElementById('startDate');
// const endDateInput = document.getElementById('endDate');
// const applyRangeBtn = document.getElementById('applyRangeBtn');
// const calendarDiv = document.getElementById('calendar');
// const legendDiv = document.getElementById('legend');
// const topArtistsUl = document.getElementById('topArtists');
// const tooltipDiv = d3.select("#tooltip"); // Keep using d3.select for the tooltip div
// const topTracksDiv = document.getElementById('top-tracks-chart');
// const timeOfDayDiv = document.getElementById('time-of-day-chart');
// const dayOfWeekDiv = document.getElementById('day-of-week-chart');
// const filterInfoSpan = document.getElementById('current-filter-info');
// // No need to declare containers globally if accessed via getElementById within functions

// // --- Helper Functions ---
// const formatDay = d3.timeFormat("%Y-%m-%d");
// const formatDate = d3.timeFormat("%a, %b %d, %Y");
// const formatMonth = d3.timeFormat("%b");
// const formatTime = (mins) => {
//     if (mins === undefined || mins === null || isNaN(mins)) return "N/A";
//     if (mins < 1 && mins > 0) return `< 1 min`;
//     if (mins <= 0) return `0 min`;
//     if (mins < 60) return `${Math.round(mins)} min`;
//     const hours = Math.floor(mins / 60);
//     const remainingMins = Math.round(mins % 60);
//     return `${hours}h ${remainingMins}m`;
// };
// const formatDateForInput = d3.timeFormat("%Y-%m-%d");
// const dayOfWeekNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// // --- Global variables ---
// let allParsedData = [];
// let requiredColumns = {
//     track_name: false, platform: false, skipped: false, episode_name: false,
//     episode_show_name: false, audiobook_title: false, audiobook_chapter_title: false,
//     reason_start: false, reason_end: false, artist: false, shuffle: false,
//     album: false, conn_country: false,
// };
// let currentViewData = [];
// let selectedStartDate = null;
// let selectedEndDate = null;
// let svgInstance = null; // Specific to calendar
// let allDaysInCalendar = [];
// let calendarStartDay = null;
// let cellWidthWithPadding = cellSize + cellPadding;
// let currentCalendarHeight = 0;

// // --- Data Processing (Runs once) ---
// (async function loadData() {
//     try {
//         const rawData = await d3.csv("data/astrid_data.csv");

//         // Detect available columns
//         const columns = new Set(rawData.columns);
//         const columnMapping = {
//             track_name: 'master_metadata_track_name', artist: 'master_metadata_album_artist_name',
//             album: 'master_metadata_album_album_name', platform: 'platform', skipped: 'skipped',
//             shuffle: 'shuffle', episode_name: 'episode_name', episode_show_name: 'episode_show_name',
//             audiobook_title: 'audiobook_title', audiobook_chapter_title: 'audiobook_chapter_title',
//             reason_start: 'reason_start', reason_end: 'reason_end', conn_country: 'conn_country'
//         };
//         Object.keys(columnMapping).forEach(key => {
//             requiredColumns[key] = columns.has(columnMapping[key]);
//         });

//         allParsedData = rawData.map(d => ({
//             ts: new Date(d.ts), ms_played: +d.ms_played, platform: d.platform,
//             conn_country: d.conn_country, artist: d.master_metadata_album_artist_name || "Unknown Artist",
//             track: requiredColumns.track_name ? (d.master_metadata_track_name || "Unknown Track") : "N/A",
//             album: d.master_metadata_album_album_name, episode_name: d.episode_name,
//             episode_show_name: d.episode_show_name, audiobook_title: d.audiobook_title,
//             audiobook_chapter_title: d.audiobook_chapter_title,
//             skipped: ['true', '1', true].includes(String(d.skipped).toLowerCase()),
//             shuffle: ['true', '1', true].includes(String(d.shuffle).toLowerCase()),
//             reason_start: d.reason_start, reason_end: d.reason_end,
//         })).filter(d =>
//             d.ts instanceof Date && !isNaN(d.ts) &&
//             typeof d.ms_played === 'number' && !isNaN(d.ms_played) && d.ms_played >= 0
//         );

//         console.log(`Loaded and parsed ${allParsedData.length} valid records.`);

//         const years = [...new Set(allParsedData.map(d => d.ts.getFullYear()))].sort((a, b) => a - b);
//         console.log("Available years found in data:", years); 

//         // --- CORRECTED: Handle case where no valid data is found after parsing ---
//         if (allParsedData.length === 0) {
//             // Check if elements exist before setting innerHTML
//             if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">No valid data found after processing the CSV.</p>`;
//             if (filterInfoSpan) filterInfoSpan.textContent = 'No data loaded';

//             //  const timelineChart = document.getElementById('timeline-chart');
//             //  if (timelineChart) timelineChart.innerHTML = `<p class="empty-message">No data.</p>`;

//              const streamgraphChart = document.getElementById('streamgraph-chart');
//              if (streamgraphChart) streamgraphChart.innerHTML = `<p class="empty-message">No data.</p>`;

//              const forceGraphChart = document.getElementById('force-graph-chart');
//              if (forceGraphChart) forceGraphChart.innerHTML = `<p class="empty-message">No data.</p>`;

//              [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv].forEach(el => {
//                  if (el) el.innerHTML = `<p class="empty-message">No data.</p>`;
//              });
//             return; // Stop execution if no data
//         }
//         // --- END CORRECTION ---

//         // Populate Year Select dropdown
//         // Check if the dropdown element exists before trying to append
//         if (wrappedYearSelect) {
//             years.forEach(y => {
//             const opt = document.createElement('option');
//             opt.value = y;
//             opt.textContent = y;
//             wrappedYearSelect.appendChild(opt); // <<< Use wrappedYearSelect
//             });
//         } else {
//             console.error("Cannot append year options: #wrappedYearSelect not found.");
//         }

//         // --- Initial Load ---
//         const defaultYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
//         if (wrappedYearSelect) { // Check again before using
//             wrappedYearSelect.value = defaultYear;
//             wrappedYearSelect.dispatchEvent(new Event('change')); // Trigger initial load
//        }
//         // --- DRAW CHARTS THAT ONLY NEED TO BE DRAWN ONCE ---
//         console.log("Drawing initial Timeline...");
//         // drawTimeline(allParsedData, 'timeline-chart');
//         // REMOVED: drawSankey(allParsedData, 'sankey-chart', 10); // No longer calling Sankey

//          // Initially clear the containers that depend on selection
//         //  const streamgraphContainer = document.getElementById('streamgraph-chart');
//         //  if (streamgraphContainer) {
//         //      streamgraphContainer.innerHTML = '<p class="empty-message">Select a period in the calendar above to view Music vs Podcast rate.</p>';
//         //      const descEl = streamgraphContainer.nextElementSibling;
//         //      console.log("descEl:", descEl);
//         //      if (descEl) {
//         //         console.log("descEl.classList:", descEl.classList);
//         //         console.log("descEl.classList.contains:", typeof descEl.classList.contains);
            
//         //         if (descEl.classList.contains('chart-description')) {
//         //             console.log("✅ descEl has class 'chart-description'");
//         //             descEl.innerHTML = 'Select a period in the calendar above to see the Music vs Podcast rate.';
//         //         } else {
//         //             console.warn("⚠️ descEl does NOT have class 'chart-description'");
//         //         }
//         //     } else {
//         //         console.warn("⚠️ descEl is null or undefined");
//         //     }
//         //  }
//         //  const forceGraphContainer = document.getElementById('force-graph-chart');
//         //  if (forceGraphContainer) {
//         //     forceGraphContainer.innerHTML = '<p class="empty-message">Select a period in the calendar above to view artist transitions.</p>';
//         //     const descEl = forceGraphContainer.nextElementSibling;
//         //     if (descEl && descEl.classList.contains('chart-description')) {
//         //         descEl.innerHTML = 'Select a period in the calendar above to view artist transitions.';
//         //     }
//         //  }

//     } catch (error) {
//         console.error("Error loading or processing data:", error);
//         // --- CORRECTED: Catch block ---
//         if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Error loading data. Check console for details.</p>`;
//         if (filterInfoSpan) filterInfoSpan.textContent = 'Error loading data';

//         // const timelineChart = document.getElementById('timeline-chart');
//         // if (timelineChart) timelineChart.innerHTML = `<p class="error-message">Error loading data.</p>`;

//         const streamgraphChart = document.getElementById('streamgraph-chart');
//         if (streamgraphChart) streamgraphChart.innerHTML = `<p class="error-message">Error loading data.</p>`;

//         const forceGraphChart = document.getElementById('force-graph-chart');
//         if (forceGraphChart) forceGraphChart.innerHTML = `<p class="error-message">Error loading data.</p>`;

//         [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv].forEach(el => {
//             if (el) el.innerHTML = `<p class="error-message">Error loading data.</p>`;
//         });
//         // --- END CORRECTION ---
//     }
// })(); // Immediately invoke the async function


// // --- Tooltip Logic ---
// const showTooltip = (event, content) => {
//     tooltipDiv.style("opacity", 1).html(content)
//         .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
// };
// const moveTooltip = (event) => {
//     tooltipDiv.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
// };
// const hideTooltip = () => {
//     tooltipDiv.style("opacity", 0);
// };

// // --- Calendar Dragging Helper Functions ---
// function getXFromDate(date, firstDayOfGrid, columnWidth) {
//     if (!date || !firstDayOfGrid || isNaN(date) || isNaN(firstDayOfGrid) || !columnWidth || columnWidth <= 0) return NaN;
//     const startOfWeekGrid = d3.timeWeek.floor(firstDayOfGrid);
//     const startOfWeekDate = d3.timeWeek.floor(date);
//     if (startOfWeekDate < startOfWeekGrid) return 0;
//     const weekIndex = d3.timeWeek.count(startOfWeekGrid, startOfWeekDate);
//     return weekIndex * columnWidth;
// }

// function getDateFromX(xPos, daysArray, firstDayOfGrid, columnWidth) {
//      if (!daysArray || daysArray.length === 0 || !firstDayOfGrid || !columnWidth || columnWidth <= 0 || xPos < -columnWidth / 2) return null;
//     const maxWeekIndex = d3.timeWeek.count(d3.timeWeek.floor(firstDayOfGrid), d3.timeWeek.floor(daysArray[daysArray.length - 1]));
//     const calculatedIndex = Math.floor((xPos + columnWidth / 2) / columnWidth);
//     const weekIndex = Math.max(0, Math.min(calculatedIndex, maxWeekIndex));
//     const startOfWeekGrid = d3.timeWeek.floor(firstDayOfGrid);
//     const targetWeekStartDate = d3.timeWeek.offset(startOfWeekGrid, weekIndex);
//     let foundDate = null;
//     const firstDayInArray = daysArray[0];
//     const lastDayInArray = daysArray[daysArray.length - 1];
//     for (const day of daysArray) {
//         if (d3.timeWeek.floor(day).getTime() === targetWeekStartDate.getTime()) {
//             foundDate = day; break;
//         }
//     }
//     if (!foundDate) {
//         if (targetWeekStartDate <= firstDayInArray) return firstDayInArray;
//         else if (targetWeekStartDate >= d3.timeWeek.floor(lastDayInArray)) return lastDayInArray;
//         else {
//             foundDate = daysArray.slice().reverse().find(d => d < targetWeekStartDate);
//             return foundDate || lastDayInArray;
//         }
//     }
//     return foundDate;
// }

// function updateFilterInfoLabel(startDate, endDate) {
//      if (!filterInfoSpan) return;
//     if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) {
//         filterInfoSpan.textContent = `${formatDate(startDate)} → ${formatDate(endDate)}`;
//     } else {
//         filterInfoSpan.textContent = 'Full selected range';
//     }
// }

// // --- Calendar Drawing ---
// function drawCalendar(data, initialStartDate, initialEndDate) {
//      calendarDiv.innerHTML = ""; legendDiv.innerHTML = "";
//      svgInstance = null; allDaysInCalendar = []; calendarStartDay = null;
//      currentCalendarHeight = 0; currentViewData = data;
//     const listeningData = data.filter(d => d.ms_played > 0);
//     if (listeningData.length === 0) {
//         if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No listening data for this period.</p>`; // Added check
//         const chartsToClear = [
//             topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv,
//             document.getElementById('streamgraph-chart'),
//             document.getElementById('force-graph-chart')
//         ];
//         chartsToClear.forEach(el => { if (el) el.innerHTML = `<p class="empty-message">No data.</p>`; });
//         updateFilterInfoLabel(initialStartDate, initialEndDate);
//         if (typeof handleBrushUpdate === 'function') handleBrushUpdate([]);
//         return;
//     }
//     const dailyData = d3.rollups(listeningData, v => d3.sum(v, d => d.ms_played / 60000), d => formatDay(d.ts));
//     const valueMap = new Map(dailyData);
//     const dataStartDate = new Date(initialStartDate); const dataEndDate = new Date(initialEndDate);
//      if (!dataStartDate || !dataEndDate || isNaN(dataStartDate) || isNaN(dataEndDate) || dataStartDate > dataEndDate) {
//           console.error("drawCalendar: Invalid date range received.", dataStartDate, dataEndDate);
//           if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Invalid date range.</p>`; // Added check
//           if (typeof handleBrushUpdate === 'function') handleBrushUpdate([]);
//           return;
//      }
//     const firstDayOfMonthStart = d3.timeMonth.floor(dataStartDate);
//     const lastDayOfMonthEnd = d3.timeMonth.offset(d3.timeMonth.floor(dataEndDate), 1);
//     allDaysInCalendar = d3.timeDays(firstDayOfMonthStart, lastDayOfMonthEnd);
//     if (allDaysInCalendar.length === 0) {
//         console.error("drawCalendar: No days generated for grid.");
//         if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Could not generate grid days.</p>`; // Added check
//         if (typeof handleBrushUpdate === 'function') handleBrushUpdate([]);
//         return;
//     }
//     calendarStartDay = allDaysInCalendar[0];
//     const endDay = allDaysInCalendar[allDaysInCalendar.length - 1];
//     const months = d3.timeMonths(calendarStartDay, endDay);
//     const weekCount = d3.timeWeek.count(calendarStartDay, endDay) + 1;
//     const width = weekCount * cellWidthWithPadding + leftPadding + 20;
//     currentCalendarHeight = 7 * cellWidthWithPadding;
//     const height = currentCalendarHeight + topPadding + 30;
//     const maxMinutes = d3.max(valueMap.values());
//     calendarColorScale.domain([0, maxMinutes || 1]);
//     const svg = d3.select("#calendar").append("svg").attr("width", width).attr("height", height)
//                   .append("g").attr("transform", `translate(${leftPadding}, ${topPadding})`);
//     svgInstance = svg;
//     const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
//     svg.selectAll(".day-label").data(d3.range(7)).enter().append("text").attr("class", "day-label").attr("x", -15)
//        .attr("y", d => d * cellWidthWithPadding + cellWidthWithPadding / 2 - cellSize / 2).attr("dy", "0.35em").text(d => dayLabels[d]);
//     svg.selectAll(".month-label").data(months).enter().append("text").attr("class", "month-label")
//        .attr("x", d => getXFromDate(d3.max([calendarStartDay, d3.timeWeek.floor(d)]), calendarStartDay, cellWidthWithPadding))
//        .attr("y", -10).text(formatMonth);
//     const cells = svg.selectAll(".day-cell").data(allDaysInCalendar).enter().append("rect").attr("class", "day-cell")
//        .attr("width", cellSize).attr("height", cellSize).attr("rx", 2).attr("ry", 2)
//        .attr("x", d => getXFromDate(d, calendarStartDay, cellWidthWithPadding)).attr("y", d => d.getDay() * cellWidthWithPadding)
//        .attr("fill", noDataColor).attr("stroke", "#fff").attr("stroke-width", 0.5)
//        .on("mouseover", (event, d) => {
//             const key = formatDay(d); const valueMins = valueMap.get(key) || 0;
//             showTooltip(event, `${formatDate(d)}<br><b>Listened: ${formatTime(valueMins)}</b>`);
//             d3.select(event.currentTarget).attr("stroke", "#333").attr("stroke-width", 1.5);
//        })
//        .on("mousemove", moveTooltip)
//        .on("mouseout", (event) => {
//            hideTooltip(); d3.select(event.currentTarget).attr("stroke", "#fff").attr("stroke-width", 0.5);
//        });
//     cells.transition().duration(500).attr("fill", d => {
//         const key = formatDay(d); const value = valueMap.get(key);
//         return (value === undefined || value <= 0) ? noDataColor : calendarColorScale(value);
//     });
//     drawLegend(legendDiv, calendarColorScale, maxMinutes);
//     selectedStartDate = dataStartDate; selectedEndDate = dataEndDate;
//     drawHandles(selectedStartDate, selectedEndDate);
//     updateFilterInfoLabel(selectedStartDate, selectedEndDate);
// }

// // --- Calendar Drawing ---
// function drawCalendar2(data, initialStartDate, initialEndDate) {
//     calendarDiv.innerHTML = "";
//     legendDiv.innerHTML = "";
//     svgInstance = null; // Clear previous instance
//     // Reset plot-specific globals (important for clean redraws)
//     allDaysInCalendar = [];
//     calendarStartDay = null;
//     currentCalendarHeight = 0;
//     // NOTE: currentViewData is set in updateVisualization before this is called

//     const listeningData = data.filter(d => d.ms_played > 0);

//     // No need to clear dependent charts here, updateVisualization handles initial state

//     if (listeningData.length === 0) {
//         if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No listening data for this period.</p>`;
//         updateFilterInfoLabel(initialStartDate, initialEndDate); // Still update label
//         drawLegend(legendDiv, calendarColorScale, 0); // Draw empty legend
//         return;
//     }

//     const dailyData = d3.rollups(listeningData, v => d3.sum(v, d => d.ms_played / 60000), d => formatDay(d.ts));
//     const valueMap = new Map(dailyData);
//     const maxMinutesOverall = d3.max(valueMap.values()) || 0; // Find max across the whole range for consistent legend
//     calendarColorScale.domain([0, maxMinutesOverall || 1]);

//     const dataStartDate = new Date(initialStartDate);
//     const dataEndDate = new Date(initialEndDate);

//      if (!dataStartDate || !dataEndDate || isNaN(dataStartDate) || isNaN(dataEndDate) || dataStartDate > dataEndDate) {
//           console.error("drawCalendar: Invalid date range.", dataStartDate, dataEndDate);
//           if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Invalid date range.</p>`;
//           return;
//      }

//     // --- Multi-Year Calculation ---
//     const startYear = dataStartDate.getFullYear();
//     const endYear = dataEndDate.getFullYear();
//     const years = d3.range(startYear, endYear + 1);
//     const multiYear = years.length > 1;

//     // Calculate dimensions needed for one year (max 53 weeks)
//     cellWidthWithPadding = cellSize + cellPadding; // Recalculate based on constants
//     const singleYearWidth = (53 * cellWidthWithPadding) + leftPadding + 20; // Max width + padding
//     const singleYearHeight = (7 * cellWidthWithPadding) + topPadding + yearLabelPadding; // Height for cells + month/year labels

//     // Calculate total dimensions for the SVG
//     const totalWidth = singleYearWidth; // Width is determined by the widest possible year
//     const totalHeight = (years.length * (singleYearHeight + spaceBetweenYears)) - spaceBetweenYears; // Sum of year heights + spacing

//     const svg = d3.select("#calendar").append("svg")
//         .attr("width", totalWidth)
//         .attr("height", totalHeight);

//     svgInstance = svg; // Store the main SVG instance

//     // Draw Day Labels (Once, positioned absolutely on the left)
//     const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
//     svg.append("g")
//        .attr("transform", `translate(${leftPadding - 15}, ${topPadding + yearLabelPadding})`) // Position left of the first year block
//        .selectAll(".day-label")
//        .data(d3.range(7))
//        .enter().append("text")
//        .attr("class", "day-label")
//        .attr("x", -5)
//        .attr("y", d => d * cellWidthWithPadding + cellWidthWithPadding / 2 - cellSize / 2) // Position relative to the grid rows
//        .attr("dy", "0.35em")
//        .attr("text-anchor", "end")
//        .text(d => dayLabels[d]);


//     // --- Loop through each year ---
//     years.forEach((year, yearIndex) => {
//         const yearGroup = svg.append("g")
//             .attr("class", `year-group year-${year}`)
//             .attr("transform", `translate(${leftPadding}, ${yearIndex * (singleYearHeight + spaceBetweenYears)})`);

//         // Determine start/end dates for *this* year, clamped by the overall range
//         const yearStartDate = new Date(year, 0, 1);
//         const yearEndDate = new Date(year, 11, 31);
//         const currentYearActualStart = (year === startYear) ? dataStartDate : yearStartDate;
//         const currentYearActualEnd = (year === endYear) ? dataEndDate : yearEndDate;

//         // Days and months *within this year's range*
//         const daysInYearRange = d3.timeDays(currentYearActualStart, d3.timeDay.offset(currentYearActualEnd, 1));
//         if (daysInYearRange.length === 0) return; // Skip if no days in range for this year somehow

//         // Calculate the first day to use for week indexing *within this year*
//         // This ensures Jan 1st starts near the left edge.
//         const firstDayOfYearGrid = d3.timeWeek.floor(new Date(year, 0, 1)); // Start indexing from week containing Jan 1st
//         const monthsInYear = d3.timeMonths( d3.max([yearStartDate, d3.timeMonth.floor(currentYearActualStart)]), d3.timeMonth.offset(currentYearActualEnd, 1));

//         // Draw Year Label
//         yearGroup.append("text")
//             .attr("class", "year-label")
//             .attr("x", 0)
//             .attr("y", topPadding - 5) // Position above the month labels
//             .text(year);

//         // Draw Month Labels for this year
//         yearGroup.selectAll(".month-label")
//             .data(monthsInYear)
//             .enter().append("text")
//             .attr("class", "month-label")
//             .attr("x", d => {
//                 // Calculate week index relative to the start of *this year's grid*
//                 const firstWeekOfMonth = d3.timeWeek.floor(d);
//                 // Ensure we don't calculate weeks before the grid starts
//                 const displayWeekStart = d3.max([firstDayOfYearGrid, firstWeekOfMonth]);
//                 return d3.timeWeek.count(firstDayOfYearGrid, displayWeekStart) * cellWidthWithPadding;
//             })
//             .attr("y", topPadding + yearLabelPadding - 10) // Position below year label, above grid
//             .text(formatMonth); // Short month name

//         // Draw Cells for this year
//         const cells = yearGroup.append("g")
//              .attr("transform", `translate(0, ${topPadding + yearLabelPadding})`) // Offset grid below labels
//              .selectAll(".day-cell")
//              .data(daysInYearRange)
//              .enter().append("rect")
//              .attr("class", "day-cell")
//              .attr("width", cellSize)
//              .attr("height", cellSize)
//              .attr("rx", 2).attr("ry", 2)
//              .attr("x", d => {
//                  // Calculate week index relative to start of *this year's grid*
//                  return d3.timeWeek.count(firstDayOfYearGrid, d) * cellWidthWithPadding;
//              })
//              .attr("y", d => d.getDay() * cellWidthWithPadding) // Day of week determines row (0-6)
//              .attr("fill", noDataColor)
//              .attr("stroke", "#fff")
//              .attr("stroke-width", 0.5)
//              .each(function(d) { // Set fill based on data
//                  const dayStr = formatDay(d);
//                  const value = valueMap.get(dayStr);
//                  d3.select(this).attr("fill", (value === undefined || value <= 0) ? noDataColor : calendarColorScale(value));
//              })
//              .on("mouseover", (event, d) => {
//                  const key = formatDay(d);
//                  const valueMins = valueMap.get(key) || 0;
//                  showTooltip(event, `${formatDate(d)}<br><b>Listened: ${formatTime(valueMins)}</b>`);
//                  d3.select(event.currentTarget).attr("stroke", "#333").attr("stroke-width", 1.5);
//              })
//              .on("mousemove", moveTooltip)
//              .on("mouseout", (event) => {
//                  hideTooltip();
//                  d3.select(event.currentTarget).attr("stroke", "#fff").attr("stroke-width", 0.5);
//              });

//         // Store the height of this specific year's grid for handle drawing (if single year)
//         if (!multiYear) {
//              currentCalendarHeight = 7 * cellWidthWithPadding; // Only set if single year
//              calendarStartDay = firstDayOfYearGrid; // Use the grid start for this year
//         }
//     });

//     // Draw Legend (using the overall max value)
//     drawLegend(legendDiv, calendarColorScale, maxMinutesOverall);

//     // Update filter label for the full range
//     updateFilterInfoLabel(dataStartDate, dataEndDate);

//     // --- Handle Interaction ---
//     if (!multiYear) {
//         // Only enable handles if viewing a single year
//         selectedStartDate = dataStartDate;
//         selectedEndDate = dataEndDate;
//         console.log("Drawing handles for single year view.");
//         drawHandles(selectedStartDate, selectedEndDate);
//     } else {
//         // Disable handles/selection for multi-year view
//         selectedStartDate = null; // Clear selection state
//         selectedEndDate = null;
//         console.log("Multi-year view: Handles disabled.");
//         // Ensure any existing handles/highlight are removed
//         svgInstance?.selectAll(".start-handle-group, .end-handle-group, .highlight-rect").remove();
//     }
// }



// // --- Drag Handle Drawing & Events ---
// function drawHandles(startDate, endDate) {
//      if (!svgInstance || !calendarStartDay || !startDate || !endDate || isNaN(startDate) || isNaN(endDate) || currentCalendarHeight <= 0) return;
//     const startX = getXFromDate(startDate, calendarStartDay, cellWidthWithPadding);
//     const endHandleDateForPositioning = d3.timeDay.offset(endDate, 1);
//     const safeEndPosDate = endHandleDateForPositioning <= startDate ? d3.timeDay.offset(startDate, 1) : endHandleDateForPositioning;
//     let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);
//     if (isNaN(endX)) endX = getXFromDate(endDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
//     endX = Math.max(endX, startX + handleWidth);
//     if (isNaN(startX) || isNaN(endX)) { console.error("drawHandles: NaN X position!", { startX, endX }); return; }
//     let startHandleGroup = svgInstance.select(".start-handle-group");
//     if (startHandleGroup.empty()) {
//         startHandleGroup = svgInstance.append("g").attr("class", "start-handle-group");
//         startHandleGroup.append("line").attr("class", "drag-handle start-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round");
//         startHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize");
//     }
//     startHandleGroup.attr("transform", `translate(${startX}, 0)`).selectAll("line").attr("y2", currentCalendarHeight + cellPadding);
//     startHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "start")).on("end", handleDragEnd));
//      let endHandleGroup = svgInstance.select(".end-handle-group");
//      if (endHandleGroup.empty()) {
//         endHandleGroup = svgInstance.append("g").attr("class", "end-handle-group");
//         endHandleGroup.append("line").attr("class", "drag-handle end-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round");
//         endHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize");
//      }
//      endHandleGroup.attr("transform", `translate(${endX}, 0)`).selectAll("line").attr("y2", currentCalendarHeight + cellPadding);
//      endHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "end")).on("end", handleDragEnd));
//      updateHighlightRect();
// }

// function handleDragStart(event) {
//      d3.select(this).raise().select(".drag-handle").attr("stroke", "black").attr("stroke-opacity", 0.7);
//      svgInstance.select(".highlight-rect")?.raise();
//      svgInstance.selectAll(".start-handle-group, .end-handle-group").raise();
// }

// function handleDrag(event, handleType) {
//      if (!svgInstance || !calendarStartDay || allDaysInCalendar.length === 0 || !selectedStartDate || !selectedEndDate || currentCalendarHeight <= 0) return;
//     const currentX = event.x;
//     let targetDate = getDateFromX(currentX, allDaysInCalendar, calendarStartDay, cellWidthWithPadding);
//     if (!targetDate || isNaN(targetDate)) return;
//     const minDate = allDaysInCalendar[0]; const maxDate = allDaysInCalendar[allDaysInCalendar.length - 1];
//     if (targetDate < minDate) targetDate = minDate; if (targetDate > maxDate) targetDate = maxDate;
//     let snappedX; let newStartDate = selectedStartDate; let newEndDate = selectedEndDate; let groupToMove;
//     if (handleType === "start") {
//         targetDate = d3.min([targetDate, selectedEndDate]); newStartDate = targetDate;
//         snappedX = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding);
//         groupToMove = svgInstance.select(".start-handle-group");
//         if (!isNaN(snappedX)) groupToMove.attr("transform", `translate(${snappedX}, 0)`);
//         else console.error("handleDrag (Start): Invalid snappedX.");
//     } else {
//         targetDate = d3.max([targetDate, selectedStartDate]); newEndDate = targetDate;
//         const endHandleDateForPositioning = d3.timeDay.offset(newEndDate, 1);
//         const safeEndPosDate = endHandleDateForPositioning <= newStartDate ? d3.timeDay.offset(newStartDate, 1) : endHandleDateForPositioning;
//         snappedX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);
//          if (isNaN(snappedX)) snappedX = getXFromDate(newEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
//          const startXForCompare = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding);
//          if (!isNaN(startXForCompare) && !isNaN(snappedX)) snappedX = Math.max(snappedX, startXForCompare + handleWidth);
//          else { if(isNaN(snappedX)) return; }
//         groupToMove = svgInstance.select(".end-handle-group");
//         if (!isNaN(snappedX)) groupToMove.attr("transform", `translate(${snappedX}, 0)`);
//         else console.error("handleDrag (End): Invalid snappedX.");
//     }
//     selectedStartDate = newStartDate; selectedEndDate = newEndDate;
//     updateHighlightRect(); updateFilterInfoLabel(selectedStartDate, selectedEndDate);
// }

// function handleDragEnd(event) {
//      d3.select(this).select(".drag-handle").attr("stroke", handleColor).attr("stroke-opacity", 1.0);
//      if (startDateInput && selectedStartDate) startDateInput.value = formatDateForInput(selectedStartDate);
//      if (endDateInput && selectedEndDate) endDateInput.value = formatDateForInput(selectedEndDate);
//      filterDataAndUpdateCharts(selectedStartDate, selectedEndDate);
// }

// function updateHighlightRect() {
//      if (!svgInstance || !selectedStartDate || !selectedEndDate || !calendarStartDay || isNaN(selectedStartDate) || isNaN(selectedEndDate) || currentCalendarHeight <= 0) {
//          svgInstance?.select(".highlight-rect").remove();
//          return;
//     }
//     let highlightRect = svgInstance.select(".highlight-rect");
//     if (highlightRect.empty()) {
//          highlightRect = svgInstance.insert("rect", ":first-child").attr("class", "highlight-rect").attr("fill", highlightColor).attr("pointer-events", "none");
//     }
//     const startX = getXFromDate(selectedStartDate, calendarStartDay, cellWidthWithPadding);
//     const endHandleDateForPositioning = d3.timeDay.offset(selectedEndDate, 1);
//     const safeEndPosDate = endHandleDateForPositioning <= selectedStartDate ? d3.timeDay.offset(selectedStartDate, 1) : endHandleDateForPositioning;
//     let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);
//     if (isNaN(endX)) endX = getXFromDate(selectedEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
//     endX = Math.max(endX, startX);
//     if (isNaN(startX) || isNaN(endX) || isNaN(currentCalendarHeight)) { highlightRect.remove(); return; }
//     highlightRect.attr("x", startX).attr("y", 0).attr("width", Math.max(0, endX - startX)).attr("height", currentCalendarHeight);
// }

// function filterDataAndUpdateCharts(startDate, endDate) {
//      if (!startDate || !endDate || !currentViewData || isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
//         console.warn("filterDataAndUpdateCharts: Invalid date range or no data. Clearing dependent charts.", {startDate, endDate});
//         handleBrushUpdate([]);
//         updateFilterInfoLabel(startDate, endDate);
//         return;
//     }
//     const filterStart = d3.timeDay.floor(new Date(startDate));
//     const filterEnd = d3.timeDay.offset(d3.timeDay.floor(new Date(endDate)), 1);
//     const filtered = currentViewData.filter(d => {
//         const dDate = d.ts;
//         return dDate instanceof Date && !isNaN(dDate) && dDate >= filterStart && dDate < filterEnd;
//     });
//     console.log(`Filtered data for ${formatDate(startDate)} to ${formatDate(endDate)}: ${filtered.length} records.`);
//     updateFilterInfoLabel(startDate, endDate);
//     handleBrushUpdate(filtered);
// }

// // --- Legend Drawing ---
// function drawLegend(container, scale, maxValue) {
//     container.innerHTML = ""; if (maxValue === undefined || maxValue <= 0) return;
//     const legendWidth = 200, legendHeight = 20, legendMargin = { top: 0, right: 10, bottom: 15, left: 10 }, barHeight = 8;
//     const legendSvg = d3.select(container).append("svg").attr("width", legendWidth).attr("height", legendHeight + legendMargin.top + legendMargin.bottom);
//     const legendDefs = legendSvg.append("defs"); const linearGradient = legendDefs.append("linearGradient").attr("id", "calendar-gradient");
//     const numStops = 10; const interpolator = typeof scale.interpolator === 'function' ? scale.interpolator() : (t => scale(maxValue * t));
//     linearGradient.selectAll("stop").data(d3.range(numStops + 1)).enter().append("stop").attr("offset", d => `${(d / numStops) * 100}%`).attr("stop-color", d => interpolator(d / numStops));
//     legendSvg.append("rect").attr("x", legendMargin.left).attr("y", legendMargin.top).attr("width", legendWidth - legendMargin.left - legendMargin.right).attr("height", barHeight).style("fill", "url(#calendar-gradient)").attr("rx", 2).attr("ry", 2);
//     legendSvg.append("text").attr("class", "legend-label").attr("x", legendMargin.left).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "start").text("Less");
//     legendSvg.append("text").attr("class", "legend-label").attr("x", legendWidth - legendMargin.right).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "end").text("More");
// }

// // --- Existing Chart Update Functions ---
// function updateTopArtists(data) {
//     const targetUl = document.getElementById('topArtists'); if (!targetUl) return; targetUl.innerHTML = "";
//     if (!data || data.length === 0) { targetUl.innerHTML = `<li class="empty-message">No data.</li>`; return; }
//     const artistData = d3.rollups( data.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.artist).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
//     if (artistData.length === 0) { targetUl.innerHTML = `<li class="empty-message">No artist data in this period.</li>`; return; }
//     artistData.forEach(([artist, totalMinutes], index) => { const li = document.createElement("li"); li.innerHTML = `<span class="artist-name">${index + 1}. ${artist}</span> <span class="artist-time">(${formatTime(totalMinutes)})</span>`; targetUl.appendChild(li); });
// }

// function updateTopArtistsChart(data) {
//     const containerId = 'top-artists-chart'; // Use the new DIV ID
//     const container = document.getElementById(containerId);
//     if (!container) { console.error(`Container #${containerId} not found.`); return; }
//     container.innerHTML = ""; // Clear previous content

//     if (!data || data.length === 0) {
//         container.innerHTML = `<p class="empty-message">No artist data.</p>`;
//         return;
//     }

//     // 1. Data Aggregation (Same as before)
//     const artistData = d3.rollups(
//         data.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0),
//         v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes
//         d => d.artist
//     ).sort((a, b) => d3.descending(a[1], b[1])) // Sort descending by minutes
//      .slice(0, 5); // Take top 5

//     if (artistData.length === 0) {
//         container.innerHTML = `<p class="empty-message">No artist data in period.</p>`;
//         return;
//     }

//     // 2. Chart Setup
//     const margin = topListChartMargin;
//     const calculatedHeight = artistData.length * (barHeight + 5) + margin.top + margin.bottom; // Dynamic height
//     // Use container's width, fallback to a default
//     const containerWidth = container.clientWidth > 0 ? container.clientWidth : 300;
//     const width = containerWidth - margin.left - margin.right;
//     const height = calculatedHeight - margin.top - margin.bottom;

//     if (width <= 0 || height <= 0) {
//         container.innerHTML = '<p class="error-message">Container too small.</p>';
//         return;
//     }

//     const svg = d3.select(container).append("svg")
//         .attr("width", containerWidth)
//         .attr("height", calculatedHeight)
//         .append("g")
//         .attr("transform", `translate(${margin.left}, ${margin.top})`);

//     // 3. Scales
//     const yScale = d3.scaleBand()
//         .domain(artistData.map(d => d[0])) // Artist names
//         .range([0, height])
//         .padding(0.2); // Padding between bars

//     const maxTime = d3.max(artistData, d => d[1]);
//     const xScale = d3.scaleLinear()
//         .domain([0, maxTime || 1]) // From 0 to max listening time
//         .range([0, width])
//         .nice();

//     // 4. Axes
//     const yAxis = d3.axisLeft(yScale)
//         .tickSize(0) // Remove ticks lines
//         .tickPadding(10); // Space between axis line and labels

//     svg.append("g")
//         .attr("class", "axis axis--y artist-axis")
//         .call(yAxis)
//         .selectAll(".tick text") // Select tick labels for potential truncation
//         .text(d => truncateText(d, 18)) // Truncate long artist names
//         .append("title") // Add full name as SVG title (browser tooltip)
//         .text(d => d);

//     svg.selectAll(".axis--y path.domain").remove(); // Remove the vertical axis line


//     // (Optional) X-Axis - Often omitted in simple top lists, time shown on bars
//     // const xAxis = d3.axisBottom(xScale).ticks(3).tickFormat(formatTime);
//     // svg.append("g")
//     //     .attr("class", "axis axis--x")
//     //     .attr("transform", `translate(0, ${height})`)
//     //     .call(xAxis);

//     // 5. Bars
//     svg.selectAll(".bar")
//         .data(artistData)
//         .join("rect")
//         .attr("class", "bar artist-bar") // Add specific class
//         .attr("y", d => yScale(d[0]))
//         .attr("height", yScale.bandwidth())
//         .attr("x", 0)
//         .attr("fill", "#1DB954") // Spotify green or another color
//         .attr("width", 0) // Start at 0 for transition
//         .on("mouseover", (event, d) => showTooltip(event, `<b>${d[0]}</b><br>${formatTime(d[1])}`))
//         .on("mousemove", moveTooltip)
//         .on("mouseout", hideTooltip)
//         .transition()
//         .duration(500)
//         .attr("width", d => Math.max(0, xScale(d[1]))); // Ensure width isn't negative

//     // 6. Labels on Bars
//     svg.selectAll(".bar-label")
//         .data(artistData)
//         .join("text")
//         .attr("class", "bar-label")
//         .attr("x", d => xScale(d[1]) + 5) // Position slightly right of the bar end
//         .attr("y", d => yScale(d[0]) + yScale.bandwidth() / 2)
//         .attr("dy", "0.35em") // Vertical alignment
//         .attr("text-anchor", "start") // Align text start to the position
//         .style("font-size", "10px")
//         .style("fill", "#333")
//         .style("opacity", 0) // Start hidden for transition
//         .text(d => formatTime(d[1]))
//         .transition()
//         .duration(500)
//         .delay(250) // Delay label appearance slightly
//         .style("opacity", 1);
// }


// function updateTopTracksChart(data) {
//     const targetUl = document.getElementById('top-tracks-chart'); if (!targetUl) return; targetUl.innerHTML = "";
//     if (!data || data.length === 0) { targetUl.innerHTML = `<li class="empty-message">No data.</li>`; return; }
//     const trackData = d3.rollups( data.filter(d => d.track && d.track !== "Unknown Track" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.track).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
//     if (trackData.length === 0) { targetUl.innerHTML = `<li class="empty-message">No Track data in this period.</li>`; return; }
//     trackData.forEach(([track, totalMinutes], index) => { const li = document.createElement("li"); li.innerHTML = `<span class="track-name">${index + 1}. ${track}</span> <span class="track-time">(${formatTime(totalMinutes)})</span>`; targetUl.appendChild(li); });
// }

// function updateTopTracksChart2(data) { // Renamed for consistency
//     const containerId = 'top-tracks-chart';
//     const container = document.getElementById(containerId);
//     if (!container) { console.error(`Container #${containerId} not found.`); return; }
//     container.innerHTML = ""; // Clear previous content

//     if (!requiredColumns.track_name) {
//          container.innerHTML = `<p class="error-message">Track name data missing.</p>`;
//          return;
//     }
//     if (!data || data.length === 0) {
//         container.innerHTML = `<p class="empty-message">No track data.</p>`;
//         return;
//     }

//     // 1. Data Aggregation
//     const trackData = d3.rollups(
//         data.filter(d => d.track && d.track !== "Unknown Track" && d.track !== "N/A" && d.ms_played > 0),
//         v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes
//         d => `${d.track} • ${d.artist}` // Group by combined track and artist
//     ).sort((a, b) => d3.descending(a[1], b[1])) // Sort descending by minutes
//      .slice(0, 5); // Take top 5

//     if (trackData.length === 0) {
//         container.innerHTML = `<p class="empty-message">No track data in period.</p>`;
//         return;
//     }

//     // Function to extract track/artist for labels
//     const getTrackArtist = (key) => {
//         const parts = key.split('•');
//         return {
//             track: parts[0]?.trim() || 'Unknown Track',
//             artist: parts[1]?.trim() || 'Unknown Artist'
//         };
//     };

//     // 2. Chart Setup
//     const margin = topListChartMargin; // Reuse artist margin or define new one
//     const calculatedHeight = trackData.length * (barHeight + 15) + margin.top + margin.bottom; // More space for two-line labels
//     const containerWidth = container.clientWidth > 0 ? container.clientWidth : 300;
//     const width = containerWidth - margin.left - margin.right;
//     const height = calculatedHeight - margin.top - margin.bottom;

//      if (width <= 0 || height <= 0) {
//         container.innerHTML = '<p class="error-message">Container too small.</p>';
//         return;
//     }

//     const svg = d3.select(container).append("svg")
//         .attr("width", containerWidth)
//         .attr("height", calculatedHeight)
//         .append("g")
//         .attr("transform", `translate(${margin.left}, ${margin.top})`);

//     // 3. Scales
//     const yScale = d3.scaleBand()
//         .domain(trackData.map(d => d[0])) // Combined track • artist keys
//         .range([0, height])
//         .padding(0.25); // Adjust padding

//     const maxTime = d3.max(trackData, d => d[1]);
//     const xScale = d3.scaleLinear()
//         .domain([0, maxTime || 1])
//         .range([0, width])
//         .nice();

//     // 4. Axes (Y-Axis with custom tick formatting for Track/Artist)
//     const yAxis = d3.axisLeft(yScale)
//         .tickSize(0)
//         .tickPadding(10);

//     svg.append("g")
//         .attr("class", "axis axis--y track-axis")
//         .call(yAxis)
//         .selectAll(".tick") // Select the whole tick group
//         .selectAll("text") // Remove default text label
//         .remove();

//     // Add custom multi-line labels using tspans
//     svg.selectAll(".axis--y .tick") // Re-select tick groups
//        .append("text")
//        .attr("x", -10) // Position relative to tick line (adjust as needed)
//        .attr("dy", "-0.1em") // Adjust vertical start
//        .attr("text-anchor", "end")
//        .each(function(d) { // d is the track • artist key
//             const { track, artist } = getTrackArtist(d);
//             const truncatedTrack = truncateText(track, 18);
//             const truncatedArtist = truncateText(artist, 20);

//             // Append tspans for track and artist
//             d3.select(this).append("tspan")
//                 .attr("class", "axis-label-track")
//                 .attr("x", -10).attr("dy", "0em") // First line
//                 .text(truncatedTrack)
//                 .append("title").text(track); // Full track name tooltip

//             d3.select(this).append("tspan")
//                 .attr("class", "axis-label-artist")
//                 .style("font-size", "0.8em") // Smaller font for artist
//                 .style("fill", "#666")
//                 .attr("x", -10).attr("dy", "1.2em") // Second line, adjust spacing
//                 .text(truncatedArtist)
//                  .append("title").text(artist); // Full artist name tooltip
//         });

//     svg.selectAll(".axis--y path.domain").remove(); // Remove the vertical axis line

//     // 5. Bars
//     svg.selectAll(".bar")
//         .data(trackData)
//         .join("rect")
//         .attr("class", "bar track-bar") // Add specific class
//         .attr("y", d => yScale(d[0]))
//         .attr("height", yScale.bandwidth())
//         .attr("x", 0)
//         .attr("fill", "#6f42c1") // A different color
//         .attr("width", 0) // Start at 0 for transition
//         .on("mouseover", (event, d) => {
//              const { track, artist } = getTrackArtist(d[0]);
//              showTooltip(event, `<b>${track}</b><br>${artist}<br>${formatTime(d[1])}`)
//             })
//         .on("mousemove", moveTooltip)
//         .on("mouseout", hideTooltip)
//         .transition()
//         .duration(500)
//         .attr("width", d => Math.max(0, xScale(d[1])));

//     // 6. Labels on Bars
//     svg.selectAll(".bar-label")
//         .data(trackData)
//         .join("text")
//         .attr("class", "bar-label")
//         .attr("x", d => xScale(d[1]) + 5)
//         .attr("y", d => yScale(d[0]) + yScale.bandwidth() / 2)
//         .attr("dy", "0.35em")
//         .attr("text-anchor", "start")
//         .style("font-size", "10px")
//         .style("fill", "#333")
//         .style("opacity", 0)
//         .text(d => formatTime(d[1]))
//         .transition()
//         .duration(500)
//         .delay(250)
//         .style("opacity", 1);
// }



// // function updateTopTracksChart2(data) { // Renamed function
// //     const targetDiv = document.getElementById('top-tracks-chart');
// //     if (!targetDiv) return;
// //     targetDiv.innerHTML = ""; // Clear previous content
// //     if (!requiredColumns.track_name) { /* ... error handling ... */ return; }
// //     if (!data || data.length === 0) { /* ... no data message ... */ return; }

// //     // Data aggregation (same as before)
// //     const trackData = d3.rollups(data.filter(d => d.track && d.track !== "Unknown Track" && d.track !== "N/A" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => `${d.track} • ${d.artist}`).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
// //     if (trackData.length === 0) { /* ... no track data message ... */ return; }

// //     // --- Create List Structure ---
// //     const list = d3.select(targetDiv).append("ol") // Use ordered list for ranking
// //         .attr("class", "top-tracks-sparkline-list"); // Add class for styling

// //     // --- Sparkline Configuration ---
// //     const maxMinutes = trackData[0][1]; // Duration of the #1 track
// //     const sparklineWidth = 80; // Width of the mini bar chart
// //     const sparklineHeight = 12; // Height of the mini bar chart
// //     const sparklineScale = d3.scaleLinear()
// //         .domain([0, maxMinutes || 1])
// //         .range([0, sparklineWidth]);

// //     // --- Bind Data and Create List Items ---
// //     const items = list.selectAll("li")
// //         .data(trackData)
// //         .join("li");

 
// //     items.append("span")
// //     .attr("class", "track-info")
// //     .html(d => {
// //        const parts = d[0].split('•');
// //        const trackName = parts[0] ? parts[0].trim() : 'Unknown Track';
// //        const artistName = parts[1] ? parts[1].trim() : 'Unknown Artist';
// //        // Insert <br> between track span and artist span
// //        // Also removed the "•" as it looks better on a separate line
// //        return `<span class="track-name">${trackName}</span><br><span class="track-artist">${artistName}</span>`; // NEW LINE with <br>
// //     });
// //     items.append("span")
// //          .attr("class", "track-time")
// //          .text(d => `(${formatTime(d[1])})`);

// //     // Add SVG for Sparkline
// //     const sparklineSvg = items.append("svg")
// //         .attr("class", "sparkline")
// //         .attr("width", sparklineWidth)
// //         .attr("height", sparklineHeight)
// //         .style("vertical-align", "middle") // Align with text
// //         .style("margin-left", "8px");

// //     // Add Sparkline Bar
// //     sparklineSvg.append("rect")
// //         .attr("x", 0)
// //         .attr("y", 0)
// //         .attr("width", 0) // Start at 0 for animation
// //         .attr("height", sparklineHeight)
// //         .attr("fill", "#1DB954")
// //         .attr("rx", 1) // Slight rounding
// //         .attr("ry", 1)
// //         .on("mouseover", (event, d) => showTooltip(event, `<b>${d[0]}</b><br>${formatTime(d[1])}`)) // Optional tooltip on bar
// //         .on("mousemove", moveTooltip)
// //         .on("mouseout", hideTooltip)
// //         .transition().duration(500)
// //         .attr("width", d => sparklineScale(d[1])); // Animate width


// // }




// function updateTimeOfDayChart(data) {
//      const targetDiv = document.getElementById('time-of-day-chart'); // Use descriptive name
//      if (!targetDiv) return;
//      targetDiv.innerHTML = ""; if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
//      const hourData = d3.rollups( data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getHours());
//      const hourMap = new Map(hourData);
//      const completeHourData = d3.range(24).map(h => [h, hourMap.get(h) || 0]);
//      const containerWidth = targetDiv.parentElement?.clientWidth || 400;
//      const chartWidth = containerWidth > 0 ? containerWidth : 400; const chartHeight = 250; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom;
//      if (width <= 0 || height <= 0) { targetDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; }
//      const svg = d3.select(targetDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);
//      const x = d3.scaleBand().range([0, width]).domain(d3.range(24)).padding(0.2); const y = d3.scaleLinear().domain([0, d3.max(completeHourData, d => d[1]) || 1]).range([height, 0]).nice();
//      svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickValues(d3.range(0, 24, 3))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("text-anchor", "middle").text("Hour of Day");
//      svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Total Listening Time");
//      svg.selectAll(".bar").data(completeHourData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#fd7e14").on("mouseover", (event, d) => showTooltip(event, `<b>Hour ${d[0]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1])));
// }

// function updateDayOfWeekChart(data) {
//      const targetDiv = document.getElementById('day-of-week-chart'); // Use descriptive name
//      if (!targetDiv) return;
//      targetDiv.innerHTML = ""; if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
//      const dayData = d3.rollups( data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getDay());
//      const dayMap = new Map(dayData);
//      const completeDayData = d3.range(7).map(dayIndex => [dayIndex, dayMap.get(dayIndex) || 0]);
//      const containerWidth = targetDiv.parentElement?.clientWidth || 400;
//      const chartWidth = containerWidth > 0 ? containerWidth : 400; const chartHeight = 250; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom;
//      if (width <= 0 || height <= 0) { targetDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; }
//      const svg = d3.select(targetDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);
//      const x = d3.scaleBand().range([0, width]).domain(d3.range(7)).padding(0.2); const y = d3.scaleLinear().domain([0, d3.max(completeDayData, d => d[1]) || 1]).range([height, 0]).nice();
//      svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickFormat(d => dayOfWeekNames[d])).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("text-anchor", "middle").text("Day of Week");
//      svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Total Listening Time");
//      svg.selectAll(".bar").data(completeDayData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#6f42c1").on("mouseover", (event, d) => showTooltip(event, `<b>${dayOfWeekNames[d[0]]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1])));
// }

// // --- Main Update Triggers ---
// function handleBrushUpdate2(filteredChartData) {
//     const dataToUpdate = filteredChartData || [];
//     updateTopArtists(dataToUpdate);
//     updateTopTracksChart2(dataToUpdate);
//     updateTimeOfDayChart(dataToUpdate);
//     updateDayOfWeekChart(dataToUpdate);
//     drawStreamgraph(dataToUpdate, 'streamgraph-chart');
//     drawForceGraph2(dataToUpdate, 'force-graph-chart'); // Use new function/ID
// }

// function handleBrushUpdate(filteredChartData) {
//     const dataToUpdate = filteredChartData || [];

//     // Call the NEW bar chart functions for top lists
//     updateTopArtistsChart(dataToUpdate);
//     updateTopTracksChart(dataToUpdate); // Renamed from updateTopTracksChart2

//     // Keep existing calls for other charts
//     updateTimeOfDayChart(dataToUpdate);
//     updateDayOfWeekChart(dataToUpdate);
//     drawStreamgraph(dataToUpdate, 'streamgraph-chart');
//     drawForceGraph2(dataToUpdate, 'force-graph-chart');
// }


// function updateVisualization(filteredData) {
//      const chartsToClear = [
//          topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv,
//          document.getElementById('streamgraph-chart'),
//          document.getElementById('force-graph-chart') // Use new ID
//      ];
//      selectedStartDate = null; selectedEndDate = null;
//      if (!filteredData || filteredData.length === 0) {
//         if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No data for selected period.</p>`; // Added check
//         if (legendDiv) legendDiv.innerHTML = ""; // Added check
//         chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
//         updateFilterInfoLabel(null, null);
//         handleBrushUpdate([]); // Explicitly clear dependent charts
//         return;
//     }
//     const [viewStartDate, viewEndDate] = d3.extent(filteredData, d => d.ts);
//     if (!viewStartDate || !viewEndDate || isNaN(viewStartDate) || isNaN(viewEndDate)) {
//          console.error("updateVisualization: Invalid date range in data.");
//          if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Invalid date range in data.</p>`; // Added check
//          if (legendDiv) legendDiv.innerHTML = ""; // Added check
//          chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
//          updateFilterInfoLabel(null, null);
//          handleBrushUpdate([]); // Clear charts on error too
//          return;
//     }
//      drawCalendar2(filteredData, viewStartDate, viewEndDate);

     
//      filterDataAndUpdateCharts(viewStartDate, viewEndDate); // This will call handleBrushUpdate
// }

// // --- Event Listeners ---
// // --- Event Listeners ---
// if (wrappedYearSelect) { // Check before adding listener
//     wrappedYearSelect.onchange = () => {
//         // const selectedYear = +yearSelect2.value; // <<< OLD (INCORRECT)
//         const selectedYearValue = wrappedYearSelect.value; // <<< CORRECT: Get value first

//         // Handle empty selection (like the "-- Select Year --" option)
//         if (!selectedYearValue) {
//              console.warn("Empty year selected. Decide how to handle (e.g., show all data or do nothing).");
//              // Example: Show all data
//              // const [minDateAll, maxDateAll] = d3.extent(allParsedData, d => d.ts);
//              // if (minDateAll && maxDateAll) {
//              //     startDateInput.value = formatDateForInput(minDateAll);
//              //     endDateInput.value = formatDateForInput(maxDateAll);
//              //     updateVisualization(allParsedData);
//              // } else {
//              //     updateVisualization([]);
//              // }
//              return; // Stop processing if empty value selected
//         }

//         const selectedYear = +selectedYearValue; // <<< CORRECT: Convert value to number

//         if (!selectedYear || isNaN(selectedYear)) {
//            console.warn("Invalid year selected:", selectedYearValue); updateVisualization([]); return;
//         }
//         const yearStart = new Date(selectedYear, 0, 1);
//         const yearEndFilter = new Date(selectedYear + 1, 0, 1);
//         const filteredByYear = allParsedData.filter(d => d.ts >= yearStart && d.ts < yearEndFilter);
//         startDateInput.value = formatDateForInput(yearStart);
//         endDateInput.value = formatDateForInput(new Date(selectedYear, 11, 31));
//         updateVisualization(filteredByYear);
//     };
// } else {
//      console.error("Cannot attach change listener: #wrappedYearSelect not found.");
// }

// applyRangeBtn.onclick = () => {
//      const startStr = startDateInput.value; const endStr = endDateInput.value;
//      const startMs = Date.parse(startStr); const endMs = Date.parse(endStr);
//      let start = !isNaN(startMs) ? d3.timeDay.floor(new Date(startMs)) : null;
//      let end = !isNaN(endMs) ? d3.timeDay.floor(new Date(endMs)) : null;
//     if (!start || !end) { alert("Invalid date format. Please use YYYY-MM-DD."); return; }
//     if (start > end) {
//         console.warn("Start date was after end date, swapping them.");
//         [start, end] = [end, start];
//         startDateInput.value = formatDateForInput(start);
//         endDateInput.value = formatDateForInput(end);
//     }
//     const filterEnd = d3.timeDay.offset(end, 1);
//     if (wrappedYearSelect) { // Check before setting value
//         wrappedYearSelect.value = ""; // Clear year selection
//    }
//     const filteredByRange = allParsedData.filter(d => d.ts >= start && d.ts < filterEnd);
//     updateVisualization(filteredByRange);
// };

// // ============================================== //
// // === CHART DRAWING FUNCTIONS ================ //
// // ============================================== //

// async function drawTimeline(fullData, containerId) {
//     const container = document.getElementById(containerId);
//     if (!container) { console.error(`drawTimeline Error: Container element with ID "${containerId}" not found.`); return; }
//     container.innerHTML = ""; // Clear first
//     if (!fullData || fullData.length === 0) { container.innerHTML = '<p class="empty-message">No data available for Timeline.</p>'; return; }
//     const latestTs = d3.max(fullData, d => d.ts);
//     if (!latestTs) { container.innerHTML = '<p class="empty-message">No valid timestamps found for Timeline.</p>'; return; }
//     const twentyFourHoursAgo = new Date(latestTs.getTime() - 24 * 60 * 60 * 1000);
//     const timelineData = fullData.filter(d => d.ts >= twentyFourHoursAgo && d.ms_played > 0);
//     if (timelineData.length === 0) { container.innerHTML = '<p class="empty-message">No listening events in the last 24 hours of data.</p>'; return; }
//     const margin = { top: 10, right: 30, bottom: 30, left: 30 };
//     const containerWidth = container.clientWidth || 800;
//     const height = 100 - margin.top - margin.bottom;
//     const width = containerWidth - margin.left - margin.right;
//     if (width <= 0 || height <= 0) { container.innerHTML = '<p class="error-message">Container too small for Timeline chart.</p>'; return; }
//     const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
//     const xScale = d3.scaleTime().domain([twentyFourHoursAgo, latestTs]).range([0, width]);
//     const platforms = [...new Set(timelineData.map(d => d.platform || "Unknown"))];
//     const colorScale = d3.scaleOrdinal().domain(platforms).range(d3.schemeCategory10);
//     svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale).ticks(d3.timeHour.every(3)).tickFormat(d3.timeFormat("%H:%M")));
//     const tapeHeight = height * 0.6; const tapeY = (height - tapeHeight) / 2;
//     svg.selectAll(".timeline-event").data(timelineData).enter().append("rect").attr("class", "timeline-event")
//        .attr("x", d => xScale(d.ts)).attr("y", tapeY)
//        .attr("width", d => { const startX = xScale(d.ts); const endTs = new Date(d.ts.getTime() + d.ms_played); const effectiveEndX = xScale(endTs > latestTs ? latestTs : endTs); return Math.max(1, effectiveEndX - startX); })
//        .attr("height", tapeHeight).attr("fill", d => colorScale(d.platform || "Unknown"))
//        .attr("stroke", d => d.skipped ? handleColor : "#333").attr("stroke-width", d => d.skipped ? 1.5 : 0.5)
//        .on("mouseover", (event, d) => {
//             d3.select(event.currentTarget).attr("stroke-width", d.skipped ? 2.5 : 1.5);
//             const content = `<b>${d.track || d.episode_name || d.audiobook_chapter_title || 'Unknown Title'}</b><br>Artist/Show: ${d.artist || d.episode_show_name || d.audiobook_title || 'N/A'}<br>Album: ${d.album || 'N/A'}<br>Duration: ${formatTime(d.ms_played / 60000)}<br>Time: ${d3.timeFormat('%H:%M:%S')(d.ts)}<br>Platform: ${d.platform || 'Unknown'}<br>Skipped: ${d.skipped ? 'Yes' : 'No'} <br>Reason Start: ${d.reason_start || 'N/A'}<br>Reason End: ${d.reason_end || 'N/A'}`;
//             showTooltip(event, content);
//        })
//        .on("mousemove", moveTooltip).on("mouseout", (event, d) => { d3.select(event.currentTarget).attr("stroke-width", d.skipped ? 1.5 : 0.5); hideTooltip(); });
// }


// async function drawStreamgraph(filteredData, containerId) {
//     const container = document.getElementById(containerId);
//     if (!container) return;
//     container.innerHTML = "";
//     if (!filteredData || filteredData.length === 0) {
//         container.innerHTML = '<p class="empty-message">No data available for the selected period.</p>';
//         const descEl = container.nextElementSibling; if (descEl && descEl.classList.contains('chart-description')) descEl.innerHTML = 'Select a period in the calendar above to see the Music vs Podcast rate.';
//         return;
//     }
//     const streamDataProcessed = filteredData.map(d => { let contentType = 'Music'; if (d.episode_name && String(d.episode_name).trim() !== "") contentType = 'Podcast'; return { ...d, contentType: contentType }; }).filter(d => d.ms_played > 0);
//     if (streamDataProcessed.length === 0) { container.innerHTML = '<p class="empty-message">No Music or Podcast listening events found in this period.</p>'; return; }
//     const contentTypes = ['Music', 'Podcast'];
//     const [minDate, maxDate] = d3.extent(streamDataProcessed, d => d.ts);
//     const timeDiffDays = (maxDate && minDate) ? (maxDate - minDate) / (1000 * 60 * 60 * 24) : 0;
//     const timeAggregator = timeDiffDays > 60 ? d3.timeDay.floor : d3.timeHour.floor;
//     const timeFormatString = timeDiffDays > 60 ? "%Y-%m-%d" : "%H:%M %a %d";
//     console.log(`Streamgraph: Period length ${timeDiffDays.toFixed(1)} days. Aggregating by ${timeDiffDays > 60 ? 'Day' : 'Hour'}.`);
//     const aggregatedData = Array.from( d3.group(streamDataProcessed, d => timeAggregator(d.ts)), ([timeBin, values]) => { const entry = { timeBin: new Date(timeBin) }; let totalMsPlayedInBin = 0; contentTypes.forEach(type => entry[type] = 0); values.forEach(v => { if (entry.hasOwnProperty(v.contentType)) { entry[v.contentType] += v.ms_played; totalMsPlayedInBin += v.ms_played; } }); entry.totalMinutes = totalMsPlayedInBin / 60000; contentTypes.forEach(type => { entry[type] = (totalMsPlayedInBin > 0) ? (entry[type] / totalMsPlayedInBin) : 0; }); return entry; }).sort((a, b) => a.timeBin - b.timeBin);
//     if (aggregatedData.length === 0) { container.innerHTML = '<p class="empty-message">Could not aggregate data for proportions in this period.</p>'; return; }
//     const margin = { top: 20, right: 30, bottom: 40, left: 50 }; const containerWidth = container.clientWidth || 800; const height = 300 - margin.top - margin.bottom; const width = containerWidth - margin.left - margin.right;
//     if (width <= 0 || height <= 0) { container.innerHTML = `<p class="error-message">Container too small for chart.</p>`; return; }
//     const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
//     const xScale = d3.scaleTime().domain(d3.extent(aggregatedData, d => d.timeBin)).range([0, width]); const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);
//     const colorMap = { 'Music': '#1DB954', 'Podcast': '#6f42c1' }; const colorScale = d3.scaleOrdinal().domain(contentTypes).range(contentTypes.map(type => colorMap[type]));
//     const stack = d3.stack().keys(contentTypes).offset(d3.stackOffsetNone).order(d3.stackOrderInsideOut);
//     let series; try { series = stack(aggregatedData); } catch (error) { console.error("Streamgraph - Error during stacking:", error); container.innerHTML = '<p class="error-message">Error processing data for stacking.</p>'; return; }
//     if (series.length === 0 || !series[0] || series[0].length === 0) { const nonZeroTypes = contentTypes.filter(type => aggregatedData.some(d => d[type] > 0)); if (nonZeroTypes.length === 1) { console.warn(`Streamgraph - Only found data for: ${nonZeroTypes[0]}. Drawing single layer.`); series = nonZeroTypes.map(key => { const layer = aggregatedData.map((d, i) => { const point = [0, d[key]]; point.data = d; return point; }); layer.key = key; return layer; }); } else { container.innerHTML = '<p class="empty-message">No stack layers generated (no music/podcast data found?).</p>'; return; } }
//     const areaGen = d3.area().x(d => xScale(d.data.timeBin)).y0(d => yScale(d[0])).y1(d => yScale(d[1])).curve(d3.curveBasis);
//     svg.selectAll(".stream-layer").data(series).enter().append("path").attr("class", d => `stream-layer ${String(d.key).toLowerCase()}-layer`).attr("d", areaGen).attr("fill", d => colorScale(d.key)).attr("stroke", "#fff").attr("stroke-width", 0.5)
//         .on("mouseover", (event, d_layer) => { const [pointerX] = d3.pointer(event, svg.node()); const hoveredDate = xScale.invert(pointerX); const bisectDate = d3.bisector(d => d.timeBin).left; const index = bisectDate(aggregatedData, hoveredDate, 1); const d0 = aggregatedData[index - 1]; const d1 = aggregatedData[index]; const closestData = (d1 && d0 && (hoveredDate - d0.timeBin > d1.timeBin - hoveredDate)) ? d1 : d0; let tooltipContent = `<b>${d_layer.key}</b><br>(No time data)`; if (closestData) { tooltipContent = `<b>Time: ${d3.timeFormat(timeFormatString)(closestData.timeBin)}</b><br>Total Listen: ${formatTime(closestData.totalMinutes)}<br><hr>`; contentTypes.forEach(type => { const percentage = (closestData[type] * 100).toFixed(1); const isHoveredType = type === d_layer.key; tooltipContent += `${isHoveredType ? '<b>' : ''}${type}: ${percentage}%${isHoveredType ? '</b>' : ''}<br>`; }); } svg.selectAll(".stream-layer").style("fill-opacity", 0.3); d3.select(event.currentTarget).style("fill-opacity", 1).attr("stroke", "#000").attr("stroke-width", 1.5); showTooltip(event, tooltipContent.trim()); })
//         .on("mousemove", moveTooltip).on("mouseout", (event, d) => { svg.selectAll(".stream-layer").style("fill-opacity", 1).attr("stroke", "#fff").attr("stroke-width", 0.5); hideTooltip(); });
//     let xAxisTicks; if (timeDiffDays <= 2) xAxisTicks = d3.timeHour.every(6); else if (timeDiffDays <= 14) xAxisTicks = d3.timeDay.every(1); else if (timeDiffDays <= 90) xAxisTicks = d3.timeWeek.every(1); else xAxisTicks = d3.timeMonth.every(1);
//     svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale).ticks(xAxisTicks).tickFormat(d3.timeFormat(timeDiffDays > 30 ? "%b %Y" : "%a %d"))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", margin.bottom - 10).attr("text-anchor", "middle").text("Date / Time");
//     const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".0%")); svg.append("g").attr("class", "axis axis--y").call(yAxis).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - margin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Listening Time Rate (%)");
//     const legendContainer = svg.append("g").attr("class", "streamgraph-legend").attr("transform", `translate(${width - 100}, ${-10})`); const legendItems = legendContainer.selectAll(".legend-item").data(contentTypes).enter().append("g").attr("class", "legend-item").attr("transform", (d, i) => `translate(0, ${i * 15})`); legendItems.append("rect").attr("x", 0).attr("y", 0).attr("width", 10).attr("height", 10).attr("fill", d => colorScale(d)); legendItems.append("text").attr("x", 15).attr("y", 5).attr("dy", "0.35em").style("font-size", "10px").text(d => d);
//     const descriptionElement = container.nextElementSibling; if (descriptionElement && descriptionElement.classList.contains('chart-description')) descriptionElement.innerHTML = "Shows the proportional rate (%) of listening time between Music and Podcasts for the time period selected above.";
// }




// async function drawForceGraph(filteredData, containerId, topN = 10) {
//     const container = document.getElementById(containerId);

//     // --- Robust Initial Checks ---
//     if (!container) {
//         console.error(`drawForceGraph Error: Container element with ID "${containerId}" not found.`);
//         return;
//     }
//     container.innerHTML = ""; // Clear previous content

//     if (!filteredData || filteredData.length < 2) {
//         container.innerHTML = '<p class="empty-message">Not enough data in this period to show transitions.</p>';
//         return;
//     }

//     // --- Data Preparation (Same as before) ---
//     const musicData = filteredData.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0)
//                                  .sort((a, b) => a.ts - b.ts);
//     if (musicData.length < 2) { /* ... */ container.innerHTML = '<p>...</p>'; return; }
//     const artistCounts = d3.rollup(musicData, v => v.length, d => d.artist);
//     const topArtistsMap = new Map( Array.from(artistCounts.entries()).sort(([, countA], [, countB]) => countB - countA).slice(0, topN) );
//     if (topArtistsMap.size < 2) { /* ... */ container.innerHTML = '<p>...</p>'; return; }
//     const transitions = new Map();
//     for (let i = 0; i < musicData.length - 1; i++) { const sourceArtist = musicData[i].artist; const targetArtist = musicData[i + 1].artist; if (topArtistsMap.has(sourceArtist) && topArtistsMap.has(targetArtist) && sourceArtist !== targetArtist) { const key = `${sourceArtist}:::${targetArtist}`; transitions.set(key, (transitions.get(key) || 0) + 1); } }
//     if (transitions.size === 0) { /* ... */ container.innerHTML = '<p>...</p>'; return; }
//     const nodes = Array.from(topArtistsMap.keys()).map(artist => ({ id: artist, playCount: topArtistsMap.get(artist) || 0 }));
//     const links = Array.from(transitions.entries()).map(([key, count]) => { const [source, target] = key.split(":::"); return { source: source, target: target, value: count }; });
//     // --- End Data Preparation ---

//     // --- D3 Force Simulation Setup ---
//     const margin = { top: 10, right: 10, bottom: 10, left: 10 };
//     const containerWidth = container.clientWidth || 600;
//     const containerHeight = 400; // Keep height fixed, adjust if needed for your layout
//     const width = containerWidth - margin.left - margin.right;
//     const height = containerHeight - margin.top - margin.bottom;

//     if (width <= 0 || height <= 0) { /* ... */ container.innerHTML = '<p>...</p>'; return; }

//     // --- SVG Setup with Zoom ---
//     const svg = d3.select(container).append("svg")
//         .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
//         .attr("preserveAspectRatio", "xMinYMid meet");
//         // Note: No transform applied to svg itself

//     // Add group for MARGINS
//     const mainGroup = svg.append("g")
//         .attr("transform", `translate(${margin.left}, ${margin.top})`);

//     // Add the group that will ACTUALLY be transformed by zoom/pan
//     const zoomableGroup = mainGroup.append("g");

//     // OPTIONAL: Background rectangle to catch zoom events across the whole area
//     // If you attach zoom to svg, this might not be strictly needed, but can be helpful
//     mainGroup.append("rect")
//         .attr("width", width)
//         .attr("height", height)
//         .attr("fill", "none")
//         .attr("pointer-events", "all"); // Make sure it captures events

//     // --- Scales (Same as before) ---
//     const minRadius = 4, maxRadius = 12;
//     const nodeRadiusScale = d3.scaleSqrt().domain([0, d3.max(nodes, d => d.playCount) || 1]).range([minRadius, maxRadius]);
//     const maxStrokeWidth = 5;
//     const linkWidthScale = d3.scaleLinear().domain([0, d3.max(links, d => d.value) || 1]).range([1, maxStrokeWidth]);

//     // --- Force Simulation (Using adjusted values from previous step) ---
//     const simulation = d3.forceSimulation(nodes)
//         .force("link", d3.forceLink(links).id(d => d.id).distance(80).strength(0.5)) // Increased distance
//         .force("charge", d3.forceManyBody().strength(-150)) // Increased repulsion
//         .force("center", d3.forceCenter(width / 2, height / 2)) // Center within the margin-adjusted area
//         .force("collide", d3.forceCollide().radius(d => nodeRadiusScale(d.playCount) + 5).strength(0.7)); // Increased collision buffer

//     // --- Draw Links (Lines) - Appended to zoomableGroup ---
//     const link = zoomableGroup.append("g") // Changed from svg to zoomableGroup
//         .attr("class", "force-links")
//         .attr("stroke", "#999")
//         .attr("stroke-opacity", 0.6)
//         .selectAll("line")
//         .data(links)
//         .join("line")
//           .attr("stroke-width", d => linkWidthScale(d.value));
//     link.append("title").text(d => `${d.source.id} → ${d.target.id}\n${d.value} transitions`);

//     // --- Draw Nodes (Circles) - Appended to zoomableGroup ---
//     const node = zoomableGroup.append("g") // Changed from svg to zoomableGroup
//         .attr("class", "force-nodes")
//         .attr("stroke", "#fff")
//         .attr("stroke-width", 1.0)
//         .selectAll("circle")
//         .data(nodes)
//         .join("circle")
//           .attr("r", d => nodeRadiusScale(d.playCount))
//           .attr("fill", "#1DB954")
//           .call(drag(simulation)); // Drag behavior still works
//     node.append("title").text(d => `${d.id}\n${d.playCount} plays in period`);

//     // --- Draw Labels (Text) - Appended to zoomableGroup ---
//     const labels = zoomableGroup.append("g") // Changed from svg to zoomableGroup
//         .attr("class", "force-labels")
//         .attr("font-family", "sans-serif")
//         .attr("font-size", 9) // Font size might need adjustment depending on zoom
//         .attr("fill", "#333")
//         .attr("pointer-events", "none") // Prevent labels interfering with node drag/zoom
//         .selectAll("text")
//         .data(nodes)
//         .join("text")
//           .attr("dx", d => nodeRadiusScale(d.playCount) + 3)
//           .attr("dy", "0.35em")
//           .text(d => d.id);

//     // --- Simulation Tick Handler (Updates elements within zoomableGroup) ---
//     simulation.on("tick", () => {
//         link
//             .attr("x1", d => d.source.x)
//             .attr("y1", d => d.source.y)
//             .attr("x2", d => d.target.x)
//             .attr("y2", d => d.target.y);
//         node
//             .attr("cx", d => d.x)
//             .attr("cy", d => d.y);
//         labels // Update label positions too
//             .attr("x", d => d.x)
//             .attr("y", d => d.y);
//     });

//     // --- Define Zoom Handler ---
//     function zoomed(event) {
//         // Apply the transformations (pan and zoom) to the zoomableGroup
//         zoomableGroup.attr("transform", event.transform);
//         // Optional: Adjust label font size based on zoom?
//         // labels.attr("font-size", 9 / event.transform.k); // Example: smaller when zoomed out
//     }

//     // --- Create and Configure Zoom Behavior ---
//     const zoom = d3.zoom()
//         .scaleExtent([0.3, 7]) // Limit zoom: e.g., 30% to 700%
//         .extent([[0, 0], [width, height]]) // Define panning area (within margins)
//         .translateExtent([[0, 0], [width, height]]) // Prevent panning outside the box
//         .on("zoom", zoomed); // Call the 'zoomed' function on zoom events

//     // --- Attach Zoom Behavior to the SVG ---
//     // Interactions on the main SVG area will trigger zoom/pan
//     svg.call(zoom);

//     // Optional: Disable double-click zoom if it conflicts with other interactions
//     svg.on("dblclick.zoom", null);


//     // --- Drag Functions (remain the same) ---
//     function drag(simulation) {
//         function dragstarted(event, d) {
//             if (!event.active) simulation.alphaTarget(0.3).restart();
//             d.fx = d.x; d.fy = d.y;
//         }
//         function dragged(event, d) {
//             d.fx = event.x; d.fy = event.y;
//         }
//         function dragended(event, d) {
//             if (!event.active) simulation.alphaTarget(0);
//             d.fx = null; d.fy = null;
//         }
//         return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
//     }
// }

// async function drawForceGraph2(filteredData, containerId, topN = 10) {
//     const container = document.getElementById(containerId);

//     // --- Robust Initial Checks ---
//     if (!container) {
//         console.error(`drawForceGraph Error: Container element with ID "${containerId}" not found.`);
//         return;
//     }
//     container.innerHTML = ""; // Clear previous content

//     if (!filteredData || filteredData.length < 2) {
//         container.innerHTML = '<p class="empty-message">Not enough data in this period to show transitions (need at least 2 plays).</p>';
//         const descEl = container.nextElementSibling;
//         if (descEl && descEl.classList.contains('chart-description')) {
//             descEl.innerHTML = 'Select a period with more listening history to view artist transitions.';
//         }
//         return;
//     }

//     // --- Data Preparation ---
//     const musicData = filteredData
//         .filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0)
//         .sort((a, b) => a.ts - b.ts); // Sort by time to get transitions right

//     if (musicData.length < 2) {
//         container.innerHTML = '<p class="empty-message">Not enough *music* plays in this period to show transitions.</p>';
//         return;
//     }

//     // Aggregate play counts for top N artists
//     const artistCounts = d3.rollup(musicData, v => v.length, d => d.artist);
//     const topArtistsMap = new Map(
//         Array.from(artistCounts.entries())
//              .sort(([, countA], [, countB]) => countB - countA)
//              .slice(0, topN)
//     );

//     if (topArtistsMap.size < 2) {
//         container.innerHTML = `<p class="empty-message">Fewer than 2 distinct top artists found in this period. Cannot draw transitions.</p>`;
//         return;
//     }

//     // Calculate transitions *only* between the top N artists
//     const transitions = new Map();
//     for (let i = 0; i < musicData.length - 1; i++) {
//         const sourceArtist = musicData[i].artist;
//         const targetArtist = musicData[i + 1].artist;
//         // Only count if *both* are in the top N and they are different artists
//         if (topArtistsMap.has(sourceArtist) && topArtistsMap.has(targetArtist) && sourceArtist !== targetArtist) {
//             const key = `${sourceArtist}:::${targetArtist}`; // Use a separator unlikely in names
//             transitions.set(key, (transitions.get(key) || 0) + 1);
//         }
//     }

//     if (transitions.size === 0) {
//         container.innerHTML = '<p class="empty-message">No transitions found *between* the top artists in this period.</p>';
//         return;
//     }

//     // Prepare nodes and links for D3 simulation
//     const nodes = Array.from(topArtistsMap.keys()).map(artist => ({
//         id: artist,
//         playCount: topArtistsMap.get(artist) || 0
//     }));

//     const links = Array.from(transitions.entries()).map(([key, count]) => {
//         const [source, target] = key.split(":::");
//         return {
//             source: source, // D3 simulation will resolve these to node objects
//             target: target,
//             value: count // Number of transitions
//         };
//     });
//     // --- End Data Preparation ---


//     // --- D3 Force Simulation Setup ---
//     const margin = { top: 10, right: 10, bottom: 10, left: 10 };
//     const containerWidth = container.clientWidth || 600;
//     const containerHeight = 400; // Fixed height, adjust if needed
//     const width = containerWidth - margin.left - margin.right;
//     const height = containerHeight - margin.top - margin.bottom;

//     if (width <= 0 || height <= 0) {
//         container.innerHTML = '<p class="error-message">Container is too small to draw the graph.</p>';
//         return;
//     }

//     // --- SVG Setup with Zoom ---
//     const svg = d3.select(container).append("svg")
//         .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
//         .attr("preserveAspectRatio", "xMinYMid meet")
//         .style("max-width", "100%") // Ensure responsiveness
//         .style("height", "auto");   // Ensure responsiveness

//     // Add group for MARGINS
//     const mainGroup = svg.append("g")
//         .attr("transform", `translate(${margin.left}, ${margin.top})`);

//     // Add the group that will ACTUALLY be transformed by zoom/pan
//     const zoomableGroup = mainGroup.append("g");

//     // Background rectangle to catch zoom events (optional but good practice)
//     mainGroup.append("rect")
//         .attr("width", width)
//         .attr("height", height)
//         .attr("fill", "none")
//         .attr("pointer-events", "all");

//     // --- Define Arrowhead Marker ---
//     zoomableGroup.append("defs").append("marker") // Append defs to zoomableGroup
//         .attr("id", "arrowhead")
//         .attr("viewBox", "-0 -5 10 10") // Adjust viewBox as needed
//         .attr("refX", 15) // Distance arrow sits away from node center (tune with node radius)
//         .attr("refY", 0)
//         .attr("orient", "auto")
//         .attr("markerWidth", 6)
//         .attr("markerHeight", 6)
//         .attr("xoverflow", "visible")
//         .append("svg:path")
//         .attr("d", "M 0,-5 L 10 ,0 L 0,5") // Arrow shape
//         .attr("fill", "#999") // Arrow color
//         .style("stroke", "none");


//     // --- Scales ---
//     const minRadius = 5, maxRadius = 15; // Slightly larger radii
//     const playCountExtent = d3.extent(nodes, d => d.playCount);
//     const nodeRadiusScale = d3.scaleSqrt()
//         .domain([playCountExtent[0] || 0, playCountExtent[1] || 1])
//         .range([minRadius, maxRadius]);

//     // NEW: Node Color Scale (using Viridis - good for colorblindness)
//     const nodeColorScale = d3.scaleSequential(d3.interpolateViridis)
//          // Use 0 as min if extent[0] is 0 or undefined, prevents issues if min playcount > 0
//         .domain([playCountExtent[1] || 1, 0]);


//     const maxStrokeWidth = 6; // Slightly thicker max link
//     const linkWidthScale = d3.scaleLinear()
//         .domain([0, d3.max(links, d => d.value) || 1])
//         .range([1, maxStrokeWidth]); // Start from 1px

//     // --- Force Simulation ---
//     const simulation = d3.forceSimulation(nodes)
//         .force("link", d3.forceLink(links).id(d => d.id)
//             .distance(90) // Increased distance
//             .strength(link => 1 / Math.min(link.source.playCount, link.target.playCount)) // Weaker links between popular nodes
//         )
//         .force("charge", d3.forceManyBody().strength(-180)) // Increased repulsion
//         .force("center", d3.forceCenter(width / 2, height / 2))
//         .force("collide", d3.forceCollide().radius(d => nodeRadiusScale(d.playCount) + 6).strength(0.8)); // Increased collision buffer

//     // --- Adjacency List for Hover ---
//     const linkedByIndex = {};
//     links.forEach(d => {
//         linkedByIndex[`${d.source.id},${d.target.id}`] = 1;
//     });

//     function areNeighbors(a, b) {
//         return linkedByIndex[`${a.id},${b.id}`] || linkedByIndex[`${b.id},${a.id}`] || a.id === b.id;
//     }

//     // --- Draw Links (Lines) - Appended to zoomableGroup ---
//     const link = zoomableGroup.append("g")
//         .attr("class", "force-links")
//         .attr("stroke", "#999")
//         .attr("stroke-opacity", 0.5) // Slightly more transparent default
//         .selectAll("line")
//         .data(links)
//         .join("line")
//         .attr("stroke-width", d => linkWidthScale(d.value))
//         .attr("marker-end", "url(#arrowhead)"); // Apply the marker

//     link.append("title") // Basic HTML tooltip for links
//         .text(d => `${d.source.id} → ${d.target.id}\n${d.value} transitions`);

//     // --- Draw Nodes (Circles) - Appended to zoomableGroup ---
//     const node = zoomableGroup.append("g")
//         .attr("class", "force-nodes")
//         .attr("stroke", "#fff") // White border for contrast
//         .attr("stroke-width", 1.5)
//         .selectAll("circle")
//         .data(nodes)
//         .join("circle")
//         .attr("r", d => nodeRadiusScale(d.playCount))
//         .attr("fill", d => nodeColorScale(d.playCount)) // Use color scale
//         .call(drag(simulation)); // Attach drag behavior

//     node.append("title") // Basic HTML tooltip for nodes
//         .text(d => `${d.id}\n${d.playCount} plays in period`);

//     // --- Draw Labels (Text) - Appended to zoomableGroup ---
//     const labels = zoomableGroup.append("g")
//         .attr("class", "force-labels")
//         .attr("font-family", "sans-serif")
//         .attr("font-size", 10) // Slightly larger font
//         .attr("fill", "#333")
//         .attr("stroke", "white") // White outline for readability
//         .attr("stroke-width", 0.3)
//         .attr("paint-order", "stroke") // Draw stroke first, then fill
//         .attr("pointer-events", "none") // Prevent labels interfering
//         .selectAll("text")
//         .data(nodes)
//         .join("text")
//         .attr("dx", d => nodeRadiusScale(d.playCount) + 4) // Position based on radius
//         .attr("dy", "0.35em")
//         .text(d => d.id);


//     // --- Hover Interaction ---
//     node.on("mouseover", highlight)
//         .on("mouseout", unhighlight);
//     link.on("mouseover", highlightLink) // Optional: highlight link itself slightly more
//         .on("mouseout", unhighlightLink)

//     function highlight(event, d_hovered) {
//         const opacity = 0.15; // How much to fade others
//         node.style("opacity", n => areNeighbors(d_hovered, n) ? 1 : opacity);
//         node.style("stroke", n => n === d_hovered ? 'black' : '#fff'); // Highlight border of hovered
//         node.style("stroke-width", n => n === d_hovered ? 2.5 : 1.5);

//         link.style("stroke-opacity", l => (l.source === d_hovered || l.target === d_hovered) ? 0.9 : opacity * 0.5);
//         link.select("path") // Select the path inside the marker
//             .style("fill", l => (l.source === d_hovered || l.target === d_hovered) ? "#555" : "#ccc"); // Darken arrow if connected

//         labels.style("opacity", n => areNeighbors(d_hovered, n) ? 1 : opacity);
//     }

//     function unhighlight() {
//         node.style("opacity", 1);
//         node.style("stroke", '#fff');
//         node.style("stroke-width", 1.5);
//         link.style("stroke-opacity", 0.5); // Restore default link opacity
//         link.select("path").style("fill", "#999"); // Restore default arrow color
//         labels.style("opacity", 1);
//     }

//      function highlightLink(event, d_hovered) {
//         d3.select(event.currentTarget)
//           .style("stroke-opacity", 1)
//           .style("stroke", "#333")
//           .attr("stroke-width", linkWidthScale(d_hovered.value) + 1); // Slightly thicker
//         d3.select(event.currentTarget).select("path").style("fill", "#333"); // Darken arrow
//      }

//     function unhighlightLink(event, d_hovered) {
//          d3.select(event.currentTarget)
//            .style("stroke-opacity", 0.5) // Check if also node-hovered before setting final opacity? Simpler to just reset.
//            .style("stroke", "#999")
//            .attr("stroke-width", linkWidthScale(d_hovered.value));
//          d3.select(event.currentTarget).select("path").style("fill", "#999");
//          // Re-apply node hover if necessary (could happen if mouse moves quickly off link onto node)
//          const relatedNode = d3.select(".force-nodes circle[style*='stroke: black']").datum(); // Find if a node is actively hovered
//          if (relatedNode) {
//              highlight(null, relatedNode); // Re-trigger highlight based on node state
//          }
//     }

//     // --- Simulation Tick Handler ---
//     simulation.on("tick", () => {
//         // Update link positions, adjusting for node radius + arrow offset
//         link.attr("x1", d => d.source.x)
//             .attr("y1", d => d.source.y)
//             .attr("x2", d => d.target.x)
//             .attr("y2", d => d.target.y);

//         // Update node positions
//         node.attr("cx", d => d.x)
//             .attr("cy", d => d.y);

//         // Update label positions
//         labels.attr("x", d => d.x)
//               .attr("y", d => d.y);
//     });

//     // --- Define Zoom Handler ---
//     function zoomed(event) {
//         zoomableGroup.attr("transform", event.transform);
//         // Optional: Adjust arrow size/stroke width based on zoom? (Can get complex)
//         // const k = event.transform.k;
//         // link.attr("stroke-width", d => linkWidthScale(d.value) / k);
//         // node.attr("stroke-width", 1.5 / k);
//     }

//     // --- Create and Configure Zoom Behavior ---
//     const zoom = d3.zoom()
//         .scaleExtent([0.2, 8]) // Wider zoom range
//         .extent([[0, 0], [width, height]])
//         .translateExtent([[0, 0], [width, height]]) // Limit panning
//         .on("zoom", zoomed);

//     // --- Attach Zoom Behavior to the SVG ---
//     svg.call(zoom);
//     svg.on("dblclick.zoom", null); // Disable double-click zoom

//     // --- Drag Functions (remain the same) ---
//     function drag(simulation) {
//         function dragstarted(event, d) {
//             if (!event.active) simulation.alphaTarget(0.3).restart();
//             d.fx = d.x;
//             d.fy = d.y;
//             d3.select(this).raise(); // Bring dragged node to front
//         }
//         function dragged(event, d) {
//             d.fx = event.x;
//             d.fy = event.y;
//         }
//         function dragended(event, d) {
//             if (!event.active) simulation.alphaTarget(0);
//             // Only unfix if not actively zooming/panning (prevents jitter)
//             if (!event.sourceEvent || !event.sourceEvent.type.includes('zoom')) {
//                d.fx = null;
//                d.fy = null;
//             }
//              // Reapply hover if needed after drag ends
//              if (d3.select(this).style("opacity") == 1) { // Check if it *should* be highlighted
//                  highlight(event, d);
//              }
//         }
//         return d3.drag()
//                  .on("start", dragstarted)
//                  .on("drag", dragged)
//                  .on("end", dragended);
//     }

//     // Update description
//     const descEl = container.nextElementSibling;
//     if (descEl && descEl.classList.contains('chart-description')) {
//         descEl.innerHTML = `Shows transitions between the top ${nodes.length} most played artists in the selected period. Node size/color indicates play count. Link thickness indicates transition frequency. Hover over nodes to highlight connections. Pan/Zoom enabled.`;
//     }
// }

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
            // Clear other containers
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

        // Initial clearing removed - updateVisualization handles the initial population/clearing

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
    // Since handles are disabled for multi-year, we only need this for single-year view.
    // The 'allDaysInCalendar' global should correspond to the single year being viewed.
     if (!daysArray || daysArray.length === 0 || !firstDayOfGrid || !columnWidth || columnWidth <= 0 || xPos < -columnWidth / 2) return null;
    const firstDayInArray = daysArray[0];
    const lastDayInArray = daysArray[daysArray.length - 1];
    // Find week index relative to this year's grid start
    const maxWeekIndex = d3.timeWeek.count(d3.timeWeek.floor(firstDayOfGrid), d3.timeWeek.floor(lastDayInArray));
    const calculatedIndex = Math.floor((xPos + columnWidth / 2) / columnWidth);
    const weekIndex = Math.max(0, Math.min(calculatedIndex, maxWeekIndex)); // Clamp index
    const targetWeekStartDate = d3.timeWeek.offset(firstDayOfGrid, weekIndex); // Date of the target week's start

    // Find the *actual* date in the array that falls within that week (handles gaps/start/end)
    let foundDate = daysArray.find(d => d3.timeWeek.floor(d).getTime() === targetWeekStartDate.getTime());

    if (!foundDate) { // If no exact match (e.g., clicked empty space after last day)
        if (targetWeekStartDate <= firstDayInArray) return firstDayInArray; // Before first day
        if (targetWeekStartDate >= d3.timeWeek.floor(lastDayInArray)) return lastDayInArray; // After last day's week
        // Find closest previous day if in a gap
        foundDate = daysArray.slice().reverse().find(d => d < targetWeekStartDate);
        return foundDate || lastDayInArray; // Fallback
    }
    return foundDate;
}

// --- Filter Info Label Update ---
function updateFilterInfoLabel(startDate, endDate) { /* ... implementation ... */
    if (!filterInfoSpan) return;
    if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) {
        filterInfoSpan.textContent = `${formatDate(startDate)} → ${formatDate(endDate)}`;
    } else if (currentViewData && currentViewData.length > 0) {
        const [minD, maxD] = d3.extent(currentViewData, d => d.ts);
        if (minD && maxD) filterInfoSpan.textContent = `${formatDate(minD)} → ${formatDate(maxD)} (Full View)`;
        else filterInfoSpan.textContent = 'Full selected range';
    } else {
        filterInfoSpan.textContent = 'No selection or data';
    }
}

// --- Plotting Functions ---

// Multi-Year Calendar Plot
function drawCalendar2(data, initialStartDate, initialEndDate) {
    calendarDiv.innerHTML = "";
    legendDiv.innerHTML = "";
    svgInstance = null; // Clear previous instance
    allDaysInCalendar = []; calendarStartDay = null; currentCalendarHeight = 0; // Reset plot globals

    const listeningData = data.filter(d => d.ms_played > 0);
    if (listeningData.length === 0) { /* ... no data message ... */
        if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No listening data.</p>`;
        updateFilterInfoLabel(initialStartDate, initialEndDate);
        drawLegend(legendDiv, calendarColorScale, 0);
        return;
    }

    const dailyData = d3.rollups(listeningData, v => d3.sum(v, d => d.ms_played / 60000), d => formatDay(d.ts));
    const valueMap = new Map(dailyData);
    const maxMinutesOverall = d3.max(valueMap.values()) || 0;
    calendarColorScale.domain([0, maxMinutesOverall || 1]);
    const dataStartDate = new Date(initialStartDate);
    const dataEndDate = new Date(initialEndDate);
    if (!dataStartDate || !dataEndDate || isNaN(dataStartDate) || isNaN(dataEndDate) || dataStartDate > dataEndDate) { /* ... error ... */ return; }

    const startYear = dataStartDate.getFullYear(); const endYear = dataEndDate.getFullYear();
    const years = d3.range(startYear, endYear + 1); const multiYear = years.length > 1;
    years.reverse(); // Display latest year first
    cellWidthWithPadding = cellSize + cellPadding;
    const singleYearWidth = (53 * cellWidthWithPadding) + leftPadding + 20;
    const singleYearHeight = (7 * cellWidthWithPadding) + topPadding + yearLabelPadding;
    const totalWidth = singleYearWidth; const totalHeight = (years.length * (singleYearHeight + spaceBetweenYears)) - spaceBetweenYears;

    const svg = d3.select("#calendar").append("svg").attr("width", totalWidth).attr("height", totalHeight);
    svgInstance = svg; // Store SVG instance

    // Draw Day Labels (Once)
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    svg.append("g").attr("transform", `translate(${leftPadding - 15}, ${topPadding + yearLabelPadding})`)
       .selectAll(".day-label").data(d3.range(7)).enter().append("text").attr("class", "day-label")
       .attr("x", -5).attr("y", d => d * cellWidthWithPadding + cellWidthWithPadding / 2 - cellSize / 2)
       .attr("dy", "0.35em").attr("text-anchor", "end").text(d => dayLabels[d]);

    // Loop through each year
    years.forEach((year, yearIndex) => {
        const yearGroup = svg.append("g").attr("class", `year-group year-${year}`).attr("transform", `translate(${leftPadding}, ${yearIndex * (singleYearHeight + spaceBetweenYears)})`);
        const yearStartDate = new Date(year, 0, 1); const yearEndDate = new Date(year, 11, 31);
        const currentYearActualStart = (year === startYear) ? dataStartDate : yearStartDate;
        const currentYearActualEnd = (year === endYear) ? dataEndDate : yearEndDate;
        const daysInYearRange = d3.timeDays(currentYearActualStart, d3.timeDay.offset(currentYearActualEnd, 1));
        if (daysInYearRange.length === 0) return;
        const firstDayOfYearGrid = d3.timeWeek.floor(new Date(year, 0, 1));
        const monthsInYear = d3.timeMonths(d3.max([yearStartDate, d3.timeMonth.floor(currentYearActualStart)]), d3.timeMonth.offset(currentYearActualEnd, 1));

        // Draw Year Label
        yearGroup.append("text").attr("class", "year-label").attr("x", 0).attr("y", topPadding - 5).text(year);

        // Draw Month Labels
        yearGroup.selectAll(".month-label").data(monthsInYear).enter().append("text").attr("class", "month-label")
            .attr("x", d => { const displayWeekStart = d3.max([firstDayOfYearGrid, d3.timeWeek.floor(d)]); return d3.timeWeek.count(firstDayOfYearGrid, displayWeekStart) * cellWidthWithPadding; })
            .attr("y", topPadding + yearLabelPadding - 10).text(formatMonth);

        // Draw Cells
        const cells = yearGroup.append("g").attr("transform", `translate(0, ${topPadding + yearLabelPadding})`)
             .selectAll(".day-cell").data(daysInYearRange).enter().append("rect").attr("class", "day-cell")
             .attr("width", cellSize).attr("height", cellSize).attr("rx", 2).attr("ry", 2)
             .attr("x", d => d3.timeWeek.count(firstDayOfYearGrid, d) * cellWidthWithPadding)
             .attr("y", d => d.getDay() * cellWidthWithPadding).attr("fill", noDataColor).attr("stroke", "#fff").attr("stroke-width", 0.5)
             .each(function(d) { const dayStr = formatDay(d); const value = valueMap.get(dayStr); d3.select(this).attr("fill", (value === undefined || value <= 0) ? noDataColor : calendarColorScale(value)); })
             .on("mouseover", (event, d) => { /* ... tooltip ... */
                const key = formatDay(d); const valueMins = valueMap.get(key) || 0;
                showTooltip(event, `${formatDate(d)}<br><b>Listened: ${formatTime(valueMins)}</b>`);
                d3.select(event.currentTarget).attr("stroke", "#333").attr("stroke-width", 1.5);
             })
             .on("mousemove", moveTooltip).on("mouseout", (event) => { /* ... tooltip ... */
                hideTooltip(); d3.select(event.currentTarget).attr("stroke", "#fff").attr("stroke-width", 0.5);
             });

        // Set globals needed for handles *only* if it's a single year view
        if (!multiYear) {
             currentCalendarHeight = 7 * cellWidthWithPadding;
             calendarStartDay = firstDayOfYearGrid;
             // Store the days array specifically for the single year being viewed for handle logic
             allDaysInCalendar = daysInYearRange;
        }
    });

    drawLegend(legendDiv, calendarColorScale, maxMinutesOverall);
    updateFilterInfoLabel(dataStartDate, dataEndDate);

    // Handle Interaction (Draw handles only if single year)
    if (!multiYear) {
        selectedStartDate = dataStartDate; selectedEndDate = dataEndDate;
        console.log("Drawing handles for single year view.");
        drawHandles(selectedStartDate, selectedEndDate);
    } else {
        selectedStartDate = null; selectedEndDate = null; // No selection possible
        console.log("Multi-year view: Handles disabled.");
        svgInstance?.selectAll(".start-handle-group, .end-handle-group, .highlight-rect").remove();
    }
}

// --- Calendar Drawing (Multi-Year Enhanced) ---
function drawCalendar3(data, initialStartDate, initialEndDate) {
    // ... (setup code remains the same: clear divs, check data, calculate valueMap etc.) ...
    calendarDiv.innerHTML = "";
    legendDiv.innerHTML = "";
    svgInstance = null;
    allDaysInCalendar = []; calendarStartDay = null; currentCalendarHeight = 0;

    const listeningData = data.filter(d => d.ms_played > 0);
    if (listeningData.length === 0) { /* ... no data message ... */
        if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No listening data.</p>`;
        updateFilterInfoLabel(initialStartDate, initialEndDate);
        drawLegend(legendDiv, calendarColorScale, 0);
        return;
    }
    const dailyData = d3.rollups(listeningData, v => d3.sum(v, d => d.ms_played / 60000), d => formatDay(d.ts));
    const valueMap = new Map(dailyData);
    const maxMinutesOverall = d3.max(valueMap.values()) || 0;
    calendarColorScale.domain([0, maxMinutesOverall || 1]);
    const dataStartDate = new Date(initialStartDate);
    const dataEndDate = new Date(initialEndDate);
    if (!dataStartDate || !dataEndDate || isNaN(dataStartDate) || isNaN(dataEndDate) || dataStartDate > dataEndDate) { /* ... error ... */ return; }

    const startYear = dataStartDate.getFullYear(); const endYear = dataEndDate.getFullYear();
    const years = d3.range(startYear, endYear + 1);
    years.reverse(); // Latest year first
    const multiYear = years.length > 1;

    cellWidthWithPadding = cellSize + cellPadding;
    const singleYearWidth = (53 * cellWidthWithPadding) + leftPadding + 20;
    const singleYearHeight = (7 * cellWidthWithPadding) + topPadding + yearLabelPadding;
    const totalWidth = singleYearWidth; const totalHeight = (years.length * (singleYearHeight + spaceBetweenYears)) - spaceBetweenYears;

    const svg = d3.select("#calendar").append("svg").attr("width", totalWidth).attr("height", totalHeight);
    svgInstance = svg;

    // Draw Day Labels (Once)
    // ... (day label drawing code remains the same) ...
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    svg.append("g").attr("transform", `translate(${leftPadding - 15}, ${topPadding + yearLabelPadding})`)
       .selectAll(".day-label").data(d3.range(7)).enter().append("text").attr("class", "day-label")
       .attr("x", -5).attr("y", d => d * cellWidthWithPadding + cellWidthWithPadding / 2 - cellSize / 2)
       .attr("dy", "0.35em").attr("text-anchor", "end").text(d => dayLabels[d]);


    // Loop through each year
    years.forEach((year, yearIndex) => {
        // ... (year group creation, date calculations, label/cell drawing remains the same) ...
        const yearGroup = svg.append("g").attr("class", `year-group year-${year}`).attr("transform", `translate(${leftPadding}, ${yearIndex * (singleYearHeight + spaceBetweenYears)})`);
        const yearStartDate = new Date(year, 0, 1); const yearEndDate = new Date(year, 11, 31);
        const currentYearActualStart = d3.max([yearStartDate, dataStartDate]);
        const currentYearActualEnd = d3.min([yearEndDate, dataEndDate]);
        const daysInYearRange = d3.timeDays(currentYearActualStart, d3.timeDay.offset(currentYearActualEnd, 1));
        if (daysInYearRange.length === 0) return;
        const firstDayOfYearGrid = d3.timeWeek.floor(new Date(year, 0, 1));
        const monthsInYear = d3.timeMonths( d3.max([yearStartDate, d3.timeMonth.floor(currentYearActualStart)]), d3.timeMonth.offset(currentYearActualEnd, 1));

        // Draw Year Label
        yearGroup.append("text").attr("class", "year-label").attr("x", 0).attr("y", topPadding - 5).text(year);

        // Draw Month Labels
        yearGroup.selectAll(".month-label").data(monthsInYear).enter().append("text").attr("class", "month-label")
            .attr("x", d => { const displayWeekStart = d3.max([firstDayOfYearGrid, d3.timeWeek.floor(d)]); return d3.timeWeek.count(firstDayOfYearGrid, displayWeekStart) * cellWidthWithPadding; })
            .attr("y", topPadding + yearLabelPadding - 10).text(formatMonth);

        // Draw Cells
        const cells = yearGroup.append("g").attr("transform", `translate(0, ${topPadding + yearLabelPadding})`)
             .selectAll(".day-cell").data(daysInYearRange).enter().append("rect").attr("class", "day-cell")
             .attr("width", cellSize).attr("height", cellSize).attr("rx", 2).attr("ry", 2)
             .attr("x", d => d3.timeWeek.count(firstDayOfYearGrid, d) * cellWidthWithPadding)
             .attr("y", d => d.getDay() * cellWidthWithPadding).attr("fill", noDataColor).attr("stroke", "#fff").attr("stroke-width", 0.5)
             .each(function(d) { const dayStr = formatDay(d); const value = valueMap.get(dayStr); d3.select(this).attr("fill", (value === undefined || value <= 0) ? noDataColor : calendarColorScale(value)); })
             .on("mouseover", (event, d) => { /* ... tooltip ... */ })
             .on("mousemove", moveTooltip).on("mouseout", (event) => { /* ... tooltip ... */ });

        // Set globals *only* if single year - needed for handle/drag logic
        if (!multiYear) {
             currentCalendarHeight = 7 * cellWidthWithPadding;
             calendarStartDay = firstDayOfYearGrid;
             allDaysInCalendar = daysInYearRange;
        }
    });

    drawLegend(legendDiv, calendarColorScale, maxMinutesOverall);
    updateFilterInfoLabel(dataStartDate, dataEndDate);

    // --- Handle Interaction ---
    // Always set the selected range to the initial full range
    selectedStartDate = dataStartDate;
    selectedEndDate = dataEndDate;
    // Always try to draw handles, pass multiYear flag
    console.log(`Drawing handles. Multi-year: ${multiYear}`);
    drawHandles(selectedStartDate, selectedEndDate, multiYear); // Pass multiYear flag
    // Highlight rectangle needs to be drawn/updated after handles
    updateHighlightRect(); // Update highlight for the initial full range

}

// Drag Handle Drawing & Events (Only drawn/used in single-year plot mode)
function drawHandles(startDate, endDate) { /* ... implementation ... */
    // Check if SVG exists and other necessary globals are set (by single-year drawCalendar2)
    if (!svgInstance || !calendarStartDay || !startDate || !endDate || isNaN(startDate) || isNaN(endDate) || currentCalendarHeight <= 0) return;
    const startX = getXFromDate(startDate, calendarStartDay, cellWidthWithPadding);
    const endHandleDateForPositioning = d3.timeDay.offset(endDate, 1);
    const safeEndPosDate = endHandleDateForPositioning <= startDate ? d3.timeDay.offset(startDate, 1) : endHandleDateForPositioning;
    let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);
    if (isNaN(endX)) endX = getXFromDate(endDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
    endX = Math.max(endX, startX + handleWidth);
    if (isNaN(startX) || isNaN(endX)) { console.error("drawHandles: NaN X position!", { startX, endX }); return; }

    // Find the correct year group to append handles to (assuming single year)
    const yearGroup = svgInstance.select(`.year-group.year-${startDate.getFullYear()}`); // Handles only appear in single year view
    if (yearGroup.empty()) { console.error("Cannot find year group to draw handles."); return; }

    // Append or update handles within the year group's coordinate system
    const handleBaseY = topPadding + yearLabelPadding; // Y offset of the grid within the year group

    let startHandleGroup = yearGroup.select(".start-handle-group");
    if (startHandleGroup.empty()) {
        startHandleGroup = yearGroup.append("g").attr("class", "start-handle-group");
        startHandleGroup.append("line").attr("class", "drag-handle start-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round");
        startHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize");
    }
    startHandleGroup.attr("transform", `translate(${startX}, ${handleBaseY})`) // Position relative to year group
                   .selectAll("line").attr("y2", currentCalendarHeight + cellPadding);
    startHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "start")).on("end", handleDragEnd));

    let endHandleGroup = yearGroup.select(".end-handle-group");
     if (endHandleGroup.empty()) {
        endHandleGroup = yearGroup.append("g").attr("class", "end-handle-group");
        endHandleGroup.append("line").attr("class", "drag-handle end-handle").attr("y1", -cellPadding).attr("stroke", handleColor).attr("stroke-width", handleWidth).attr("stroke-linecap", "round");
        endHandleGroup.append("line").attr("class", "drag-grab-area").attr("y1", -cellPadding).attr("stroke", "transparent").attr("stroke-width", handleGrabAreaWidth).style("cursor", "ew-resize");
     }
     endHandleGroup.attr("transform", `translate(${endX}, ${handleBaseY})`) // Position relative to year group
                  .selectAll("line").attr("y2", currentCalendarHeight + cellPadding);
     endHandleGroup.raise().on('.drag', null).call(d3.drag().on("start", handleDragStart).on("drag", (event) => handleDrag(event, "end")).on("end", handleDragEnd));

     updateHighlightRect(); // Update highlight based on new handle positions
}



function handleDragStart(event) { /* ... implementation ... */
     if (!svgInstance) return;
     d3.select(this).raise().select(".drag-handle").attr("stroke", "black").attr("stroke-opacity", 0.7);
     // Find the correct year group's highlight rect
     const year = selectedStartDate.getFullYear(); // Assume dragging implies single year
     svgInstance.select(`.year-group.year-${year} .highlight-rect`)?.raise();
     svgInstance.selectAll(".start-handle-group, .end-handle-group").raise(); // Raise all handles
}
function handleDrag(event, handleType) { /* ... implementation ... */
    // Ensure we have the correct context (single year view)
    if (!svgInstance || !calendarStartDay || allDaysInCalendar.length === 0 || !selectedStartDate || !selectedEndDate || currentCalendarHeight <= 0) return;

    // Get date from X position relative to the *start* of the single year grid
    const currentX = event.x;
    let targetDate = getDateFromX(currentX, allDaysInCalendar, calendarStartDay, cellWidthWithPadding);
    if (!targetDate || isNaN(targetDate)) return;

    // Clamp targetDate within the bounds of the *single year's* displayed days (allDaysInCalendar)
    const minDate = allDaysInCalendar[0];
    const maxDate = allDaysInCalendar[allDaysInCalendar.length - 1];
    if (targetDate < minDate) targetDate = minDate;
    if (targetDate > maxDate) targetDate = maxDate;

    let snappedX; let newStartDate = selectedStartDate; let newEndDate = selectedEndDate; let groupToMove;
    const yearGroup = svgInstance.select(`.year-group.year-${selectedStartDate.getFullYear()}`);
    if (yearGroup.empty()) return;
    const handleBaseY = topPadding + yearLabelPadding;

    if (handleType === "start") {
        targetDate = d3.min([targetDate, selectedEndDate]); // Don't let start go past end
        newStartDate = targetDate;
        snappedX = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding);
        groupToMove = yearGroup.select(".start-handle-group");
        if (!isNaN(snappedX)) groupToMove.attr("transform", `translate(${snappedX}, ${handleBaseY})`);
        else console.error("handleDrag (Start): Invalid snappedX.");
    } else { // handleType === "end"
        targetDate = d3.max([targetDate, selectedStartDate]); // Don't let end go before start
        newEndDate = targetDate;
        const endHandleDateForPositioning = d3.timeDay.offset(newEndDate, 1);
        const safeEndPosDate = endHandleDateForPositioning <= newStartDate ? d3.timeDay.offset(newStartDate, 1) : endHandleDateForPositioning;
        snappedX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);
        if (isNaN(snappedX)) snappedX = getXFromDate(newEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
        const startXForCompare = getXFromDate(newStartDate, calendarStartDay, cellWidthWithPadding);
        if (!isNaN(startXForCompare) && !isNaN(snappedX)) snappedX = Math.max(snappedX, startXForCompare + handleWidth);
        else if(isNaN(snappedX)) return;
        groupToMove = yearGroup.select(".end-handle-group");
        if (!isNaN(snappedX)) groupToMove.attr("transform", `translate(${snappedX}, ${handleBaseY})`);
        else console.error("handleDrag (End): Invalid snappedX.");
    }

    // Update global selection state
    selectedStartDate = newStartDate;
    selectedEndDate = newEndDate;

    updateHighlightRect(); // Update visual highlight
    updateFilterInfoLabel(selectedStartDate, selectedEndDate); // Update text label
}
function handleDragEnd(event) { /* ... implementation ... */
    if (svgInstance) { // Only do SVG manipulation if it exists
         d3.select(this).select(".drag-handle").attr("stroke", handleColor).attr("stroke-opacity", 1.0);
    }
     // Update date inputs regardless
     if (startDateInput && selectedStartDate) startDateInput.value = formatDateForInput(selectedStartDate);
     if (endDateInput && selectedEndDate) endDateInput.value = formatDateForInput(selectedEndDate);
     // Trigger chart updates based on the final selection
     filterDataAndUpdateCharts(selectedStartDate, selectedEndDate);
}
function updateHighlightRect() { /* ... implementation ... */
    // Only draw/update if in single-year plot mode with valid selection
    if (!svgInstance || !selectedStartDate || !selectedEndDate || !calendarStartDay || isNaN(selectedStartDate) || isNaN(selectedEndDate) || currentCalendarHeight <= 0) {
         svgInstance?.selectAll(".highlight-rect").remove(); // Remove if exists but shouldn't
         return;
    }

    // Find the correct year group
    const year = selectedStartDate.getFullYear();
    const yearGroup = svgInstance.select(`.year-group.year-${year}`);
    if (yearGroup.empty()) {
        svgInstance?.selectAll(".highlight-rect").remove(); // Remove if group not found
        return;
    }
    const gridOffsetY = topPadding + yearLabelPadding;

    let highlightRect = yearGroup.select(".highlight-rect");
    if (highlightRect.empty()) {
         highlightRect = yearGroup.insert("rect", ":first-child") // Insert within the year group
                                .attr("class", "highlight-rect")
                                .attr("fill", highlightColor)
                                .attr("pointer-events", "none");
    }

    const startX = getXFromDate(selectedStartDate, calendarStartDay, cellWidthWithPadding);
    const endHandleDateForPositioning = d3.timeDay.offset(selectedEndDate, 1);
    const safeEndPosDate = endHandleDateForPositioning <= selectedStartDate ? d3.timeDay.offset(selectedStartDate, 1) : endHandleDateForPositioning;
    let endX = getXFromDate(safeEndPosDate, calendarStartDay, cellWidthWithPadding);
    if (isNaN(endX)) endX = getXFromDate(selectedEndDate, calendarStartDay, cellWidthWithPadding) + cellWidthWithPadding;
    endX = Math.max(endX, startX);

    if (isNaN(startX) || isNaN(endX)) { highlightRect.remove(); return; }

    highlightRect.attr("x", startX)
                 .attr("y", gridOffsetY) // Position relative to year group's grid
                 .attr("width", Math.max(0, endX - startX))
                 .attr("height", currentCalendarHeight);
}
function drawLegend(container, scale, maxValue) { /* ... implementation ... */
     container.innerHTML = ""; if (maxValue === undefined) return; // Allow drawing empty legend if max is 0
    const legendWidth = 200, legendHeight = 20, legendMargin = { top: 0, right: 10, bottom: 15, left: 10 }, barHeight = 8;
    const legendSvg = d3.select(container).append("svg").attr("width", legendWidth).attr("height", legendHeight + legendMargin.top + legendMargin.bottom);
    const legendDefs = legendSvg.append("defs"); const linearGradient = legendDefs.append("linearGradient").attr("id", "calendar-gradient");
    const numStops = 10;
    // Handle case where max value is 0 or scale is invalid
    const interpolator = (maxValue <= 0 || typeof scale.interpolator !== 'function')
                       ? (() => noDataColor) // Return noDataColor if no range
                       : scale.interpolator();
    linearGradient.selectAll("stop").data(d3.range(numStops + 1)).enter().append("stop")
        .attr("offset", d => `${(d / numStops) * 100}%`)
        .attr("stop-color", d => interpolator(d / numStops));
    legendSvg.append("rect").attr("x", legendMargin.left).attr("y", legendMargin.top)
        .attr("width", legendWidth - legendMargin.left - legendMargin.right).attr("height", barHeight)
        .style("fill", maxValue <= 0 ? noDataColor : "url(#calendar-gradient)") // Use noDataColor if max is 0
        .attr("rx", 2).attr("ry", 2);
    legendSvg.append("text").attr("class", "legend-label").attr("x", legendMargin.left).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "start").text("Less");
    legendSvg.append("text").attr("class", "legend-label").attr("x", legendWidth - legendMargin.right).attr("y", legendMargin.top + barHeight + 10).attr("text-anchor", "end").text("More");
}

// Top Artists Bar Chart
function updateTopArtistsChart(data) { /* ... implementation ... */
    const containerId = 'top-artists-chart'; // Use the correct DIV ID
    const container = document.getElementById(containerId);
    if (!container) { console.error(`Container #${containerId} not found.`); return; }
    container.innerHTML = "";

    if (!data || data.length === 0) { container.innerHTML = `<p class="empty-message">No artist data.</p>`; return; }
    const artistData = d3.rollups(data.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.artist).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (artistData.length === 0) { container.innerHTML = `<p class="empty-message">No artist data in period.</p>`; return; }

    const margin = topListChartMargin;
    const calculatedHeight = artistData.length * (barHeight + 5) + margin.top + margin.bottom;
    const containerWidth = container.clientWidth > 0 ? container.clientWidth : 300;
    const width = containerWidth - margin.left - margin.right;
    const height = calculatedHeight - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) { container.innerHTML = '<p class="error-message">Container too small.</p>'; return; }

    const svg = d3.select(container).append("svg").attr("width", containerWidth).attr("height", calculatedHeight).append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    const yScale = d3.scaleBand().domain(artistData.map(d => d[0])).range([0, height]).padding(0.2);
    const maxTime = d3.max(artistData, d => d[1]);
    const xScale = d3.scaleLinear().domain([0, maxTime || 1]).range([0, width]).nice();
    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);
    svg.append("g").attr("class", "axis axis--y artist-axis").call(yAxis)
       .selectAll(".tick text").text(d => truncateText(d, 18)).append("title").text(d => d);
    svg.selectAll(".axis--y path.domain").remove();

    svg.selectAll(".bar").data(artistData).join("rect").attr("class", "bar artist-bar")
       .attr("y", d => yScale(d[0])).attr("height", yScale.bandwidth()).attr("x", 0).attr("fill", "#1DB954").attr("width", 0)
       .on("mouseover", (event, d) => showTooltip(event, `<b>${d[0]}</b><br>${formatTime(d[1])}`))
       .on("mousemove", moveTooltip).on("mouseout", hideTooltip)
       .transition().duration(500).attr("width", d => Math.max(0, xScale(d[1])));

    svg.selectAll(".bar-label").data(artistData).join("text").attr("class", "bar-label")
       .attr("x", d => xScale(d[1]) + 5).attr("y", d => yScale(d[0]) + yScale.bandwidth() / 2)
       .attr("dy", "0.35em").attr("text-anchor", "start").style("font-size", "10px").style("fill", "#333").style("opacity", 0)
       .text(d => formatTime(d[1]))
       .transition().duration(500).delay(250).style("opacity", 1);
}

// Top Tracks Bar Chart
function updateTopTracksChart(data) { /* ... implementation ... */
    const containerId = 'top-tracks-chart';
    const container = document.getElementById(containerId);
    if (!container) { console.error(`Container #${containerId} not found.`); return; }
    container.innerHTML = "";

    if (!requiredColumns.track_name) { container.innerHTML = `<p class="error-message">Track data missing.</p>`; return; }
    if (!data || data.length === 0) { container.innerHTML = `<p class="empty-message">No track data.</p>`; return; }
    const trackData = d3.rollups( data.filter(d => d.track && d.track !== "Unknown Track" && d.track !== "N/A" && d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => `${d.track} • ${d.artist}` ).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
    if (trackData.length === 0) { container.innerHTML = `<p class="empty-message">No track data in period.</p>`; return; }
    const getTrackArtist = (key) => { const parts = key.split('•'); return { track: parts[0]?.trim() || 'Unknown Track', artist: parts[1]?.trim() || 'Unknown Artist' }; };

    const margin = topListChartMargin;
    const calculatedHeight = trackData.length * (barHeight + 15) + margin.top + margin.bottom;
    const containerWidth = container.clientWidth > 0 ? container.clientWidth : 300;
    const width = containerWidth - margin.left - margin.right;
    const height = calculatedHeight - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) { container.innerHTML = '<p class="error-message">Container too small.</p>'; return; }

    const svg = d3.select(container).append("svg").attr("width", containerWidth).attr("height", calculatedHeight).append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    const yScale = d3.scaleBand().domain(trackData.map(d => d[0])).range([0, height]).padding(0.25);
    const maxTime = d3.max(trackData, d => d[1]);
    const xScale = d3.scaleLinear().domain([0, maxTime || 1]).range([0, width]).nice();
    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);

    svg.append("g").attr("class", "axis axis--y track-axis").call(yAxis).selectAll(".tick").selectAll("text").remove();
    svg.selectAll(".axis--y .tick").append("text").attr("x", -10).attr("dy", "-0.1em").attr("text-anchor", "end")
       .each(function(d) { const { track, artist } = getTrackArtist(d); const truncatedTrack = truncateText(track, 18); const truncatedArtist = truncateText(artist, 20);
            d3.select(this).append("tspan").attr("class", "axis-label-track").attr("x", -10).attr("dy", "0em").text(truncatedTrack).append("title").text(track);
            d3.select(this).append("tspan").attr("class", "axis-label-artist").style("font-size", "0.8em").style("fill", "#666").attr("x", -10).attr("dy", "1.2em").text(truncatedArtist).append("title").text(artist);
       });
    svg.selectAll(".axis--y path.domain").remove();

    svg.selectAll(".bar").data(trackData).join("rect").attr("class", "bar track-bar")
       .attr("y", d => yScale(d[0])).attr("height", yScale.bandwidth()).attr("x", 0).attr("fill", "#6f42c1").attr("width", 0)
       .on("mouseover", (event, d) => { const { track, artist } = getTrackArtist(d[0]); showTooltip(event, `<b>${track}</b><br>${artist}<br>${formatTime(d[1])}`) })
       .on("mousemove", moveTooltip).on("mouseout", hideTooltip)
       .transition().duration(500).attr("width", d => Math.max(0, xScale(d[1])));

    svg.selectAll(".bar-label").data(trackData).join("text").attr("class", "bar-label")
       .attr("x", d => xScale(d[1]) + 5).attr("y", d => yScale(d[0]) + yScale.bandwidth() / 2)
       .attr("dy", "0.35em").attr("text-anchor", "start").style("font-size", "10px").style("fill", "#333").style("opacity", 0)
       .text(d => formatTime(d[1]))
       .transition().duration(500).delay(250).style("opacity", 1);
}

// Other Chart Functions (Time of Day, Day of Week, Streamgraph, Force Graph)
function updateTimeOfDayChart(data) { /* ... implementation ... */
    const targetDiv = document.getElementById('time-of-day-chart');
     if (!targetDiv) return; targetDiv.innerHTML = "";
     if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
     const hourData = d3.rollups(data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getHours());
     const hourMap = new Map(hourData); const completeHourData = d3.range(24).map(h => [h, hourMap.get(h) || 0]);
     const containerWidth = targetDiv.parentElement?.clientWidth || 400; const chartWidth = containerWidth > 0 ? containerWidth : 400; const chartHeight = 250; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom;
     if (width <= 0 || height <= 0) { targetDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; }
     const svg = d3.select(targetDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);
     const x = d3.scaleBand().range([0, width]).domain(d3.range(24)).padding(0.2); const y = d3.scaleLinear().domain([0, d3.max(completeHourData, d => d[1]) || 1]).range([height, 0]).nice();
     svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickValues(d3.range(0, 24, 3))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("text-anchor", "middle").text("Hour of Day");
     svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Total Listening Time");
     svg.selectAll(".bar").data(completeHourData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#fd7e14").on("mouseover", (event, d) => showTooltip(event, `<b>Hour ${d[0]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1])));
}
function updateDayOfWeekChart(data) { /* ... implementation ... */
    const targetDiv = document.getElementById('day-of-week-chart');
     if (!targetDiv) return; targetDiv.innerHTML = "";
     if (!data || data.length === 0) { targetDiv.innerHTML = `<p class="empty-message">No data.</p>`; return; }
     const dayData = d3.rollups(data.filter(d => d.ms_played > 0), v => d3.sum(v, d => d.ms_played / 60000), d => d.ts.getDay());
     const dayMap = new Map(dayData); const completeDayData = d3.range(7).map(dayIndex => [dayIndex, dayMap.get(dayIndex) || 0]);
     const containerWidth = targetDiv.parentElement?.clientWidth || 400; const chartWidth = containerWidth > 0 ? containerWidth : 400; const chartHeight = 250; const width = chartWidth - chartMargin.left - chartMargin.right; const height = chartHeight - chartMargin.top - chartMargin.bottom;
     if (width <= 0 || height <= 0) { targetDiv.innerHTML = `<p class="error-message">Container too small.</p>`; return; }
     const svg = d3.select(targetDiv).append("svg").attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`).attr("preserveAspectRatio", "xMinYMid meet").append("g").attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);
     const x = d3.scaleBand().range([0, width]).domain(d3.range(7)).padding(0.2); const y = d3.scaleLinear().domain([0, d3.max(completeDayData, d => d[1]) || 1]).range([height, 0]).nice();
     svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x).tickFormat(d => dayOfWeekNames[d])).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", chartMargin.bottom - 15).attr("text-anchor", "middle").text("Day of Week");
     svg.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - chartMargin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Total Listening Time");
     svg.selectAll(".bar").data(completeDayData).enter().append("rect").attr("class", "bar").attr("x", d => x(d[0])).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", "#6f42c1").on("mouseover", (event, d) => showTooltip(event, `<b>${dayOfWeekNames[d[0]]}</b><br>${formatTime(d[1])}`)).on("mousemove", moveTooltip).on("mouseout", hideTooltip).transition().duration(500).attr("y", d => y(d[1])).attr("height", d => Math.max(0, height - y(d[1])));
}
async function drawStreamgraph(filteredData, containerId) { /* ... implementation ... */
    const container = document.getElementById(containerId); if (!container) return; container.innerHTML = "";
    if (!filteredData || filteredData.length === 0) { container.innerHTML = '<p class="empty-message">No data.</p>'; return; }
    const streamDataProcessed = filteredData.map(d => { let contentType = 'Music'; if (d.episode_name && String(d.episode_name).trim() !== "") contentType = 'Podcast'; return { ...d, contentType: contentType }; }).filter(d => d.ms_played > 0);
    if (streamDataProcessed.length === 0) { container.innerHTML = '<p class="empty-message">No Music/Podcast data.</p>'; return; }
    const contentTypes = ['Music', 'Podcast'];
    const [minDate, maxDate] = d3.extent(streamDataProcessed, d => d.ts); const timeDiffDays = (maxDate && minDate) ? (maxDate - minDate) / (1000*60*60*24) : 0;
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
    if (series.length === 0 || !series[0] || series[0].length === 0) { container.innerHTML = '<p class="empty-message">No stack layers.</p>'; return; }
    const areaGen = d3.area().x(d => xScale(d.data.timeBin)).y0(d => yScale(d[0])).y1(d => yScale(d[1])).curve(d3.curveBasis);
    svg.selectAll(".stream-layer").data(series).enter().append("path").attr("class", d => `stream-layer ${String(d.key).toLowerCase()}-layer`).attr("d", areaGen).attr("fill", d => colorScale(d.key)).attr("stroke", "#fff").attr("stroke-width", 0.5)
        .on("mouseover", (event, d_layer) => { /* ... */ }) .on("mousemove", moveTooltip).on("mouseout", (event, d) => { /* ... */ });
    let xAxisTicks; if (timeDiffDays <= 2) xAxisTicks = d3.timeHour.every(6); else if (timeDiffDays <= 14) xAxisTicks = d3.timeDay.every(1); else if (timeDiffDays <= 90) xAxisTicks = d3.timeWeek.every(1); else xAxisTicks = d3.timeMonth.every(1);
    svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale).ticks(xAxisTicks).tickFormat(d3.timeFormat(timeDiffDays > 30 ? "%b %Y" : "%a %d"))).append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", margin.bottom - 10).attr("text-anchor", "middle").text("Date / Time");
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".0%")); svg.append("g").attr("class", "axis axis--y").call(yAxis).append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("y", 0 - margin.left).attr("x", 0 - (height / 2)).attr("dy", "1em").attr("text-anchor", "middle").text("Listening Time Rate (%)");
    const legendContainer = svg.append("g").attr("class", "streamgraph-legend").attr("transform", `translate(${width - 100}, ${-10})`); const legendItems = legendContainer.selectAll(".legend-item").data(contentTypes).enter().append("g").attr("class", "legend-item").attr("transform", (d, i) => `translate(0, ${i * 15})`); legendItems.append("rect").attr("x", 0).attr("y", 0).attr("width", 10).attr("height", 10).attr("fill", d => colorScale(d)); legendItems.append("text").attr("x", 15).attr("y", 5).attr("dy", "0.35em").style("font-size", "10px").text(d => d);
    const descEl = container.nextElementSibling; if (descEl && descEl.classList.contains('chart-description')) descEl.innerHTML = "Proportional listening rate (%)";
}
async function drawForceGraph2(filteredData, containerId, topN = 10) { /* ... implementation ... */
    const container = document.getElementById(containerId); if (!container) { /* ... */ return; } container.innerHTML = "";
    if (!filteredData || filteredData.length < 2) { /* ... */ container.innerHTML = '<p class="empty-message">Not enough data.</p>'; return; }
    const musicData = filteredData.filter(d => d.artist && d.artist !== "Unknown Artist" && d.ms_played > 0).sort((a, b) => a.ts - b.ts);
    if (musicData.length < 2) { /* ... */ container.innerHTML = '<p class="empty-message">Not enough music.</p>'; return; }
    const artistCounts = d3.rollup(musicData, v => v.length, d => d.artist);
    const topArtistsMap = new Map(Array.from(artistCounts.entries()).sort(([, countA], [, countB]) => countB - countA).slice(0, topN));
    if (topArtistsMap.size < 2) { /* ... */ container.innerHTML = `<p class="empty-message">Fewer than 2 top artists.</p>`; return; }
    const transitions = new Map();
    for (let i = 0; i < musicData.length - 1; i++) { const sourceArtist = musicData[i].artist; const targetArtist = musicData[i + 1].artist; if (topArtistsMap.has(sourceArtist) && topArtistsMap.has(targetArtist) && sourceArtist !== targetArtist) { const key = `${sourceArtist}:::${targetArtist}`; transitions.set(key, (transitions.get(key) || 0) + 1); } }
    if (transitions.size === 0) { /* ... */ container.innerHTML = '<p class="empty-message">No transitions found.</p>'; return; }
    const nodes = Array.from(topArtistsMap.keys()).map(artist => ({ id: artist, playCount: topArtistsMap.get(artist) || 0 }));
    const links = Array.from(transitions.entries()).map(([key, count]) => { const [source, target] = key.split(":::"); return { source: source, target: target, value: count }; });

    const margin = { top: 10, right: 10, bottom: 10, left: 10 }; const containerWidth = container.clientWidth || 600; const containerHeight = 400; const width = containerWidth - margin.left - margin.right; const height = containerHeight - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) { /* ... */ container.innerHTML = '<p class="error-message">Container too small.</p>'; return; }
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`).attr("preserveAspectRatio", "xMinYMid meet").style("max-width", "100%").style("height", "auto");
    const mainGroup = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`); const zoomableGroup = mainGroup.append("g");
    mainGroup.append("rect").attr("width", width).attr("height", height).attr("fill", "none").attr("pointer-events", "all");
    zoomableGroup.append("defs").append("marker").attr("id", "arrowhead").attr("viewBox", "-0 -5 10 10").attr("refX", 15).attr("refY", 0).attr("orient", "auto").attr("markerWidth", 6).attr("markerHeight", 6).attr("xoverflow", "visible").append("svg:path").attr("d", "M 0,-5 L 10 ,0 L 0,5").attr("fill", "#999").style("stroke", "none");

    const minRadius = 5, maxRadius = 15; const playCountExtent = d3.extent(nodes, d => d.playCount);
    const nodeRadiusScale = d3.scaleSqrt().domain([playCountExtent[0] || 0, playCountExtent[1] || 1]).range([minRadius, maxRadius]);
    const nodeColorScale = d3.scaleSequential(d3.interpolateViridis).domain([playCountExtent[1] || 1, 0]);
    const maxStrokeWidth = 6; const linkWidthScale = d3.scaleLinear().domain([0, d3.max(links, d => d.value) || 1]).range([1, maxStrokeWidth]);

    const simulation = d3.forceSimulation(nodes) /* ... forces ... */
        .force("link", d3.forceLink(links).id(d => d.id).distance(90).strength(link => 1 / Math.min(link.source.playCount || 1, link.target.playCount || 1)))
        .force("charge", d3.forceManyBody().strength(-180))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => nodeRadiusScale(d.playCount) + 6).strength(0.8));

    const linkedByIndex = {}; links.forEach(d => { linkedByIndex[`${d.source.id || d.source},${d.target.id || d.target}`] = 1; });
    function areNeighbors(a, b) { return linkedByIndex[`${a.id},${b.id}`] || linkedByIndex[`${b.id},${a.id}`] || a.id === b.id; }

    const link = zoomableGroup.append("g").attr("class", "force-links").attr("stroke", "#999").attr("stroke-opacity", 0.5).selectAll("line").data(links).join("line").attr("stroke-width", d => linkWidthScale(d.value)).attr("marker-end", "url(#arrowhead)");
    link.append("title").text(d => `${d.source.id || d.source} → ${d.target.id || d.target}\n${d.value} transitions`);
    const node = zoomableGroup.append("g").attr("class", "force-nodes").attr("stroke", "#fff").attr("stroke-width", 1.5).selectAll("circle").data(nodes).join("circle").attr("r", d => nodeRadiusScale(d.playCount)).attr("fill", d => nodeColorScale(d.playCount)).call(drag(simulation));
    node.append("title").text(d => `${d.id}\n${d.playCount} plays`);
    const labels = zoomableGroup.append("g").attr("class", "force-labels").attr("font-family", "sans-serif").attr("font-size", 10).attr("fill", "#333").attr("stroke", "white").attr("stroke-width", 0.3).attr("paint-order", "stroke").attr("pointer-events", "none").selectAll("text").data(nodes).join("text").attr("dx", d => nodeRadiusScale(d.playCount) + 4).attr("dy", "0.35em").text(d => d.id);

    node.on("mouseover", highlight).on("mouseout", unhighlight); link.on("mouseover", highlightLink).on("mouseout", unhighlightLink);
    function highlight(event, d_hovered) { /* ... highlight logic ... */ } function unhighlight() { /* ... unhighlight logic ... */ } function highlightLink(event, d_hovered) { /* ... */ } function unhighlightLink(event, d_hovered) { /* ... */ }

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
    const descEl = container.nextElementSibling; if (descEl && descEl.classList.contains('chart-description')) { descEl.innerHTML = `Transitions between top ${nodes.length} artists.`; }
}

// --- Main Update Trigger ---
function handleBrushUpdate(filteredChartData) {
    const dataToUpdate = filteredChartData || [];
    // Call the bar chart functions
    updateTopArtistsChart(dataToUpdate);
    updateTopTracksChart(dataToUpdate); // Use the bar chart version
    // Keep existing calls for other charts
    updateTimeOfDayChart(dataToUpdate);
    updateDayOfWeekChart(dataToUpdate);
    drawStreamgraph(dataToUpdate, 'streamgraph-chart');
    drawForceGraph2(dataToUpdate, 'force-graph-chart');
}

// --- Core Visualization Update Function ---
function updateVisualization(filteredData) {
    const chartsToClear = [ topArtistsContainer, topTracksContainer, timeOfDayDiv, dayOfWeekDiv, document.getElementById('streamgraph-chart'), document.getElementById('force-graph-chart') ];
    if (calendarDiv) calendarDiv.innerHTML = ""; if (legendDiv) legendDiv.innerHTML = "";
    selectedStartDate = null; selectedEndDate = null; currentViewData = filteredData || [];

    if (!filteredData || filteredData.length === 0) { /* ... error handling ... */
        if (calendarDiv) calendarDiv.innerHTML = `<p class="empty-message">No data.</p>`;
        chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
        updateFilterInfoLabel(null, null); handleBrushUpdate([]); return;
    }
    const [viewStartDate, viewEndDate] = d3.extent(filteredData, d => d.ts);
    if (!viewStartDate || !viewEndDate || isNaN(viewStartDate) || isNaN(viewEndDate)) { /* ... error handling ... */
        if (calendarDiv) calendarDiv.innerHTML = `<p class="error-message">Invalid dates.</p>`;
        chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;});
        updateFilterInfoLabel(null, null); handleBrushUpdate([]); return;
    }

    const multiYearView = viewStartDate.getFullYear() !== viewEndDate.getFullYear();
    console.log(`Rendering Plot Mode (${multiYearView ? 'Multi-Year' : 'Single-Year'})`);

    // Draw calendar (handles multi-year internally & disables handles if needed)
    drawCalendar3(filteredData, viewStartDate, viewEndDate);

    // Update dependent charts
    if (multiYearView) {
         // Update charts with the entire filtered range
         handleBrushUpdate(filteredData);
         updateFilterInfoLabel(viewStartDate, viewEndDate);
    } else {
         // Initialize charts using the full single-year range initially
         // filterDataAndUpdateCharts will use selectedStartDate/EndDate set by drawCalendar2
         filterDataAndUpdateCharts(viewStartDate, viewEndDate);
    }
}

// --- Filter Data and Update Dependent Charts (Plot Mode Only) ---
function filterDataAndUpdateCharts(startDate, endDate) {
    const validStartDate = (startDate instanceof Date && !isNaN(startDate)) ? startDate : selectedStartDate;
    const validEndDate = (endDate instanceof Date && !isNaN(endDate)) ? endDate : selectedEndDate;

    if (!validStartDate || !validEndDate || !currentViewData || isNaN(validStartDate) || isNaN(validEndDate) || validStartDate > validEndDate) {
       console.warn("filterDataAndUpdateCharts: Invalid date range.", { validStartDate, validEndDate });
       handleBrushUpdate([]); // Clear plots
       updateFilterInfoLabel(validStartDate, validEndDate);
       return;
    }

    const filterStart = d3.timeDay.floor(validStartDate);
    const filterEnd = d3.timeDay.offset(d3.timeDay.floor(validEndDate), 1);
    const filtered = currentViewData.filter(d => {
       const dDate = d.ts;
       return dDate instanceof Date && !isNaN(dDate) && dDate >= filterStart && dDate < filterEnd;
    });

    console.log(`Filtered plot data: ${filtered.length} records.`);
    updateFilterInfoLabel(validStartDate, validEndDate);
    handleBrushUpdate(filtered); // Update plots with the filtered selection
}

// --- Event Listeners ---
if (wrappedYearSelect) {
    wrappedYearSelect.onchange = () => { /* ... implementation ... */
        const selectedYearValue = wrappedYearSelect.value;
        if (!selectedYearValue) { console.warn("Empty year."); return; }
        const selectedYear = +selectedYearValue;
        if (!selectedYear || isNaN(selectedYear)) { console.warn("Invalid year:", selectedYearValue); updateVisualization([]); return; }
        const yearStart = new Date(selectedYear, 0, 1); const yearEndFilter = new Date(selectedYear + 1, 0, 1);
        const filteredByYear = allParsedData.filter(d => d.ts >= yearStart && d.ts < yearEndFilter);
        if (startDateInput) startDateInput.value = formatDateForInput(yearStart);
        if (endDateInput) endDateInput.value = formatDateForInput(new Date(selectedYear, 11, 31));
        updateVisualization(filteredByYear);
     };
} else { console.error("#wrappedYearSelect not found."); }

if (applyRangeBtn) {
    applyRangeBtn.onclick = () => { /* ... implementation ... */
        const startStr = startDateInput.value; const endStr = endDateInput.value;
        const startMs = Date.parse(startStr); const endMs = Date.parse(endStr);
        let start = !isNaN(startMs) ? d3.timeDay.floor(new Date(startMs)) : null;
        let end = !isNaN(endMs) ? d3.timeDay.floor(new Date(endMs)) : null;
        if (!start || !end) { alert("Invalid date format (YYYY-MM-DD)."); return; }
        if (start > end) { console.warn("Swapping start/end dates."); [start, end] = [end, start]; startDateInput.value = formatDateForInput(start); endDateInput.value = formatDateForInput(end); }
        const filterEnd = d3.timeDay.offset(end, 1);
        if (wrappedYearSelect) wrappedYearSelect.value = "";
        const filteredByRange = allParsedData.filter(d => d.ts >= start && d.ts < filterEnd);
        updateVisualization(filteredByRange);
     };
} else { console.error("#applyRangeBtn not found."); }

