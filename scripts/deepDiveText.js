// Global variable to track the current artist (for time range filtering)
let currentArtistName = "";

/***********************
 * Update Time Controls for the Selected Artist
 ***********************/
function updateTimeControls(artistData, artistName) {
  const dates = artistData.map((d) => new Date(d.ts));
  const minDate = new Date(Math.min.apply(null, dates));
  const maxDate = new Date(Math.max.apply(null, dates));
  const formatDate = (d) => d.toISOString().split("T")[0];

  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  startDateInput.value = formatDate(minDate);
  endDateInput.value = formatDate(maxDate);
  startDateInput.min = formatDate(minDate);
  startDateInput.max = formatDate(maxDate);
  endDateInput.min = formatDate(minDate);
  endDateInput.max = formatDate(maxDate);

  const yearSelect = document.getElementById("yearSelect");
  yearSelect.innerHTML = "";

  // Get unique years from the artist data.
  const uniqueYears = Array.from(
    new Set(artistData.map((d) => new Date(d.ts).getFullYear()))
  ).sort((a, b) => a - b);

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.text = "All Years";
  yearSelect.appendChild(defaultOption);

  uniqueYears.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.text = year;
    yearSelect.appendChild(option);
  });

  // When a year is selected, update the date range to that year.
  yearSelect.addEventListener("change", function () {
    const selectedYear = parseInt(this.value);
    if (!isNaN(selectedYear)) {
      const yearStart = new Date(selectedYear, 0, 1);
      const yearEnd = new Date(selectedYear, 11, 31);
      startDateInput.value = formatDate(yearStart);
      endDateInput.value = formatDate(yearEnd);
    } else {
      startDateInput.value = formatDate(minDate);
      endDateInput.value = formatDate(maxDate);
    }
  });

  // Attach a reset event listener to the "Reset Controls" button.
  const resetButton = document.getElementById("resetRangeBtn");
  if (resetButton) {
    resetButton.addEventListener("click", function () {
      yearSelect.value = "";
      startDateInput.value = formatDate(minDate);
      endDateInput.value = formatDate(maxDate);

      const filteredData = window.allParsedData.filter((d) => {
        const date = new Date(d.ts);
        return date >= minDate && date <= maxDate;
      });
      updateAllCharts(filteredData, artistName);
    });
  } else {
    console.error("Reset Range button not found in the DOM");
  }
}

/***********************
 * Linegraph of peak listenings
 ***********************/
function updatePeakListening(data, artistName) {
  // Filter data for the artist
  const artistData = data.filter(
    (d) =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() ===
        artistName.toLowerCase()
  );

  // Remove any existing chart
  const container = d3.select("#peakListening");
  container.selectAll("svg").remove();

  if (!artistData.length) {
    container.selectAll("p.peak-message").remove();
    container
      .append("p")
      .attr("class", "peak-message")
      .text("No listening data available for this artist.");
    return;
  } else {
    container.selectAll("p.peak-message").remove();
  }

  // Determine date range
  const parseDate = (d) => new Date(d.ts);
  const dates = artistData.map(parseDate);
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const diffDays = (maxDate - minDate) / (1000 * 3600 * 24);

  // Decide on grouping strategy based on diffDays
  let groupFn, xFormat;
  if (diffDays < 7) {
    // 1) No grouping (one point per record)
    // We basically treat each record as its own x-value
    // so we can see day-to-day (or minute-to-minute) changes
    // if your data is that granular.
    groupFn = (d) => parseDate(d); // no grouping
    xFormat = d3.timeFormat("%b %d, %H:%M"); // e.g. "May 02, 13:45"
  } else if (diffDays <= 60) {
    // 2) Group by day
    groupFn = (d) => d3.timeDay(parseDate(d));
    xFormat = d3.timeFormat("%b %d"); // e.g. "May 02"
  } else {
    // 3) Group by week
    groupFn = (d) => d3.timeWeek(parseDate(d));
    xFormat = d3.timeFormat("%b %d"); // e.g. "May 02"
  }

  // Aggregate data by chosen grouping
  const grouped = d3.rollups(
    artistData,
    (v) => d3.sum(v, (d) => +d.ms_played / 60000),
    groupFn
  );

  // Sort groups by date
  grouped.sort((a, b) => a[0] - b[0]);

  // If we did "no grouping," we effectively have one data point per record.
  // If we grouped by day or week, we have sums for that day/week.

  // Dimensions
  const margin = { top: 20, right: 30, bottom: 20, left: 50 },
    width = 800 - margin.left - margin.right,
    height = 150 - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr(
      "viewBox",
      `0 0 ${width + margin.left + margin.right} ${
        height + margin.top + margin.bottom
      }`
    )
    .attr("preserveAspectRatio", "xMidYMid meet")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Create scales
  const xScale = d3
    .scaleTime()
    .domain(d3.extent(grouped, (d) => d[0]))
    .range([0, width]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(grouped, (d) => d[1])])
    .nice()
    .range([height, 0]);

  // Define line generator
  const line = d3
    .line()
    .x((d) => xScale(d[0]))
    .y((d) => yScale(d[1]))
    .curve(d3.curveLinear);

  // Append axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(xFormat))
    .append("text")
    .attr("fill", "#000")
    .attr("x", width / 2)
    .attr("y", 40)
    .attr("text-anchor", "middle")
    .text("Time");

  svg
    .append("g")
    .call(d3.axisLeft(yScale))
    .append("text")
    .attr("fill", "#000")
    .attr("transform", "rotate(-90)")
    .attr("y", -40)
    .attr("x", -height / 2)
    .attr("text-anchor", "middle")
    .text("Minutes Played");

  // Draw the line
  // Area under the line
  const area = d3
    .area()
    .x((d) => xScale(d[0]))
    .y0(height)
    .y1((d) => yScale(d[1]))
    .curve(d3.curveMonotoneX);

  svg
    .append("path")
    .datum(grouped)
    .attr("fill", "#4caf4f")
    .attr("fill-opacity", 0.2)
    .attr("d", area);

  // Line itself
  svg
    .append("path")
    .datum(grouped)
    .attr("fill", "none")
    .attr("stroke", "#4caf4f")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Circle for peak
  const peak = grouped.reduce((a, b) => (a[1] > b[1] ? a : b));
  svg
    .append("circle")
    .attr("cx", xScale(peak[0]))
    .attr("cy", yScale(peak[1]))
    .attr("r", 5)
    .attr("fill", "#388e3c");

  // Label for peak
  svg
    .append("text")
    .attr("x", xScale(peak[0]))
    .attr("y", yScale(peak[1]) - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "0.8rem")
    .style("fill", "#2e7d32")
    .text(`${peak[1].toFixed(1)} min`);

  // Remove the code that adds circles for data points.
  // (If you need tooltips, consider using mouse events on the line itself.)

  // Add the brush.
  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [width, height],
    ])
    .on("end", brushed);

  svg.append("g").attr("class", "brush").call(brush);

  // Brush event handler.
  function brushed({ selection }) {
    if (!selection) return; // Ignore if no selection.
    const [x0, x1] = selection;
    const date0 = xScale.invert(x0);
    const date1 = xScale.invert(x1);
    // Update the date range controls (assumes they exist in your DOM).
    document.getElementById("startDate").value = date0
      .toISOString()
      .split("T")[0];
    document.getElementById("endDate").value = date1
      .toISOString()
      .split("T")[0];
    // Optionally, you can trigger an update of all charts using the new date range.
    //For example:
    const filteredData = window.allParsedData.filter((d) => {
      const date = new Date(d.ts);
      return date >= date0 && date <= date1;
    });
    updateAllCharts(filteredData, artistName);

    // Clear the brush selection.
    d3.select(this).call(brush.move, null);
  }
}

function wrapText(text, width) {
  text.each(function () {
    const textEl = d3.select(this);
    const words = textEl.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1; // ems
    const y = textEl.attr("y");
    const x = textEl.attr("x");
    const dy = parseFloat(textEl.attr("dy")) || 0;

    textEl.text(null); // Clear existing text
    let tspan = textEl
      .append("tspan")
      .attr("x", x)
      .attr("y", y)
      .attr("dy", dy + "em");

    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = textEl
          .append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .text(word);
      }
    }
  });
}

/***********************
 * Drill-Down: Song Distribution as a Radar Chart
 ***********************/
function updateAlbumDistribution(artistData) {
  const placeholder = d3.select("#albumPlaceholder");

  // Hide placeholder if album is selected
  if (drillDownState.selectedAlbum) {
    placeholder.style("display", "none");
  } else {
    placeholder.style("display", "block");
  }

  // Filter data based on drill-down state.
  let filtered = artistData;
  let headerText = "Showing ";
  if (drillDownState.selectedYear) {
    filtered = filtered.filter(
      (d) => new Date(d.ts).getFullYear() === drillDownState.selectedYear
    );
    headerText += `data for Year: ${drillDownState.selectedYear}`;
  }
  if (drillDownState.selectedAlbum) {
    filtered = filtered.filter(
      (d) =>
        d.master_metadata_album_album_name.toLowerCase() ===
        drillDownState.selectedAlbum.toLowerCase()
    );
    headerText += drillDownState.selectedYear
      ? ` & Album: <strong> ${drillDownState.selectedAlbum} </strong>`
      : `data for Album: <strong> ${drillDownState.selectedAlbum} </strong>`;
  }

  if (filtered.length === 0) {
    const chartContainer = d3.select("#albumDist");
    chartContainer.selectAll(":not(h2)").remove();
    chartContainer
      .append("p")
      .attr("class", "empty-message")
      .text("No song data for the selected criteria.");
    return;
  }

  // Aggregate data by track: total minutes played per song.
  const songData = d3
    .rollups(
      filtered,
      (v) => d3.sum(v, (d) => +d.ms_played / 60000),
      (d) => d.master_metadata_track_name
    )
    .map(([track, minutes]) => ({ track, minutes }));

  // Remove any existing chart elements below the header.
  const chartContainer = d3.select("#albumDist");
  chartContainer.selectAll(":not(h2)").remove();

  // Append an info div with header and reset button.
  const infoDiv = chartContainer
    .append("div")
    .attr("class", "infoDiv")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("align-items", "center")
    .style("margin-bottom", "10px");

  infoDiv
    .append("p")
    .attr("id", "albumDist")
    .style("margin", "0")
    .html(headerText);

  infoDiv
    .append("button")
    .attr("class", "button")
    .attr("id", "resetButton")
    .style("cursor", "pointer")
    .text("X")
    .on("click", () => {
      drillDownState.selectedYear = null;
      drillDownState.selectedAlbum = null;
      chartContainer.selectAll(":not(h2)").remove();

      chartContainer
        .append("p")
        .attr("id", "albumPlaceholder")
        .style("text-align", "center")
        .style("font-style", "italic")
        .style("color", "#555")
        .style("margin-bottom", "10px")
        .text("Select an album to see more details");

      updateSunburstChart(window.allParsedData, currentArtistName);
    });

  // ***************************
  // Compute album detail metrics
  // ***************************
  const totalAlbumPlays = filtered.length;
  const totalAlbumMinutes = d3.sum(filtered, (d) => +d.ms_played / 60000);
  // Group by year to find peak listening period.
  const listensByYear = d3.rollups(
    filtered,
    (v) => d3.sum(v, (d) => +d.ms_played / 60000),
    (d) => new Date(d.ts).getFullYear()
  );
  listensByYear.sort((a, b) => b[1] - a[1]);
  const peakYear = listensByYear.length ? listensByYear[0][0] : "N/A";
  const peakYearMinutes = listensByYear.length ? listensByYear[0][1] : 0;
  // Determine the first listened date.
  const dates = filtered.map((d) => new Date(d.ts));
  const minDate = new Date(Math.min(...dates));

  // Group filtered data by day.
  const dailyMinutesMap = d3.rollups(
    filtered,
    (v) => d3.sum(v, (d) => +d.ms_played / 60000),
    (d) => new Date(d.ts).toISOString().split("T")[0]
  );

  // Convert to sorted array of objects { day: Date, minutes: Number }
  const dailyData = dailyMinutesMap
    .map(([day, minutes]) => ({
      day: new Date(day),
      minutes: minutes,
    }))
    .sort((a, b) => a.day - b.day);

  let bestPeriod = { start: null, end: null, total: 0, days: 0 };
  let curStart = null;
  let curEnd = null;
  let curTotal = 0;
  for (let i = 0; i < dailyData.length; i++) {
    if (i === 0) {
      curStart = dailyData[i].day;
      curEnd = dailyData[i].day;
      curTotal = dailyData[i].minutes;
    } else {
      const prev = dailyData[i - 1].day;
      const curr = dailyData[i].day;
      const diffDays = (curr - prev) / (1000 * 3600 * 24);

      if (diffDays <= 2) {
        curEnd = curr;
        curTotal += dailyData[i].minutes;
      } else {
        // End of a consecutive block.
        if (curTotal > bestPeriod.total) {
          bestPeriod = {
            start: curStart,
            end: curEnd,
            total: curTotal,
            days: Math.round((curEnd - curStart) / (1000 * 3600 * 24)) + 1,
          };
        }
        curStart = curr;
        curEnd = curr;
        curTotal = dailyData[i].minutes;
      }
    }
  }
  if (curTotal > bestPeriod.total) {
    bestPeriod = {
      start: curStart,
      end: curEnd,
      total: curTotal,
      days: Math.round((curEnd - curStart) / (1000 * 3600 * 24)) + 1,
    };
  }

  // Format the spike period details with a personal tone.
  const spikeDetailsText = bestPeriod.start
    ? `Your most intense listening period for this album was from <strong>${bestPeriod.start.toLocaleDateString()}</strong> to <strong>${bestPeriod.end.toLocaleDateString()}</strong> (over ${
        bestPeriod.days
      } days), during which you listened for a total of <strong>${bestPeriod.total.toFixed(
        1
      )}</strong> minutes.`
    : "We couldn't detect a significantly intense listening period.";

  // ***************************
  // Append album details above the charts.
  // ***************************
  const albumDetailsDiv = chartContainer
    .append("div")
    .attr("class", "albumDetails")
    // Reduced margins and padding for a tighter look.
    .style("margin-bottom", "calc(var(--spacing) * 0.5)")
    .style("font-size", "var(--font-small-size)")
    .style("padding", "var(--spacing)")
    .style("border", "1px solid #ddd")
    .style("border-radius", "var(--border-radius-small)")
    .style("background", "rgba(76, 175, 79, 0.1)");

  albumDetailsDiv.html(`
      <p style="margin: 2px 0;"><strong>Album Details:</strong></p>
      <p style="margin: 2px 0;">You first listened to this album on <strong>${minDate.toLocaleDateString()}</strong> and have played it <strong>${totalAlbumPlays} times</strong> since then.</p>
      <p style="margin: 2px 0;">Your total listening time is <strong>${totalAlbumMinutes.toFixed(
        1
      )}</strong> minutes, with your peak listening year being <strong>${peakYear}</strong> (when you played <strong>${peakYearMinutes.toFixed(
    1
  )}</strong> minutes).</p>
      <p style="margin: 2px 0;">${spikeDetailsText}</p>
  `);

  // Create a container for the chart.
  const chartArea = chartContainer.append("div").attr("class", "chartArea");

  // If there are 2 or fewer songs, display a bar plot with wrapped tick labels.
  if (songData.length <= 2) {
    const margin = { top: 30, right: 20, bottom: 50, left: 60 };
    const width = 400 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = chartArea
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X scale for track names.
    const x = d3
      .scaleBand()
      .domain(songData.map((d) => d.track))
      .range([0, width])
      .padding(0.3);

    // Y scale for minutes played.
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(songData, (d) => d.minutes)])
      .nice()
      .range([height, 0]);

    // Append the X axis without rotation.
    const xAxis = svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

    // Wrap long tick labels using the available band width.
    xAxis.selectAll("text").each(function () {
      wrapText(d3.select(this), x.bandwidth(), 2);
    });

    // Append Y axis.
    svg.append("g").call(d3.axisLeft(y));

    // Append bars.
    svg
      .selectAll("rect")
      .data(songData)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.track))
      .attr("y", (d) => y(d.minutes))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - y(d.minutes))
      .attr("fill", "#4caf4f")
      .append("title")
      .text((d) => `${d.track}: ${d.minutes.toFixed(1)} minutes`);
  } else {
    // If more than 2 songs, create the radar chart.
    const overallSize = 250;
    const margin = { top: 20, right: 0, bottom: 20, left: 0 }; // Reduced margins
    const width = 400;
    const height = overallSize - margin.top - margin.bottom;
    const radius = Math.min(width, height) / 2 - 10;
    const numAxes = songData.length;
    const maxValue = d3.max(songData, (d) => d.minutes);
    const angleSlice = (Math.PI * 2) / numAxes;

    const svg = chartArea
      .append("svg")
      .attr(
        "viewBox",
        `0 0 ${width + margin.left + margin.right} ${
          height + margin.top + margin.bottom
        }`
      )
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr(
        "transform",
        `translate(${width / 2 + margin.left},${height / 2 + margin.top})`
      );

    // Draw circular grid lines.
    const levels = 5;
    for (let level = 1; level <= levels; level++) {
      const rLevel = radius * (level / levels);
      svg
        .append("circle")
        .attr("r", rLevel)
        .attr("fill", "none")
        .attr("stroke", "#CDCDCD")
        .attr("stroke-dasharray", "2,2");
    }

    // Add radial lines and labels.
    songData.forEach((d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const xLine = radius * Math.cos(angle);
      const yLine = radius * Math.sin(angle);
      svg
        .append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", xLine)
        .attr("y2", yLine)
        .attr("stroke", "#CDCDCD")
        .attr("stroke-width", 1);

      const textEl = svg
        .append("text")
        .attr("x", (radius + 10) * Math.cos(angle))
        .attr("y", (radius + 10) * Math.sin(angle))
        .attr("dy", "0.35em")
        .attr("text-anchor", Math.cos(angle) > 0 ? "start" : "end")
        .style("font-size", "8px")
        .text(d.track);
      wrapText(textEl, 50, 3);
    });

    const rScale = d3.scaleLinear().range([0, radius]).domain([0, maxValue]);

    const radarLine = d3
      .lineRadial()
      .radius((d) => rScale(d.minutes))
      .angle((d, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);

    svg
      .append("path")
      .datum(songData)
      .attr("d", radarLine)
      .attr("fill", "#4caf4f")
      .attr("fill-opacity", 0.3)
      .attr("stroke", "#4caf4f")
      .attr("stroke-width", 2);

    svg
      .selectAll(".radarCircle")
      .data(songData)
      .enter()
      .append("circle")
      .attr("class", "radarCircle")
      .attr("r", 4)
      .attr(
        "cx",
        (d, i) => rScale(d.minutes) * Math.cos(i * angleSlice - Math.PI / 2)
      )
      .attr(
        "cy",
        (d, i) => rScale(d.minutes) * Math.sin(i * angleSlice - Math.PI / 2)
      )
      .attr("fill", "#4caf4f")
      .attr("fill-opacity", 0.8)
      .append("title")
      .text((d) => `${d.track}: ${d.minutes.toFixed(1)} minutes`);
  }
}

/***********************
 * Artist Info with Animated Transitions
 ***********************/
function updateArtistInfo(data, artistName) {
  const placeholderImg = "https://via.placeholder.com/150";
  const artistData = data.filter(
    (d) =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() ===
        artistName.toLowerCase()
  );
  if (!artistData.length) return;

  currentArtistName = artistName;
  updateTimeControls(artistData, artistName);

  const totalPlays = artistData.length;
  const totalMinutes = d3.sum(artistData, (d) => +d.ms_played) / 60000;
  const firstListenDate = new Date(d3.min(artistData, (d) => new Date(d.ts)));
  const listensByYear = d3.rollups(
    artistData,
    (v) => d3.sum(v, (d) => +d.ms_played / 60000),
    (d) => new Date(d.ts).getFullYear()
  );
  const [peakYear, peakMinutes] = listensByYear.reduce(
    (a, b) => (a[1] > b[1] ? a : b),
    [null, 0]
  );
  const topSongEntry = d3
    .rollups(
      artistData,
      (v) => d3.sum(v, (d) => +d.ms_played / 60000),
      (d) => d.master_metadata_track_name
    )
    .reduce((a, b) => (a[1] > b[1] ? a : b), [null, 0]);
  const topSong = topSongEntry[0];
  const topSongMinutes = topSongEntry[1];

  const overallRankings = d3
    .rollups(
      data,
      (v) => d3.sum(v, (d) => +d.ms_played),
      (d) => d.master_metadata_album_artist_name
    )
    .sort((a, b) => b[1] - a[1]);
  const overallRank =
    overallRankings.findIndex(
      ([artist]) => artist.toLowerCase() === artistName.toLowerCase()
    ) + 1;

  const yearRankings = d3.rollups(
    data,
    (v) =>
      d3.rollups(
        v,
        (vv) => d3.sum(vv, (d) => +d.ms_played),
        (d) => d.master_metadata_album_artist_name
      ),
    (d) => new Date(d.ts).getFullYear()
  );
  const topYears = [];
  yearRankings.forEach(([year, artistArr]) => {
    artistArr.sort((a, b) => b[1] - a[1]);
    const rank =
      artistArr.findIndex(
        ([artist]) => artist.toLowerCase() === artistName.toLowerCase()
      ) + 1;
    if (rank > 0 && rank <= 5) {
      topYears.push({
        year,
        rank,
        totalMinutes:
          artistArr.find(
            ([artist]) => artist.toLowerCase() === artistName.toLowerCase()
          )[1] / 60000,
      });
    }
  });

  const trackForImg = artistData.find(
    (d) =>
      d.master_metadata_track_name === topSong &&
      d.spotify_track_uri &&
      d.spotify_track_uri.includes("spotify:track:")
  );
  let artistImageUrl = placeholderImg;
  if (trackForImg) {
    const trackId = trackForImg.spotify_track_uri.split(":")[2];
    const oEmbedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
    fetch(oEmbedUrl)
      .then((res) => res.json())
      .then((embedData) => {
        artistImageUrl = embedData.thumbnail_url || artistImageUrl;
        renderArtistInfo();
      })
      .catch(() => renderArtistInfo());
  } else {
    renderArtistInfo();
  }

  function renderArtistInfo() {
    const html = `
            <div class="artist-info-box transition">
              <img src="${artistImageUrl}" alt="${artistName}" class="artist-img" />
              <div class="artist_info_container">
                <h2>${artistName}</h2>
                <div class="artists_info_text">
                  <div class="info-left">
                    ${
                      totalPlays
                        ? `<p><strong>Total Plays:</strong> ${totalPlays}</p>`
                        : ""
                    }
                    ${
                      totalMinutes
                        ? `<p><strong>Total Minutes:</strong> ${totalMinutes.toFixed(
                            1
                          )}</p>`
                        : ""
                    }
                    ${
                      firstListenDate
                        ? `<p><strong>First Listened:</strong> ${firstListenDate.toLocaleDateString()}</p>`
                        : ""
                    }
                    ${
                      peakYear
                        ? `<p><strong>Peak Listening Year:</strong> ${peakYear} (${peakMinutes.toFixed(
                            1
                          )} minutes)</p>`
                        : ""
                    }
                    ${
                      topSong
                        ? `<p><strong>Top Song:</strong> ${topSong} (${topSongMinutes.toFixed(
                            1
                          )} minutes)</p>`
                        : ""
                    }
                  </div>
                  <div class="info-right">
                    ${
                      overallRank
                        ? `<p><strong>Overall Rank:</strong> #${overallRank} among all artists</p>`
                        : ""
                    }
                    ${
                      topYears.length
                        ? `<p><strong>Top 5 Years:</strong></p>
                           <ul class="top-years-list">
                            ${topYears
                              .map(
                                (d) =>
                                  `<li>${d.year}: Ranked #${
                                    d.rank
                                  } (${d.totalMinutes.toFixed(1)} minutes)</li>`
                              )
                              .join("")}
                          </ul>`
                        : ""
                    }
                  </div>
                </div>
              </div>
            </div>
          `;
    d3.select("#artistInfo")
      .html("")
      .style("opacity", 0)
      .html(html)
      .transition()
      .duration(500)
      .style("opacity", 1);
  }
}

/***********************
 * Total Bar Plot with Year Drill-Down
 ***********************/
function updateBarChart(data, artistName) {
  const artistData = data.filter(
    (d) =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() ===
        artistName.toLowerCase()
  );
  if (!artistData.length) {
    d3.select("#barChart").html(
      "<p class='empty-message'>No listening data found for this artist.</p>"
    );
    return;
  }

  const yearData = d3
    .rollups(
      artistData,
      (v) => d3.sum(v, (d) => +d.ms_played / 60000),
      (d) => new Date(d.ts).getFullYear()
    )
    .map(([year, totalMinutes]) => ({ year: +year, totalMinutes }));
  yearData.sort((a, b) => a.year - b.year);

  d3.select("#barChart").select("svg").remove();
  const margin = { top: 30, right: 30, bottom: 50, left: 80 },
    width = 400 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;
  const svg = d3
    .select("#barChart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(yearData.map((d) => d.year))
    .range([0, width])
    .padding(0.2);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(yearData, (d) => d.totalMinutes)])
    .nice()
    .range([height, 0]);
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  svg.append("g").call(d3.axisLeft(y));
  svg
    .append("text")
    .attr("x", width)
    .attr("y", height + 40)
    .attr("text-anchor", "end")
    .text("Year");
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -60)
    .attr("x", -height / 2)
    .attr("dy", "1em")
    .attr("text-anchor", "middle")
    .text("Total Minutes Played");

  const bars = svg
    .selectAll("rect")
    .data(yearData)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.year))
    .attr("y", height)
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("fill", "#ff7f0e")
    .on("click", (event, d) => {
      drillDownState.selectedYear = d.year;
      updateAlbumDistribution(artistData);
    });
  bars
    .append("title")
    .text((d) => `${d.year}: ${d.totalMinutes.toFixed(1)} minutes`);
  bars
    .transition()
    .duration(800)
    .attr("y", (d) => y(d.totalMinutes))
    .attr("height", (d) => height - y(d.totalMinutes));
}

/***********************
 * Scatter Plot with Enhanced Interactions
 ***********************/
// updateScatterPlot updates the scatter plot and sets up the dot click handler.
// updateScatterPlot updates the scatter plot and sets up the dot click handler.
// Global variable to store the currently selected track name.
let selectedTrackName = null;

/**
 * updateScatterPlot creates/updates the scatter plot.
 * It also re-applies (or updates) the info box if one is already open,
 * so that when you change the time frame the stats for the selected track update.
 */
function updateScatterPlot(data, artistName) {
  const scatterContainer = d3.select("#scatterChart");

  let flexContainer = scatterContainer.select("div.chartAndInfo");
  if (flexContainer.empty()) {
    flexContainer = scatterContainer
      .append("div")
      .attr("class", "chartAndInfo")
      .style("display", "flex")
      .style("flex-direction", "row");
  }

  flexContainer.select("div.chart_svg").remove();

  let textDiv = flexContainer.select("div.textInfoBox");
  if (textDiv.empty()) {
    textDiv = flexContainer
      .append("div")
      .attr("class", "textInfoBox")
      .style("width", "500px")
      .style("padding", "1em")
      .style("overflow-y", "auto")
      .style("max-height", "400px")
      .style("border", "1px solid var(--dark-green-color)")
      .style("border-radius", "8px")
      .style("box-shadow", "0 0 6px rgba(0,0,0,0.1)")
      .style("background", "var(--white-color)");
  } else {
    textDiv.html("");
  }

  const artistData = data.filter(
    (d) =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() ===
        artistName.toLowerCase()
  );

  const trackStats = d3
    .rollups(
      artistData,
      (v) => {
        const totalMinutes = d3.sum(v, (d) => +d.ms_played / 60000);

        const yearMap = d3.rollup(
          v,
          (vv) => d3.sum(vv, (d) => +d.ms_played / 60000),
          (d) => new Date(d.ts).getFullYear()
        );
        let mostPlayedYear = "",
          mostMinutesInYear = 0;
        yearMap.forEach((minutes, year) => {
          if (minutes > mostMinutesInYear) {
            mostMinutesInYear = minutes;
            mostPlayedYear = year;
          }
        });

        const periodCount = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
        v.forEach((d) => {
          const hour = new Date(d.ts).getHours();
          let period = "";
          if (hour >= 5 && hour < 12) period = "Morning";
          else if (hour >= 12 && hour < 17) period = "Afternoon";
          else if (hour >= 17 && hour < 21) period = "Evening";
          else period = "Night";
          periodCount[period]++;
        });
        let mostFrequentPeriod = Object.entries(periodCount).reduce((a, b) =>
          a[1] > b[1] ? a : b
        )[0];

        const dayMap = d3.rollup(
          v,
          (vv) => d3.sum(vv, (d) => +d.ms_played / 60000),
          (d) => new Date(d.ts).toDateString()
        );
        let maxDay = "",
          maxMinutes = 0;
        dayMap.forEach((minutes, day) => {
          if (minutes > maxMinutes) {
            maxMinutes = minutes;
            maxDay = day;
          }
        });

        return {
          totalMinutes,
          maxMinutesYear: mostMinutesInYear,
          mostFrequentPeriod,
          mostPlayedYear,
          mostPlayedDay: maxDay,
          maxMinutes,
        };
      },
      (d) => d.master_metadata_track_name
    )
    .map(([track, stats]) => {
      const trackForImg = artistData.find(
        (d) => d.master_metadata_track_name === track
      );
      return {
        track,
        spotify_track_uri: trackForImg?.spotify_track_uri,
        ...stats,
      };
    });

  const mostLoyal = d3.max(trackStats, (d) => d.totalMinutes);
  const mostBinge = d3.max(trackStats, (d) => d.maxMinutesYear);
  const loyalTrack = trackStats.find((d) => d.totalMinutes === mostLoyal);
  const bingeTrack = trackStats.find((d) => d.maxMinutesYear === mostBinge);

  textDiv
    .append("div")
    .style("margin-bottom", "1em")
    .html(
      `<p style="margin:0">Your most <strong>loyal song</strong> was <span class="clickable" style="color:var(--dark-green-color); cursor:pointer; font-weight:bold;">${loyalTrack.track}</span>,</p>
       <p style="margin:0">played for a total of ${loyalTrack.totalMinutes.toFixed(1)} minutes.</p>
       <p style="margin:0; margin-top:0.5em">Your most <strong>binge-listened</strong> song was <span class="clickable" style="font-weight:bold; color:var(--dark-green-color); cursor:pointer">${bingeTrack.track}</span>,</p>
       <p style="margin:0">played for ${bingeTrack.maxMinutesYear.toFixed(1)} minutes in a single year.</p>`
    )
    .on("click", (event) => {
      const clicked = event.target.innerText;
      const found = trackStats.find((t) => t.track === clicked);
      if (found) {
        selectedTrackName = found.track;
        updateSongDistText(found);
      }
    });

    
  textDiv.append("h4").text("Top Played Songs:");

  const dropdownContainer = textDiv.append("div").style("margin-bottom", "1em");
  dropdownContainer.append("label").text("Sort by: ").style("margin-right", "0.5em");
  const sortSelect = dropdownContainer
    .append("select")
    .style("padding", "0.25em");

  sortSelect
    .selectAll("option")
    .data([
      { key: "totalMinutes", label: "Most Loyal" },
      { key: "maxMinutesYear", label: "Most Binged" },
    ])
    .enter()
    .append("option")
    .attr("value", (d) => d.key)
    .text((d) => d.label);

  const gridContainer = textDiv
    .append("div")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1fr")
    .style("gap", "1em");

  function renderTopSongs(sortKey = "totalMinutes") {
    gridContainer.html("");
    trackStats
      .sort((a, b) => d3.descending(a[sortKey], b[sortKey]))
      .slice(0, 4)
      .forEach((d, i) => {
        const entry = gridContainer
          .append("div")
          .style("margin-bottom", "0.75em")
          .style("cursor", "pointer")
          .style("border", "1px solid #ccc")
          .style("padding", "0.5em")
          .style("border-radius", "5px")
          .on("click", () => {
            selectedTrackName = d.track;
            updateSongDistText(d);
          });

        entry
          .append("div")
          .style("font-weight", "bold")
          .style("font-size", "12px")
          .style("color", "var(--dark-green-color)")
          .text(`${i + 1}. ${d.track}`);

        entry
          .append("div")
          .style("font-size", "10px")
          .html(
            `<p style="margin:0">Total Played: ${d.totalMinutes.toFixed(1)} mins</p>
             <p style="margin:0">Max in a Year: ${d.maxMinutesYear.toFixed(1)} mins</p>`
          );
      });
  }

  sortSelect.on("change", function () {
    renderTopSongs(this.value);
  });

  renderTopSongs();

  if (selectedTrackName) {
    const selected = trackStats.find((t) => t.track === selectedTrackName);
    if (selected) updateSongDistText(selected);
  }
}


/**
 * updateSongDist displays (or updates) an info box for the selected track.
 * It shows a loading state before the details are loaded.
 */
function updateSongDistText(trackData) {
  // Select the flex container that holds both the chart and the info box.
  const flexContainer = d3.select("#scatterChart").select("div.chartAndInfo");
  const svgEl = d3.select("#scatterChart").select("svg").select("g");
  // Remove any existing info box.
  flexContainer.selectAll("div.infoDiv").remove();

  // Append a new info box.
  const infoDiv = flexContainer
    .append("div")
    .attr("class", "infoDiv")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("margin-top", "10px")
    .style("margin-left", "var(--spacing)")
    .style("flex", "1");

  // Immediately show a loading state.
  infoDiv
    .html("<p>Loading details…</p>")
    .style("text-align", "center")
    .style("color", "#555")
    .style("font-style", "italic");

  let artistImageUrl = "";

  // Helper function to render the song details.
  function renderDetails() {
    // Clear the loading state.
    infoDiv.html("");
    const infoContent = infoDiv
      .append("div")
      .attr("class", "infoContent")
      .style("display", "flex")
      .style("flex-direction", "row")
      .style("align-items", "start")
      .style("justify-content", "space-between")
      .style("width", "100%");

    const headerContent = infoContent
      .append("div")
      .attr("class", "headerContent")
      .style("flex", "1")
      .style("display", "flex")
      .style("flex-direction", "row");
    if (artistImageUrl) {
      // Insert the track image at the top.
      headerContent
        .insert("img", ":first-child")
        .attr("src", artistImageUrl)
        .attr("alt", "Spotify Track Image")
        .style("width", "20%")
        .style("display", "block")
        .style("border-radius", "var(--border-radius)")
        .style("height", "auto");
    }
    headerContent
      .append("h3")
      .style("margin-left", "var(--spacing)")
      .text(trackData.track);
    infoContent
      .append("button")
      .attr("class", "button")
      .text("X")
      .style("cursor", "pointer")
      .on("click", () => {
        // Clear selected track
        selectedTrackName = null;

        // Reset all dots to default color
        svgEl.selectAll("circle").attr("fill", "#69b3a2");

        // Optionally also hide the selection ring
        svgEl.selectAll(".selected-circle").style("opacity", 0);

        // Remove song details panel
        flexContainer.selectAll("div.infoDiv").remove();
      });
    const songInfoDiv = infoDiv
      .append("div")
      .attr("class", "songInfoDiv")
      .style("display", "flex")
      .style("margin", "auto");
    songInfoDiv
      .append("div")
      .style("padding", "var(--spacing)")
      .style("background", "rgba(76, 175, 79, 0.1)")
      .style("border-radius", "var(--border-radius-small)")
      .style("border", "1px solid rgb(221, 221, 221)")
      .style("font-size", "var(--font-small-size)")
      .html(
        `<p>You have listened to this track for a total of <strong>${trackData.totalMinutes.toFixed(
          1
        )} minutes</strong>.</p>` +
          `<p>On <strong>${
            trackData.mostPlayedDay
          }</strong> you played the song at its peak, reaching <strong>${trackData.maxMinutes.toFixed(
            1
          )} minutes</strong> in a single day.</p>` +
          `<p>The year in which you enjoyed it most was <strong>${trackData.mostPlayedYear}</strong>, and you tend to listen most often during the <strong>${trackData.mostFrequentPeriod}</strong>.</p>`
      );
  }

  // If a Spotify track URI exists, fetch the image via the oEmbed API.
  if (trackData.spotify_track_uri) {
    const trackId = trackData.spotify_track_uri.split(":")[2];
    const oEmbedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
    fetch(oEmbedUrl)
      .then((res) => res.json())
      .then((embedData) => {
        artistImageUrl = embedData.thumbnail_url || "";
        renderDetails();
      })
      .catch(() => renderDetails());
  } else {
    renderDetails();
  }
}

/***********************
 * Sunburst Chart with Drill-Down for Song Distribution
 ***********************/
// Optional: Call this function if you want a header above your sunburst chart.
function renderSunburstHeader() {
  // This header is separate from the chart and info box.
  const chartContainer = d3.select("#sunburstChart");
  // Remove previous header if it exists.
  chartContainer.select("h2.sunburstHeader").remove();
  chartContainer
    .insert("h2", ":first-child")
    .attr("class", "sunburstHeader")
    .text("Album Distribution (Sunburst Chart)");
}

// updateSunburstChart creates the sunburst and sets up click events.
// Global state object

// Global state object
const drillDownState = { selectedAlbum: null };
const albumColorMap = new Map();
const colorScale = d3.scaleOrdinal(d3.schemeSet2);

function hashStringToIndex(str, range) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit int
  }
  return Math.abs(hash) % range;
}

function updateSunburstChart(data, artistName) {
  const artistData = data.filter(
    (d) =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() === artistName.toLowerCase() &&
      d.master_metadata_album_album_name
  );

  const chartContainer = d3.select("#sunburstChart");

  let flexContainer = chartContainer.select("div.sunburstFlex");
  if (flexContainer.empty()) {
    flexContainer = chartContainer
      .append("div")
      .attr("class", "sunburstFlex")
      .style("display", "flex")
      .style("flex-direction", "row")
      .style("gap", "20px");
  } else {
    flexContainer.html("");
  }

  const infoBox = flexContainer
    .append("div")
    .attr("class", "albumInfo")
    .style("width", "500px")
    .style("padding", "1em")
    .style("overflow-y", "auto")
    .style("max-height", "400px")
    .style("border", "1px solid var(--dark-green-color)")
    .style("border-radius", "8px")
    .style("box-shadow", "0 0 6px rgba(0,0,0,0.1)")
    .style("background", "var(--white-color)");

  const detailBox = flexContainer
    .append("div")
    .attr("class", "albumDetailInfo")
    .style("width", "500px")
    .style("padding", "1em")
    .style("overflow-y", "auto")
    .style("max-height", "400px")
    .style("text-align", "center")
    .style("font-style", "italic")
    .style("color", "#555")
    .style("border-radius", "8px")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "center")

  const albums = d3.groups(
    artistData,
    (d) => d.master_metadata_album_album_name
  );

  const albumStats = albums.map(([album, records]) => {
    const tracks = d3.groups(records, (d) => d.master_metadata_track_name);
    const totalMinutes = d3.sum(records, (d) => +d.ms_played / 60000);
    const songCounts = tracks.map(([_, tr]) => d3.sum(tr, (d) => +d.ms_played / 60000));
    const oneSongDominance = Math.max(...songCounts) / totalMinutes;
    return {
      name: album,
      totalMinutes,
      songCount: tracks.length,
      oneSongDominance,
    };
  });

  const multiTrackAlbums = albumStats.filter(d => d.songCount > 1);
  const topPlayedAlbum = d3.max(albumStats, d => d.totalMinutes);
  const topPlayed = albumStats.find(d => d.totalMinutes === topPlayedAlbum);

  const topTracksAlbum = d3.max(albumStats, d => d.songCount);
  const mostTracks = albumStats.find(d => d.songCount === topTracksAlbum);

  const topDominanceAlbum = d3.max(multiTrackAlbums, d => d.oneSongDominance);
  const dominant = multiTrackAlbums.find(d => d.oneSongDominance === topDominanceAlbum);

  const topAlbums = albumStats
    .slice()
    .sort((a, b) => d3.descending(a.totalMinutes, b.totalMinutes))
    .slice(0, 5);

  const topAlbumsHTML = topAlbums.map(
    (a, i) => `<p style="margin:0">${i + 1}. <span class="clickable" style="font-weight:bold; color:var(--black-color); cursor:pointer;">${a.name}</span> (${a.totalMinutes.toFixed(1)} min, ${a.songCount} song${a.songCount > 1 ? 's' : ''})</p>`
  ).join("");

  infoBox
    .append("div")
    .html(`
      <p > Most <strong>played album</strong>: <span class="clickable" style="color:var(--dark-green-color); font-weight:bold; cursor:pointer;">${topPlayed.name}</span> (${topPlayed.totalMinutes.toFixed(1)} minutes)</p>
      <p > Album with <strong>most songs played</strong>: <span class="clickable" style="color:var(--dark-green-color); font-weight:bold; cursor:pointer;">${mostTracks.name}</span> (${mostTracks.songCount} songs)</p>
      <p> <strong>Most focused listening</strong>: <span class="clickable" style="color:var(--dark-green-color); font-weight:bold; cursor:pointer;">${dominant.name}</span> (${(dominant.oneSongDominance * 100).toFixed(1)}%)</p>
      <br>
      <p style="font-weight:bold"> Top Albums</p>
      ${topAlbumsHTML}
    `)
    .on("click", (event) => {
      const clicked = event.target.innerText;
      const names = albumStats.map(d => d.name);
      if (names.includes(clicked)) {
        drillDownState.selectedAlbum = clicked;
        updateAlbumInfo(clicked, artistData, detailBox);
      }
    });

  if (drillDownState.selectedAlbum) {
    updateAlbumInfo(drillDownState.selectedAlbum, artistData, detailBox);
  }
}



function updateAlbumInfo(selectedAlbum, artistData, detailBox) {
  const infoContainer = detailBox;
  infoContainer.html("<p style='text-align:center; color:#555; font-style:italic;'>Loading album details…</p>");

  const filtered = artistData.filter(
    (d) => d.master_metadata_album_album_name.toLowerCase() === selectedAlbum.toLowerCase()
  );

  if (filtered.length === 0) {
    infoContainer.html("<p class='empty-message'>No details available for the selected album.</p>");
    return;
  }

  const totalAlbumPlays = filtered.length;
  const totalAlbumMinutes = d3.sum(filtered, (d) => +d.ms_played / 60000);
  const dates = filtered.map((d) => new Date(d.ts));
  const minDate = new Date(Math.min(...dates));

  const listensByYear = d3.rollups(
    filtered,
    (v) => d3.sum(v, (d) => +d.ms_played / 60000),
    (d) => new Date(d.ts).getFullYear()
  );
  listensByYear.sort((a, b) => b[1] - a[1]);
  const peakYear = listensByYear.length ? listensByYear[0][0] : "N/A";
  const peakYearMinutes = listensByYear.length ? listensByYear[0][1] : 0;

  // 🆕 Top Tracks calculation
  const trackMinutes = d3.rollups(
    filtered,
    (v) => d3.sum(v, (d) => +d.ms_played / 60000),
    (d) => d.master_metadata_track_name
  );
  trackMinutes.sort((a, b) => d3.descending(a[1], b[1]));
  const topTracks = trackMinutes.slice(0, 3); // Top 5 tracks

  const firstTrackWithUri = filtered.find((d) => d.spotify_track_uri);
  let albumImageUrl = "";

  function renderAlbumDetails() {
    infoContainer.html("");

    const infoContent = infoContainer
      .append("div")
      .attr("class", "infoContent")
      .style("display", "flex")
      .style("flex-direction", "row")
      .style("align-items", "start")
      .style("justify-content", "space-between")
      .style("width", "100%");

    const headerContent = infoContent
      .append("div")
      .attr("class", "headerContent")
      .style("flex", "1")
      .style("display", "flex")
      .style("flex-direction", "row");

    if (albumImageUrl) {
      headerContent
        .insert("img", ":first-child")
        .attr("src", albumImageUrl)
        .attr("alt", "Spotify Album Image")
        .style("width", "20%")
        .style("display", "block")
        .style("border-radius", "var(--border-radius)")
        .style("height", "auto");
    }

    headerContent
      .append("h3")
      .style("margin-left", "var(--spacing)")
      .text(selectedAlbum);

    infoContent
      .append("button")
      .attr("class", "button")
      .text("X")
      .style("cursor", "pointer")
      .on("click", () => {
        drillDownState.selectedAlbum = null;
        infoContainer.html("");
        infoContainer.style("display", "none");

        d3.select("#sunburstChart")
          .select("div.sunburstSVG")
          .select("svg")
          .selectAll("path")
          .transition()
          .duration(200)
          .attr("fill", (d) => {
            let current = d;
            while (current.depth > 1) current = current.parent;
            const albumName = current.data.name;
            if (!albumColorMap.has(albumName)) {
              const index = hashStringToIndex(albumName, colorScale.range().length);
              albumColorMap.set(albumName, colorScale(index));
            }
            return albumColorMap.get(albumName);
          })
          .attr("stroke", "#fff")
          .attr("stroke-width", 1);
      });

    const albumInfoDiv = infoContainer
      .append("div")
      .attr("class", "albumInfoDiv")
      .style("display", "flex")
      .style("margin", "auto");

    albumInfoDiv
      .append("div")
      .style("padding", "var(--spacing)")
      .style("background", "rgba(76, 175, 79, 0.1)")
      .style("border-radius", "var(--border-radius-small)")
      .style("border", "1px solid rgb(221, 221, 221)")
      .style("width", "100%")
      .style("font-size", "var(--font-small-size)")
      .html(
        `<p>You first listened to this album on <strong>${minDate.toLocaleDateString()}</strong>.</p>` +
        `<p>Total listening time: <strong>${totalAlbumMinutes.toFixed(1)} minutes</strong> across <strong>${totalAlbumPlays}</strong> plays.</p>` +
        `<p>Your peak year was <strong>${peakYear}</strong> with <strong>${peakYearMinutes.toFixed(1)} minutes</strong>.</p>` +
        `<br><p style="font-weight:bold;">Top Songs from this Album:</p>` +
        topTracks.map(([track, minutes], i) =>
          `<p style="margin:0;">${i + 1}. ${track} (${minutes.toFixed(1)} min)</p>`
        ).join("")
      );
  }

  if (firstTrackWithUri) {
    const trackId = firstTrackWithUri.spotify_track_uri.split(":")[2];
    const oEmbedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
    fetch(oEmbedUrl)
      .then((res) => res.json())
      .then((embedData) => {
        albumImageUrl = embedData.thumbnail_url || "";
        renderAlbumDetails();
      })
      .catch(() => renderAlbumDetails());
  } else {
    renderAlbumDetails();
  }
}




/***********************
 * Mood & Behavior Sankey with Hover Highlighting
 ***********************/
function updateMoodSankey(data, artistName) {
  const artistData = data.filter(
    (d) =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() ===
        artistName.toLowerCase() &&
      d.reason_start &&
      d.reason_end
  );
  if (!artistData.length) {
    d3.select("#moodSankey").html(
      "<p class='empty-message'>No mood or behavior data found for this artist.</p>"
    );
    return;
  }
  const reasonExplanations = {
    clickrow: "User clicked a track row in the UI",
    backbtn: "User pressed the back button",
    playbtn: "User pressed the play button",
    appload: "App loaded or started playing automatically",
    fwdbtn: "User pressed the forward button",
    remote: "Track changed via a remote or external device",
    trackdone: "Track finished playing automatically",
    trackerror: "An error occurred while playing the track",
    endplay: "User ended the play session",
    logout: "User logged out",
    unknown: "Unknown or unclassified reason",
  };
  const reasons = new Set();
  artistData.forEach((d) => {
    reasons.add(d.reason_start);
    reasons.add(d.reason_end);
  });
  const reasonsArray = Array.from(reasons).sort();
  const nodes = reasonsArray.map((r) => ({ name: r }));
  const nodeIndex = {};
  nodes.forEach((n, i) => {
    nodeIndex[n.name] = i;
  });
  const links = d3
    .rollups(
      artistData,
      (v) => v.length,
      (d) => d.reason_start + "||" + d.reason_end
    )
    .map(([key, value]) => {
      const parts = key.split("||");
      return {
        source: nodeIndex[parts[0]],
        target: nodeIndex[parts[1]],
        value,
      };
    })
    .filter((link) => link.source !== link.target && link.source < link.target);
  const maxCombo = links.reduce((max, d) => (d.value > max.value ? d : max), {
    value: 0,
  });

  const container = d3.select("#moodSankey");
  // Ensure container has relative positioning
  container.style("position", "relative");
  container.selectAll(".sankey-wrapper").remove();

  const layout = container
    .append("div")
    .attr("class", "sankey-wrapper")
    .style("display", "flex")
    .style("gap", "20px")
    .style("justify-content", "space-around")
    .style("margin-top", "var(--spacing)")
    .style("margin-bottom", "var(--spacing)");

  const width = 400,
    height = 400;
  const svg = layout.append("svg").attr("width", width).attr("height", height);

  // Create tooltip once
  const tooltip = container
    .append("div")
    .attr("class", "sankey-tooltip")
    .style("position", "absolute")
    .style("z-index", 10)
    .style("pointer-events", "none")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "8px")
    .style("font-size", "var(--font-small-size)")
    .style("border-radius", "4px")
    .style("box-shadow", "0 0 6px rgba(0,0,0,0.1)")
    .style("opacity", 0);

  const sankey = d3
    .sankey()
    .nodeWidth(15)
    .nodePadding(10)
    .extent([
      [1, 1],
      [width - 1, height - 6],
    ]);

  const { nodes: sankeyNodes, links: sankeyLinks } = sankey({
    nodes: nodes.map((d) => Object.assign({}, d)),
    links: links.map((d) => Object.assign({}, d)),
  });

  const color = d3.scaleOrdinal(d3.schemeCategory10);

  const linkSelection = svg
    .append("g")
    .selectAll("path")
    .data(sankeyLinks)
    .enter()
    .append("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", (d) => color(d.source.name))
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .attr("fill", "none")
    .attr("opacity", 0.5);

  const node = svg
    .append("g")
    .selectAll("g")
    .data(sankeyNodes)
    .enter()
    .append("g")
    .on("mouseover", function (event, d) {
      // Show linked nodes
      linkSelection.attr("opacity", (link) =>
        link.source.name === d.name || link.target.name === d.name ? 1 : 0.1
      );

      // Use d3.pointer to compute positions relative to the container
      const [x, y] = d3.pointer(event, container.node());
      tooltip
        .style("display", "block") // Ensure tooltip is displayed
        .html(
          `<strong>${d.name}</strong><br/>${reasonExplanations[d.name] || ""}`
        )
        .style("left", x + 10 + "px")
        .style("top", y + 10 + "px")
        .transition()
        .duration(200)
        .style("opacity", 1);
    })
    .on("mousemove", function (event) {
      const [x, y] = d3.pointer(event, container.node());
      tooltip.style("left", x + 10 + "px").style("top", y + 10 + "px");
    })
    .on("mouseout", function () {
      linkSelection.attr("opacity", 0.5);
      tooltip
        .transition()
        .duration(200)
        .style("opacity", 0)
        .on("end", function () {
          d3.select(this).style("display", "none");
        });
    });

  node
    .append("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", (d) => color(d.name))
    .attr("stroke", "#000");

  node
    .append("text")
    .attr("x", (d) => d.x0 - 6)
    .attr("y", (d) => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .text((d) => d.name)
    .filter((d) => d.x0 < width / 2)
    .attr("x", (d) => d.x1 + 6)
    .attr("text-anchor", "start");

  // Calculate insights
  const startCounts = d3.rollup(
    artistData,
    (v) => v.length,
    (d) => d.reason_start
  );
  const endCounts = d3.rollup(
    artistData,
    (v) => v.length,
    (d) => d.reason_end
  );
  const mostCommonStart = Array.from(startCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const mostCommonEnd = Array.from(endCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const totalTransitions = d3.sum(links, (d) => d.value);
  const getReasonName = (r) => reasonExplanations[r] || r;

  const rightPanel = layout
    .append("div")
    .attr("class", "info-panel")
    .style("width", "50%")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "var(--spacing)");

  const infoBox = rightPanel
    .append("div")
    .attr("class", "info-box")
    .style("font-size", "var(--font-small-size)")
    .style("background", "rgba(76, 175, 79, 0.1)")
    .style("padding", "var(--spacing)")
    .style("border", "1px solid #ddd")
    .style("border-radius", "var(--border-radius-small)");

  console.log("All transitions:", artistData.length);
  console.log("Filtered Sankey transitions:", links.length);
  infoBox.html(`
    <p>This Sankey diagram visualizes how songs begin and end during your sessions with <strong>${artistName}</strong>.</p>
    <p>Each <strong>node</strong> represents a reason a track was started or stopped, and each <strong>link</strong> shows how frequently transitions occurred between those reasons.</p>
    <ul>
      <li><strong>Total transitions recorded:</strong> ${totalTransitions} — this counts how many times songs moved from one reason to another (e.g., play button → track finished)</li>
      <li><strong>Most common starting reason:</strong> <em>${getReasonName(
        mostCommonStart[0]
      )}</em> (${mostCommonStart[1]} times)</li>
      <li><strong>Most common ending reason:</strong> <em>${getReasonName(
        mostCommonEnd[0]
      )}</em> (${mostCommonEnd[1]} times)</li>
      <li><strong>Most frequent transition:</strong> <em>${getReasonName(
        sankeyNodes[maxCombo.source]?.name
      )}</em> → <em>${getReasonName(
    sankeyNodes[maxCombo.target]?.name
  )}</em> (${maxCombo.value} plays)</li>
    </ul>
    <p>This may reveal listening habits — for example, frequent use of the forward button might indicate skipping, while “trackdone” suggests more passive listening.</p>
  `);
}

/***********************
 * Update All Charts for Selected Artist
 ***********************/
function updateAllCharts(data, artistName) {
  // Reset drill down state
  drillDownState.selectedYear = null;
  const chartContainer = d3.select("#albumDist");
  chartContainer.html("");
  chartContainer.append("h2").text("Album Details");

  if (chartContainer.select("#albumPlaceholder").empty()) {
    chartContainer
      .append("p")
      .attr("id", "albumPlaceholder")
      .style("text-align", "center")
      .style("font-style", "italic")
      .style("color", "#555")
      .style("margin-bottom", "10px")
      .text("Select an album to see more details");
  }
  // Do not update the artist info here to prevent refreshing the info box
  //updatePeakListening(data, artistName);
  updateScatterPlot(data, artistName);
  updateBarChart(data, artistName);
  updateSunburstChart(data, artistName);
  updateMoodSankey(data, artistName);
}

/***********************
 * Initialize Search and Load Data
 ***********************/
function initArtistSearch(data) {
  const artistSet = new Set();
  data.forEach((d) => {
    if (d.master_metadata_album_artist_name) {
      artistSet.add(d.master_metadata_album_artist_name);
    }
  });
  const artists = Array.from(artistSet).sort();
  const input = document.getElementById("artistSearchInput");
  const dropdown = document.getElementById("artistDropdown");
  function showDropdown() {
    const query = input.value.toLowerCase();
    dropdown.innerHTML = "";
    if (query === "") {
      dropdown.style.display = "none";
      return;
    }
    const filteredArtists = artists.filter((artist) =>
      artist.toLowerCase().includes(query)
    );
    if (filteredArtists.length > 0) {
      filteredArtists.forEach((artist) => {
        const li = document.createElement("li");
        li.textContent = artist;
        li.addEventListener("click", () => {
          input.value = artist;
          dropdown.innerHTML = "";
          dropdown.style.display = "none";
          // Update artist info only on artist selection
          updateArtistInfo(data, artist);
          updateAllCharts(data, artist);
        });
        dropdown.appendChild(li);
      });
      dropdown.style.display = "block";
    } else {
      dropdown.style.display = "none";
    }
  }
  input.addEventListener("input", showDropdown);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      dropdown.style.display = "none";
      const artist = input.value.trim();
      updateArtistInfo(data, artist);
      updateAllCharts(data, artist);
    }
  });
  document.addEventListener("click", (event) => {
    if (!input.contains(event.target) && !dropdown.contains(event.target)) {
      dropdown.style.display = "none";
    }
  });
  document.getElementById("artistSearchBtn").addEventListener("click", () => {
    const artist = input.value.trim();
    updateArtistInfo(data, artist);
    updateAllCharts(data, artist);
  });
}

/***********************
 * Event Listener for Applying Date Range
 ***********************/
document.getElementById("applyRangeBtn").addEventListener("click", () => {
  const startDate = new Date(document.getElementById("startDate").value);
  const endDate = new Date(document.getElementById("endDate").value);
  if (isNaN(startDate) || isNaN(endDate)) return;
  const filteredData = window.allParsedData.filter((d) => {
    const date = new Date(d.ts);
    return date >= startDate && date <= endDate;
  });
  updateAllCharts(filteredData, currentArtistName);
});

// Toggle the Song Distribution (Scatter Plot) container
document.getElementById("toggleSong").addEventListener("change", function () {
  const scatterChart = document.getElementById("scatterChart");
  if (this.checked) {
    scatterChart.style.display = "block";
  } else {
    scatterChart.style.display = "none";
  }
});

// Toggle the Album Distribution (Sunburst Chart) container
document.getElementById("toggleAlbum").addEventListener("change", function () {
  const sunburstChart = document.getElementById("sunburstChart");
  if (this.checked) {
    sunburstChart.style.display = "block";
  } else {
    sunburstChart.style.display = "none";
  }
});

// Load CSV and initialize
fetch("data/astrid_data.csv")
  .then((response) => response.text())
  .then((csvText) => {
    const parsedData = d3.csvParse(csvText);
    window.allParsedData = parsedData;
    initArtistSearch(parsedData);
    const topArtist = parsedData
      .map((d) => d.master_metadata_album_artist_name)
      .filter(Boolean)
      .reduce((acc, artist) => {
        acc[artist] = (acc[artist] || 0) + 1;
        return acc;
      }, {});
    const mostPlayedArtist = Object.entries(topArtist).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];
    if (mostPlayedArtist) {
      updateArtistInfo(parsedData, mostPlayedArtist);
      updateAllCharts(parsedData, mostPlayedArtist);
      document.getElementById("artistSearchInput").value = mostPlayedArtist;
    }
  })
  .catch((error) => {
    console.error("Error loading CSV data:", error);
    d3.select("#lineChart").html(
      "<p class='empty-message'>Failed to load data.</p>"
    );
  });
