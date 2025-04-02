// --- Configuration ---
const cellSize = 15;
const cellPadding = 1.5;
const leftPadding = 40;
const topPadding = 25;
const noDataColor = "#ebedf0";
const calendarColorScale = d3.scaleSequential(d3.interpolateViridis);
const chartMargin = { top: 20, right: 20, bottom: 60, left: 50 }; // Margin for bar charts
const pieMargin = { top: 10, right: 10, bottom: 10, left: 10 }; // Margin for pie chart

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
// const genreDiv = document.getElementById('genre-chart');


// --- Helper Functions ---
const formatDay = d3.timeFormat("%Y-%m-%d");
const formatDate = d3.timeFormat("%a, %b %d, %Y");
const formatMonth = d3.timeFormat("%b");
const formatTime = (mins) => {
     if (mins < 1) return `< 1 min`;
    if (mins < 60) return `${Math.round(mins)} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = Math.round(mins % 60);
    return `${hours}h ${remainingMins}m`;
};
const formatDateForInput = d3.timeFormat("%Y-%m-%d");
const dayOfWeekNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// --- Global variables ---
let allParsedData = [];
let requiredColumns = { track_name: false}; // Flags for optional columns

// --- Data Processing (Runs once) ---
d3.csv("data/spotify_listening_history.csv").then(rawData => { // Ensure this path is correct relative to index.html
    // Check for optional columns - **ADAPT COLUMN NAMES IF YOURS ARE DIFFERENT**
    if (rawData.columns.includes('master_metadata_track_name')) {
        requiredColumns.track_name = true;
         console.log("Found 'master_metadata_track_name' column.");
    } else {
         console.warn("'master_metadata_track_name' column not found. Top Tracks chart will be disabled.");
    }
    //  if (rawData.columns.includes('genre')) { // *** Check/Adapt your genre column name here ***
    //     requiredColumns.genre = true;
    //      console.log("Found 'genre' column.");
    // } else {
    //     console.warn("'genre' column not found. Genre Breakdown chart will be disabled.");
    // }

    allParsedData = rawData.map(d => ({
        ts: new Date(d.ts),
        ms_played: +d.ms_played,
        artist: d.master_metadata_album_artist_name || "Unknown Artist",
        // Safely access optional columns
        track: requiredColumns.track_name ? (d.master_metadata_track_name || "Unknown Track") : "N/A",
        // genre: requiredColumns.genre ? (d.genre || "Unknown Genre") : "N/A",
    })).filter(d => d.ts instanceof Date && !isNaN(d.ts) && typeof d.ms_played === 'number' && !isNaN(d.ms_played) && d.ms_played >= 0); // Ensure ms_played is not negative

    console.log(`Loaded and parsed ${allParsedData.length} valid records.`);
    if (allParsedData.length === 0) {
        calendarDiv.innerHTML = `<p class="error-message">No valid data found in the CSV.</p>`;
        return;
    }

    const years = [...new Set(allParsedData.map(d => d.ts.getFullYear()))].sort((a, b) => a - b);
    years.forEach(y => {
        const opt = document.createElement('option'); opt.value = y; opt.textContent = y; yearSelect.appendChild(opt);
    });

    // --- Initial Load ---
    const defaultYear = years.length > 0 ? years[years.length - 1] : new Date().getFullYear();
    yearSelect.value = defaultYear;
    yearSelect.dispatchEvent(new Event('change')); // Trigger initial load

}).catch(error => {
     console.error("Error loading or processing data:", error);
    calendarDiv.innerHTML = `<p class="error-message">Error loading data. Check console.</p>`;
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

// --- Calendar Drawing (Accepts brush callback) ---
function drawCalendar(data, onBrushEndCallback) {
    calendarDiv.innerHTML = ""; // Clear previous
    legendDiv.innerHTML = ""; // Clear previous legend

    // Use the passed 'data' for filtering for calendar cells
    const listeningData = data.filter(d => d.ms_played > 0);

    if (listeningData.length === 0) {
            calendarDiv.innerHTML = `<p class="empty-message">No listening data for the selected period.</p>`;
            // Clear dependent charts when calendar is empty
            if (typeof handleBrushUpdate === 'function') { // Check if handler exists before calling
                 handleBrushUpdate([]);
            } else { // Fallback if called outside the main flow
                [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv].forEach(el => el.innerHTML = `<p class="empty-message">No data.</p>`);
            }
        return;
    }

    // --- Calculate daily aggregates from listeningData ---
    const dailyData = d3.rollups(
        listeningData,
        v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes per day
        d => formatDay(d.ts) // Group by day string YYYY-MM-DD
    );
    const valueMap = new Map(dailyData);

    // --- Determine date range and structure for the grid ---
    const datesInCurrentView = data.map(d => d.ts);
    if (datesInCurrentView.length === 0) { // Should be prevented by listeningData check, but safe
         calendarDiv.innerHTML = `<p class="empty-message">No dates found in data.</p>`;
         return;
    }
    const dataStartDate = d3.min(datesInCurrentView);
    const dataEndDate = d3.max(datesInCurrentView);

     // **** ADDED ROBUST CHECK ****
     if (!dataStartDate || !dataEndDate || !(dataStartDate instanceof Date) || !(dataEndDate instanceof Date) || isNaN(dataStartDate) || isNaN(dataEndDate)) {
          console.error("drawCalendar: Invalid date range derived from data.", dataStartDate, dataEndDate);
          calendarDiv.innerHTML = `<p class="error-message">Invalid date range in data.</p>`;
          // Clear dependent charts on error
          if (typeof handleBrushUpdate === 'function') { handleBrushUpdate([]); }
          return;
     }
     // **** END ADDED CHECK ****

    // --- Calculate the full range of days needed for the grid ---
    const firstDayOfMonthStart = d3.timeMonth.floor(dataStartDate);
    const firstDayOfNextMonthEnd = d3.timeMonth.offset(d3.timeMonth.floor(dataEndDate), 1);
    const allDays = d3.timeDays(firstDayOfMonthStart, firstDayOfNextMonthEnd);

    // Ensure allDays is not empty
    if (allDays.length === 0) {
        console.error("drawCalendar: No days generated for the grid range.", firstDayOfMonthStart, firstDayOfNextMonthEnd);
        calendarDiv.innerHTML = `<p class="error-message">Could not generate calendar grid days.</p>`;
        if (typeof handleBrushUpdate === 'function') { handleBrushUpdate([]); }
        return;
    }

    const startDay = allDays[0];
    const endDay = allDays[allDays.length - 1];
    const months = d3.timeMonths(startDay, endDay);

    // --- Calculate SVG dimensions ---
    const weekCount = d3.timeWeek.count(startDay, endDay) + 1;
    const width = weekCount * (cellSize + cellPadding) + leftPadding + 20; // Add some buffer
    const height = 7 * (cellSize + cellPadding) + topPadding + 30; // Add buffer for label/brush

    // --- Color Scale Domain ---
    const maxMinutes = d3.max(valueMap.values());
    calendarColorScale.domain([0, maxMinutes || 1]); // Set domain for color scale

    // --- Create SVG ---
    const svg = d3.select("#calendar").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${leftPadding}, ${topPadding})`);

    // --- Draw Labels (Days & Months) ---
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    svg.selectAll(".day-label")
        .data(d3.range(7))
        .enter().append("text")
        .attr("class", "day-label")
        .attr("x", -15)
        .attr("y", d => d * (cellSize + cellPadding) + cellSize / 2)
        .text(d => dayLabels[d]);

    svg.selectAll(".month-label")
        .data(months)
        .enter().append("text")
        .attr("class", "month-label")
        .attr("x", d => d3.timeWeek.count(startDay, d) * (cellSize + cellPadding))
        .attr("y", -10)
        .text(formatMonth);

    // --- Draw Day Cells ---
    const cells = svg.selectAll(".day-cell")
        .data(allDays) // Use the robustly calculated allDays
        .enter().append("rect")
        .attr("class", "day-cell")
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("rx", 2).attr("ry", 2)
        .attr("x", d => d3.timeWeek.count(startDay, d) * (cellSize + cellPadding))
        .attr("y", d => d.getDay() * (cellSize + cellPadding))
        .attr("fill", noDataColor) // Default fill before transition
        .on("mouseover", (event, d) => {
            const key = formatDay(d);
            const valueMins = valueMap.get(key) || 0;
            showTooltip(event, `${formatDate(d)}<br><b>${formatTime(valueMins)}</b>`);
            d3.select(event.currentTarget).attr("stroke", "#333").attr("stroke-width", 1);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", (event) => {
            hideTooltip();
            d3.select(event.currentTarget).attr("stroke", "#ffffff").attr("stroke-width", cellPadding); // Restore border
        });

    // Apply transition AFTER setting up listeners and initial attributes
    cells.transition().duration(500)
        .attr("fill", d => {
            const key = formatDay(d);
            const value = valueMap.get(key);
            return value === undefined ? noDataColor : calendarColorScale(value);
        });

    // --- Draw Legend ---
    drawLegend(legendDiv, calendarColorScale, maxMinutes);

    // --- Brush Logic ---
    const brush = d3.brush()
        .extent([[0, 0], [width - leftPadding - 20 , 7 * (cellSize + cellPadding)]])
        .on("end", brushed); // Call internal brushed function

    const brushG = svg.append("g").attr("class", "brush").call(brush);

    svg.select(".selected-range-label").remove(); // Clear any previous label

    // Internal brush handler specific to this calendar instance
    function brushed(event) {
        svg.select(".selected-range-label").remove(); // Clear previous label on new brush action

        // Use the callback passed into drawCalendar
        const callback = onBrushEndCallback;
         if (typeof callback !== 'function') {
             console.warn("drawCalendar: onBrushEndCallback is not a function!");
             return; // Cannot proceed without the callback
         }

        if (!event.selection) {
            // If selection cleared, reset Top 5 to show overall for the current view
            console.log("Brush cleared. Updating charts with full data for current view.");
            callback(data); // Use the 'data' passed into drawCalendar
            return;
        }

        const [[x0, y0], [x1, y1]] = event.selection;

        const selectedDates = allDays.filter(d => {
            const cellX = d3.timeWeek.count(startDay, d) * (cellSize + cellPadding) + cellSize / 2;
            const cellY = d.getDay() * (cellSize + cellPadding) + cellSize / 2;
            return cellX >= x0 && cellX <= x1 &&
                   cellY >= y0 && cellY <= y1;
        });

        if (selectedDates.length > 0) {
            const brushStartDate = d3.min(selectedDates);
            const brushEndDate = d3.max(selectedDates);

             if (!brushStartDate || !brushEndDate) {
                 console.warn("Brush selected invalid date range.");
                 callback([]); // Send empty data
                 return;
             }

            // Add label showing selected range
            svg.append("text")
                .attr("class", "selected-range-label")
                .attr("x", (width - leftPadding - 20) / 2)
                .attr("y", 7 * (cellSize + cellPadding) + 15) // Position below cells
                .attr("text-anchor", "middle")
                .text(`Selected: ${formatDate(brushStartDate)} → ${formatDate(brushEndDate)}`);

            const dayAfterBrushEnd = d3.timeDay.offset(brushEndDate, 1);
            const filteredForBrush = data.filter(d => {
                const dDate = d.ts;
                return dDate instanceof Date && dDate >= brushStartDate && dDate < dayAfterBrushEnd;
            });
            console.log(`Brush active. Updating charts with ${filteredForBrush.length} brushed records.`);
            callback(filteredForBrush); // Update dependent charts based on brushed selection
        } else {
            console.log("Brush active but selected no valid dates. Clearing dependent charts.");
            callback([]); // Clear dependent charts
        }
    }
} // End of drawCalendar function

// --- Legend Drawing ---
function drawLegend(container, scale, maxValue) {
    container.innerHTML = ""; // Clear previous legend
    if (maxValue === undefined || maxValue <= 0) return; // Don't draw if no max value

    const legendWidth = 200;
    const legendHeight = 20;
    const legendMargin = { top: 0, right: 10, bottom: 15, left: 10 }; // Adjusted margin
    const barHeight = 8;

    const legendSvg = d3.select(container)
        .append("svg")
        .attr("width", legendWidth)
        .attr("height", legendHeight + legendMargin.top + legendMargin.bottom);

    const legendDefs = legendSvg.append("defs");

    const linearGradient = legendDefs.append("linearGradient")
        .attr("id", "calendar-gradient");

    // Create gradient stops from the color scale's interpolator
    const numStops = 10;
    linearGradient.selectAll("stop")
        .data(d3.range(numStops + 1))
        .enter().append("stop")
        .attr("offset", d => `${(d / numStops) * 100}%`)
        .attr("stop-color", d => scale(maxValue * (d / numStops)));

    // Draw the legend rectangle filled with the gradient
    legendSvg.append("rect")
        .attr("x", legendMargin.left)
        .attr("y", legendMargin.top)
        .attr("width", legendWidth - legendMargin.left - legendMargin.right)
        .attr("height", barHeight)
        .style("fill", "url(#calendar-gradient)")
        .attr("rx", 2).attr("ry", 2); // Rounded corners

    // Add labels
    legendSvg.append("text")
        .attr("class", "legend-label")
        .attr("x", legendMargin.left)
        .attr("y", legendMargin.top + barHeight + 10) // Position below bar
        .attr("text-anchor", "start")
        .text("Less");

    legendSvg.append("text")
        .attr("class", "legend-label")
        .attr("x", legendWidth - legendMargin.right)
        .attr("y", legendMargin.top + barHeight + 10) // Position below bar
        .attr("text-anchor", "end")
        .text("More");
}


// --- Top Artists Update ---
function updateTopArtists(data) {
    const targetUl = document.getElementById('topArtists');
    if (!targetUl) {
        console.error("Target UL #topArtists not found!");
        return;
    }
    targetUl.innerHTML = ""; // Clear previous list

    console.log("updateTopArtists: Received data count:", data ? data.length : 0);

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

     console.log("Top 5 Artists calculated:", artistData);

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

// --- NEW: Top Tracks Chart ---
function updateTopTracksChart(data) {
    topTracksDiv.innerHTML = ""; // Clear previous
    if (!requiredColumns.track_name) {
        topTracksDiv.innerHTML = `<p class="info-message">'Track Name' column not found in data.</p>`;
        return;
    }
    if (!data || data.length === 0) { topTracksDiv.innerHTML = `<p class="empty-message">No data for this selection.</p>`; return; }

    const trackData = d3.rollups(
        data.filter(d => d.track && d.track !== "Unknown Track" && d.track !== "N/A" && d.ms_played > 0),
        v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes
        d => `${d.track} • ${d.artist}` // Combine track and artist for uniqueness
    )
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 15); // Top 15 tracks

    if (trackData.length === 0) { topTracksDiv.innerHTML = `<p class="empty-message">No track data found.</p>`; return; }

    const chartHeight = trackData.length * 25 + chartMargin.top + chartMargin.bottom; // Dynamic height
    const chartWidth = topTracksDiv.clientWidth || 400; // Use container width
    const width = chartWidth - chartMargin.left - chartMargin.right;
    const height = chartHeight - chartMargin.top - chartMargin.bottom;

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
        .domain([0, d3.max(trackData, d => d[1]) || 1])
        .range([0, width]);

    svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => formatTime(d)))
        .append("text")
         .attr("class", "axis-label")
         .attr("x", width / 2)
         .attr("y", chartMargin.bottom - 10)
         .attr("text-anchor", "middle")
         .text("Total Listening Time");


    svg.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y).tickSize(0))
        .select(".domain").remove(); // Remove y-axis line

    svg.selectAll(".bar")
        .data(trackData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("y", d => y(d[0]))
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", 0) // Start width at 0 for transition
        .attr("fill", "#1DB954")
         .on("mouseover", (event, d) => showTooltip(event, `<b>${d[0]}</b><br>${formatTime(d[1])}`))
         .on("mousemove", moveTooltip)
         .on("mouseout", hideTooltip)
         .transition().duration(500) // Add transition
         .attr("width", d => x(d[1]));


     // Improve Y-axis text rendering (optional)
     svg.selectAll(".axis--y text")
         .attr("x", -5) // Adjust position slightly
         .each(function(d) { // Truncate long labels
             const self = d3.select(this);
             let text = d;
             const maxWidth = chartMargin.left - 10; // Max width before truncation
             while (self.node().getComputedTextLength() > maxWidth && text.length > 10) {
                 text = text.slice(0, -4) + "...";
                 self.text(text);
             }
         });
}

// --- NEW: Time of Day Chart ---
function updateTimeOfDayChart(data) {
    timeOfDayDiv.innerHTML = ""; // Clear previous
    if (!data || data.length === 0) { timeOfDayDiv.innerHTML = `<p class="empty-message">No data for this selection.</p>`; return; }

    const hourData = d3.rollups(
        data.filter(d => d.ms_played > 0),
        v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes
        d => d.ts.getHours() // Group by hour (0-23)
    );
    const hourMap = new Map(hourData);
    const completeHourData = d3.range(24).map(h => [h, hourMap.get(h) || 0]); // Ensure all hours are present

     const chartWidth = timeOfDayDiv.clientWidth || 400;
     const chartHeight = 250; // Fixed height
     const width = chartWidth - chartMargin.left - chartMargin.right;
     const height = chartHeight - chartMargin.top - chartMargin.bottom;

    const svg = d3.select(timeOfDayDiv).append("svg")
         .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
         .append("g")
         .attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);

     const x = d3.scaleBand()
         .range([0, width])
         .domain(d3.range(24))
         .padding(0.2);

     const y = d3.scaleLinear()
         .domain([0, d3.max(completeHourData, d => d[1]) || 1])
         .range([height, 0]); // Y=0 is at the top

     svg.append("g")
         .attr("class", "axis axis--x")
         .attr("transform", `translate(0, ${height})`)
         .call(d3.axisBottom(x).tickValues(d3.range(0, 24, 3))) // Show fewer ticks
         .append("text")
         .attr("class", "axis-label")
         .attr("x", width / 2)
         .attr("y", chartMargin.bottom - 10)
         .attr("text-anchor", "middle")
         .text("Hour of Day");

    svg.append("g")
         .attr("class", "axis axis--y")
         .call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d))) // Format Y axis as time
         .append("text")
         .attr("class", "axis-label")
         .attr("transform", "rotate(-90)")
         .attr("y", -chartMargin.left + 15)
         .attr("x", -height / 2)
         .attr("text-anchor", "middle")
         .text("Total Listening Time");

    svg.selectAll(".bar")
         .data(completeHourData)
         .enter().append("rect")
         .attr("class", "bar")
         .attr("x", d => x(d[0]))
         .attr("width", x.bandwidth())
         .attr("y", height) // Start at bottom
         .attr("height", 0) // Start with 0 height
         .attr("fill", "#fd7e14") // Orange color
         .on("mouseover", (event, d) => showTooltip(event, `<b>Hour ${d[0]}</b><br>${formatTime(d[1])}`))
         .on("mousemove", moveTooltip)
         .on("mouseout", hideTooltip)
         .transition().duration(500)
         .attr("y", d => y(d[1]))
         .attr("height", d => height - y(d[1]));
}

// --- NEW: Day of Week Chart ---
function updateDayOfWeekChart(data) {
    dayOfWeekDiv.innerHTML = ""; // Clear previous
     if (!data || data.length === 0) { dayOfWeekDiv.innerHTML = `<p class="empty-message">No data for this selection.</p>`; return; }

     const dayData = d3.rollups(
         data.filter(d => d.ms_played > 0),
         v => d3.sum(v, d => d.ms_played / 60000), // Sum minutes
         d => d.ts.getDay() // Group by day index (0=Sun, 6=Sat)
     );
     const dayMap = new Map(dayData);
     const completeDayData = d3.range(7).map(dayIndex => [dayIndex, dayMap.get(dayIndex) || 0]);

     const chartWidth = dayOfWeekDiv.clientWidth || 400;
     const chartHeight = 250;
     const width = chartWidth - chartMargin.left - chartMargin.right;
     const height = chartHeight - chartMargin.top - chartMargin.bottom;

     const svg = d3.select(dayOfWeekDiv).append("svg")
         .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
         .append("g")
         .attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);

     const x = d3.scaleBand()
         .range([0, width])
         .domain(d3.range(7)) // Domain is 0-6
         .padding(0.2);

     const y = d3.scaleLinear()
         .domain([0, d3.max(completeDayData, d => d[1]) || 1])
         .range([height, 0]);

    svg.append("g")
         .attr("class", "axis axis--x")
         .attr("transform", `translate(0, ${height})`)
         .call(d3.axisBottom(x).tickFormat(d => dayOfWeekNames[d])) // Use names for ticks
         .append("text")
         .attr("class", "axis-label")
         .attr("x", width / 2)
         .attr("y", chartMargin.bottom - 10)
         .attr("text-anchor", "middle")
         .text("Day of Week");


    svg.append("g")
         .attr("class", "axis axis--y")
         .call(d3.axisLeft(y).ticks(5).tickFormat(d => formatTime(d)))
         .append("text")
         .attr("class", "axis-label")
         .attr("transform", "rotate(-90)")
         .attr("y", -chartMargin.left + 15)
         .attr("x", -height / 2)
         .attr("text-anchor", "middle")
         .text("Total Listening Time");

    svg.selectAll(".bar")
         .data(completeDayData)
         .enter().append("rect")
         .attr("class", "bar")
         .attr("x", d => x(d[0]))
         .attr("width", x.bandwidth())
         .attr("y", height)
         .attr("height", 0)
         .attr("fill", "#6f42c1") // Purple color
         .on("mouseover", (event, d) => showTooltip(event, `<b>${dayOfWeekNames[d[0]]}</b><br>${formatTime(d[1])}`))
         .on("mousemove", moveTooltip)
         .on("mouseout", hideTooltip)
         .transition().duration(500)
         .attr("y", d => y(d[1]))
         .attr("height", d => height - y(d[1]));
}

// --- Main Brush Handler ---
function handleBrushUpdate(brushedData) {
    console.log("handleBrushUpdate called with data count:", brushedData ? brushedData.length : 0);
    // Update all charts that depend on the selection
    updateTopArtists(brushedData);
    updateTopTracksChart(brushedData);
    updateTimeOfDayChart(brushedData);
    updateDayOfWeekChart(brushedData);
    // updateGenreChart(brushedData); // Uncomment if using genre chart
}

// --- Main Update Function (Called on Year/Date Change) ---
function updateVisualization(filteredData) {
     console.log("updateVisualization: Updating with data count:", filteredData ? filteredData.length : 0);
     const chartsToClear = [topArtistsUl, topTracksDiv, timeOfDayDiv, dayOfWeekDiv]; // Add genreDiv if used
     if (!filteredData || filteredData.length === 0) {
        calendarDiv.innerHTML = `<p class="empty-message">No listening data for the selected period.</p>`;
        legendDiv.innerHTML = "";
        chartsToClear.forEach(el => { if(el) el.innerHTML = `<p class="empty-message">No data.</p>`;}); // Check if el exists
        return;
    }
     // Draw calendar, passing the central brush handler
     drawCalendar(filteredData, handleBrushUpdate);

     // Initialize all dependent charts with the full view data using the handler
     handleBrushUpdate(filteredData);
}

// --- Event Listeners ---
yearSelect.onchange = () => {
    const selectedYear = +yearSelect.value;
    const filteredByYear = allParsedData.filter(d => d.ts.getFullYear() === selectedYear);
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31);
    startDateInput.value = formatDateForInput(yearStart);
    endDateInput.value = formatDateForInput(yearEnd);
    updateVisualization(filteredByYear);
 };

applyRangeBtn.onclick = () => {
    const startStr = startDateInput.value; const endStr = endDateInput.value;
    const start = startStr ? new Date(startStr + 'T00:00:00') : null;
    const end = endStr ? new Date(endStr + 'T23:59:59') : null;
    if (!start || !end || isNaN(start) || isNaN(end) || start > end) { alert("Please select a valid start and end date range."); return; }
    yearSelect.value = ""; // Clear year selection
    const filteredByRange = allParsedData.filter(d => d.ts >= start && d.ts <= end);
    updateVisualization(filteredByRange);
 };

// --- Genre Chart (Optional - uncomment if needed) ---
/*
function updateGenreChart(data) {
    // ... (paste the original updateGenreChart function code here) ...
}
*/