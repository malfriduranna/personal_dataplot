/***********************
 * Global Drill-Down State
 ***********************/
let drillDownState = {
  selectedYear: null,
  selectedAlbum: null,
};

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
  const margin = { top: 20, right: 30, bottom: 70, left: 50 },
    width = 800 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

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

/***********************
 * Drill-Down: Song Distribution as a Radar Chart
 ***********************/
function updateSongDistribution(artistData) {
  function wrapText(textSelection, maxWidth, maxLines = 3) {
    textSelection.each(function () {
      const text = d3.select(this);
      const words = text.text().split(/\s+/);
      text.text(null);
      let line = [];
      let lineNumber = 0;
      const lineHeight = 1.1; // ems
      const x = text.attr("x") || 0;
      const y = text.attr("y") || 0;
      let dy = parseFloat(text.attr("dy")) || 0;
      let tspan = text
        .append("tspan")
        .attr("x", x)
        .attr("y", y)
        .attr("dy", dy + "em")
        .text("");
      for (let i = 0; i < words.length; i++) {
        line.push(words[i]);
        tspan.text(line.join(" "));
        if (
          tspan.node().getComputedTextLength() > maxWidth &&
          line.length > 1
        ) {
          line.pop();
          tspan.text(line.join(" "));
          line = [words[i]];
          lineNumber++;
          if (lineNumber >= maxLines) {
            tspan.text(tspan.text() + " …");
            break;
          }
          tspan = text
            .append("tspan")
            .attr("x", x)
            .attr("dy", lineHeight + "em")
            .text(words[i]);
        }
      }
    });
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
    const chartContainer = d3.select("#songDistChart");
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
  const chartContainer = d3.select("#songDistChart");
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
    .attr("id", "songDistInfo")
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
    const overallSize = 300;
    const margin = { top: 20, right: 0, bottom: 20, left: 0 }; // Reduced margins
    const width = 400;
    const height = overallSize - margin.top - margin.bottom;
    const radius = Math.min(width, height) / 2 - 10;
    const numAxes = songData.length;
    const maxValue = d3.max(songData, (d) => d.minutes);
    const angleSlice = (Math.PI * 2) / numAxes;

    const svg = chartArea
      .append("svg")
      .attr("width", width)
      .attr("height", overallSize)
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
                           <ul>
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
      updateSongDistribution(artistData);
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
function updateScatterPlot(data, artistName) {
  const artistData = data.filter(
    (d) =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() ===
        artistName.toLowerCase()
  );
  if (!artistData.length) {
    d3.select("#scatterChart").html(
      "<p class='empty-message'>No listening data found for this artist.</p>"
    );
    return;
  }
  const trackStats = d3
    .rollups(
      artistData,
      (v) => {
        const totalMinutes = d3.sum(v, (d) => +d.ms_played / 60000);
        const dayMap = d3.rollup(
          v,
          (vv) => d3.sum(vv, (d) => +d.ms_played / 60000),
          (d) => new Date(d.ts).toLocaleDateString()
        );
        const maxMinutes = d3.max(Array.from(dayMap.values()));
        return { totalMinutes, maxMinutes };
      },
      (d) => d.master_metadata_track_name
    )
    .map(([track, stats]) => ({ track, ...stats }));
  d3.select("#scatterChart").select("svg").remove();
  const margin = { top: 30, right: 30, bottom: 50, left: 50 },
    width = 400 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;
  const svg = d3
    .select("#scatterChart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(trackStats, (d) => d.totalMinutes)])
    .nice()
    .range([0, width]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(trackStats, (d) => d.maxMinutes)])
    .nice()
    .range([height, 0]);
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));
  svg.append("g").call(d3.axisLeft(y));
  svg
    .append("text")
    .attr("x", width)
    .attr("y", height + 40)
    .attr("text-anchor", "end")
    .text("Total Minutes Played");
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -40)
    .attr("x", -10)
    .attr("text-anchor", "end")
    .text("Max Minutes in a Day");
  const circles = svg
    .selectAll("circle")
    .data(trackStats)
    .enter()
    .append("circle")
    .attr("cx", (d) => x(d.totalMinutes))
    .attr("cy", (d) => y(d.maxMinutes))
    .attr("r", 0)
    .attr("fill", "#69b3a2")
    .attr("opacity", 0.7);
  circles
    .append("title")
    .text(
      (d) =>
        `${d.track}: ${d.totalMinutes.toFixed(1)} total, ${d.maxMinutes.toFixed(
          1
        )} max`
    );
  circles
    .transition()
    .duration(800)
    .attr("r", 6)
    .delay((d, i) => i * 10);
}

/***********************
 * Sunburst Chart with Drill-Down for Song Distribution
 ***********************/
function updateSunburstChart(data, artistName) {
  const artistData = data.filter(
    (d) =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() ===
        artistName.toLowerCase() &&
      d.master_metadata_album_album_name
  );

  const chartContainer = d3.select("#sunburstChart");
  chartContainer.selectAll("*:not(h2)").remove(); // Keep the heading

  if (!artistData.length) {
    chartContainer
      .append("p")
      .attr("class", "empty-message")
      .text("No album data found for this artist.");
    return;
  }

  // ===== Album & Single Stats =====
  const albums = d3.groups(
    artistData,
    (d) => d.master_metadata_album_album_name
  );
  const totalAlbums = albums.length;
  const singleAlbums = albums.filter(([albumName, records]) => {
    const trackNames = Array.from(
      new Set(records.map((d) => d.master_metadata_track_name.toLowerCase()))
    );
    return trackNames.length === 1 && trackNames[0] === albumName.toLowerCase();
  }).length;
  // Compute total listening minutes per album
  const albumMinutes = albums.map(([albumName, records]) => ({
    album: albumName,
    minutes: d3.sum(records, (d) => +d.ms_played / 60000),
    tracks: Array.from(
      new Set(records.map((d) => d.master_metadata_track_name))
    ),
    daysListened: new Set(
      records.map((d) => new Date(d.ts).toISOString().split("T")[0])
    ).size,
  }));

  // Sort to find the most listened album
  albumMinutes.sort((a, b) => b.minutes - a.minutes);
  const topAlbum = albumMinutes[0];

  // Find album with most distinct tracks played
  const albumWithMostTracks = albumMinutes.reduce(
    (max, current) =>
      current.tracks.length > max.tracks.length ? current : max,
    albumMinutes[0]
  );

  // Find album you returned to over most days
  const mostConsistentAlbum = albumMinutes.reduce(
    (max, current) => (current.daysListened > max.daysListened ? current : max),
    albumMinutes[0]
  );

  chartContainer
    .insert("div", "svg") // insert before SVG
    .attr("class", "info_box")
    .style("margin-bottom", "var(--spacing)")
    .style("margin-top", "var(--spacing)")
    .style("background", "rgba(76, 175, 79, 0.1)")
    .style("padding", "var(--spacing)")
    .style("font-size", "var(--font-small-size)")
    .style("border", "1px solid #ddd")
    .style("border-radius", "var(--border-radius-small)").html(`
      <strong>Albums You’ve Explored:</strong><br>
      You’ve listened to <strong>${totalAlbums}</strong> albums from <strong>${artistName}</strong>, and <strong>${singleAlbums}</strong> of them appear to be singles.<br><br>
      <strong>Top Album:</strong> <em>${
        topAlbum.album
      }</em> with <strong>${topAlbum.minutes.toFixed(
    1
  )}</strong> total minutes.<br>
      <strong>Most Tracks Played:</strong> <em>${
        albumWithMostTracks.album
      }</em> (${albumWithMostTracks.tracks.length} unique songs).<br>
      <strong>Most Returned-To:</strong> <em>${
        mostConsistentAlbum.album
      }</em> (listened on ${mostConsistentAlbum.daysListened} days).
    `);

  // ===== Build Sunburst Hierarchy =====
  const hierarchy = {
    name: artistName,
    children: albums.map(([album, records]) => {
      const tracks = d3.groups(records, (d) => d.master_metadata_track_name);
      return {
        name: album,
        children: tracks.map(([track, trackRecords]) => ({
          name: track,
          value: d3.sum(trackRecords, (d) => +d.ms_played / 60000),
        })),
      };
    }),
  };

  // ===== Sunburst Chart (Unchanged) =====
  const width = 300,
    radius = width / 2;
  const partition = d3.partition().size([2 * Math.PI, radius]);
  const root = d3.hierarchy(hierarchy).sum((d) => d.value);
  partition(root);

  const svg = chartContainer
    .append("svg")
    .attr("width", width)
    .attr("height", width)
    .append("g")
    .attr("transform", `translate(${radius},${radius})`);

  const arc = d3
    .arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => d.y1);

  const color = d3.scaleOrdinal(d3.schemeSet2);

  const paths = svg
    .selectAll("path")
    .data(root.descendants().filter((d) => d.depth))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => {
      let current = d;
      while (current.depth > 1) current = current.parent;
      return color(current.data.name);
    })
    .attr("stroke", "#fff")
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      const percentage = ((d.value / root.value) * 100).toFixed(2);
      d3.select(this).transition().duration(200).attr("opacity", 0.7);
      d3.select("#sunburstTooltip")
        .interrupt()
        .style("opacity", 1)
        .html(
          `<strong>${d.data.name}</strong><br/>${d.value.toFixed(
            1
          )} minutes<br/>(${percentage}%)`
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mousemove", (event) => {
      d3.select("#sunburstTooltip")
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).transition().duration(200).attr("opacity", 1);
      d3.select("#sunburstTooltip")
        .transition()
        .duration(200)
        .style("opacity", 0);
    })
    .on("click", function (event, d) {
      if (d.depth === 1) {
        drillDownState.selectedAlbum = d.data.name;
        paths
          .transition()
          .duration(200)
          .attr("fill", function (p) {
            if (
              p
                .ancestors()
                .find(
                  (a) =>
                    a.depth === 1 &&
                    a.data.name === drillDownState.selectedAlbum
                )
            ) {
              let albumNode = p.ancestors().find((a) => a.depth === 1);
              return color(albumNode.data.name);
            }
            return "#f5f5f5";
          })
          .attr("stroke", (p) =>
            p.depth === 1 && p.data.name === drillDownState.selectedAlbum
              ? "#000"
              : "#fff"
          )
          .attr("stroke-width", (p) =>
            p.depth === 1 && p.data.name === drillDownState.selectedAlbum
              ? 4
              : 1
          );

        updateSongDistribution(artistData);
      }
    });

  d3.select("#sunburstTooltip")
    .on("mouseenter", () =>
      d3.select("#sunburstTooltip").interrupt().style("opacity", 1)
    )
    .on("mouseleave", () =>
      d3
        .select("#sunburstTooltip")
        .transition()
        .duration(200)
        .style("opacity", 0)
    );
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
  d3.select("#moodSankey").select("svg").remove();
  const width = 400,
    height = 400;
  const svg = d3
    .select("#moodSankey")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
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
      linkSelection.attr("opacity", (link) =>
        link.source.name === d.name || link.target.name === d.name ? 1 : 0.1
      );
    })
    .on("mouseout", function () {
      linkSelection.attr("opacity", 0.5);
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
  d3.select("#moodInfo").html(`
          <h3>Mood & Behavior Info</h3>
          <p>Each node represents a reason why you started or ended a song.
             The links show the frequency of transitions between these reasons.</p>
          <p>The biggest combo is <strong>${maxCombo.value} plays</strong> from 
             <strong>${
               sankeyNodes[maxCombo.source]
                 ? sankeyNodes[maxCombo.source].name
                 : "N/A"
             }</strong>
             to <strong>${
               sankeyNodes[maxCombo.target]
                 ? sankeyNodes[maxCombo.target].name
                 : "N/A"
             }</strong>.
          </p>
        `);
  d3.select("#moodSankeyLegend").html("");
  const legend = d3
    .select("#moodSankeyLegend")
    .append("div")
    .attr("class", "legend-container")
    .style("margin-top", "10px");
  const legendData = sankeyNodes.map((d) => d.name);
  legend
    .selectAll(".legend-item")
    .data(legendData)
    .enter()
    .append("div")
    .attr("class", "legend-item")
    .style("display", "flex")
    .style("align-items", "center")
    .style("margin-bottom", "5px")
    .html((d) => {
      const colorBox = `<span style="
                display:inline-block;
                width:14px;
                height:14px;
                background:${color(d)};
                margin-right:5px;
              "></span>`;
      const explanation = reasonExplanations[d] || d;
      return colorBox + `<strong>${d}:</strong> ${explanation}`;
    });
}

/***********************
 * Update All Charts for Selected Artist
 ***********************/
function updateAllCharts(data, artistName) {
  // Reset drill down state
  drillDownState.selectedYear = null;
  drillDownState.selectedAlbum = null;
  const chartContainer = d3.select("#songDistChart");
  chartContainer.html("");
  chartContainer.append("h2").text("Song Distribution");
  // Do not update the artist info here to prevent refreshing the info box
  updatePeakListening(data, artistName);
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
