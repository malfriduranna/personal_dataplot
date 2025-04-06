/***********************
 * Global Drill-Down State
 ***********************/
let drillDownState = {
  selectedYear: null,
  selectedAlbum: null
};

/***********************
 * Drill-Down: Song Distribution as a Radar Chart (by Year, Album, or Both)
 ***********************/
function updateSongDistribution(artistData) {
  // Filter data based on drillDownState.
  let filtered = artistData;
  let headerText = "Song Distribution";
  if (drillDownState.selectedYear) {
    filtered = filtered.filter(d => new Date(d.ts).getFullYear() === drillDownState.selectedYear);
    headerText += ` for Year: ${drillDownState.selectedYear}`;
  }
  if (drillDownState.selectedAlbum) {
    filtered = filtered.filter(d => d.master_metadata_album_album_name.toLowerCase() === drillDownState.selectedAlbum.toLowerCase());
    headerText += drillDownState.selectedYear ? ` & Album: ${drillDownState.selectedAlbum}` : ` for Album: ${drillDownState.selectedAlbum}`;
  }
  if (filtered.length === 0) {
    d3.select("#songDistChart").html("<p class='empty-message'>No song data for the selected criteria.</p>");
    return;
  }
  const songData = d3.rollups(
    filtered,
    v => d3.sum(v, d => +d.ms_played / 60000),
    d => d.master_metadata_track_name
  ).map(([track, minutes]) => ({ track, minutes }));
  
  // Clear previous content.
  d3.select("#songDistChart").html("");
  
  // Add a Reset Drill Down button.
  const resetButton = document.createElement("button");
  resetButton.textContent = "Reset Drill Down";
  resetButton.addEventListener("click", () => {
    drillDownState.selectedYear = null;
    drillDownState.selectedAlbum = null;
    d3.select("#songDistChart").html("<h2>Song Distribution</h2>");
  });
  document.getElementById("songDistChart").appendChild(resetButton);
  
  // Insert header.
  d3.select("#songDistChart")
    .insert("h3", ":first-child")
    .text(headerText);
  
  // Radar chart configuration.
  const width = 500,
        height = 500,
        margin = { top: 50, right: 50, bottom: 50, left: 50 },
        radius = Math.min(width, height) / 2 - 40;
  const numAxes = songData.length;
  const maxValue = d3.max(songData, d => d.minutes);
  const angleSlice = (Math.PI * 2) / numAxes;
  
  // Create SVG container.
  const svg = d3.select("#songDistChart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${(width/2)+margin.left},${(height/2)+margin.top})`);
  
  // Draw circular grid lines.
  const levels = 5;
  for (let level = 1; level <= levels; level++) {
    const rLevel = radius * (level / levels);
    svg.append("circle")
      .attr("r", rLevel)
      .attr("fill", "none")
      .attr("stroke", "#CDCDCD")
      .attr("stroke-dasharray", "2,2");
  }
  
  // Draw axis lines and labels.
  songData.forEach((d, i) => {
    const angle = i * angleSlice - Math.PI/2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    svg.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", x)
      .attr("y2", y)
      .attr("stroke", "#CDCDCD")
      .attr("stroke-width", 1);
    svg.append("text")
      .attr("x", (radius + 10) * Math.cos(angle))
      .attr("y", (radius + 10) * Math.sin(angle))
      .attr("dy", "0.35em")
      .attr("text-anchor", (Math.cos(angle) > 0) ? "start" : "end")
      .style("font-size", "11px")
      .text(d.track);
  });
  
  // Scale for the radar.
  const rScale = d3.scaleLinear()
    .range([0, radius])
    .domain([0, maxValue]);
  
  // Create the radar line generator.
  const radarLine = d3.lineRadial()
    .radius(d => rScale(d.minutes))
    .angle((d, i) => i * angleSlice)
    .curve(d3.curveLinearClosed);
  
  // Draw the radar polygon.
  svg.append("path")
    .datum(songData)
    .attr("d", radarLine)
    .attr("fill", "#4caf4f")
    .attr("fill-opacity", 0.3)
    .attr("stroke", "#4caf4f")
    .attr("stroke-width", 2);
  
  // Optionally, add markers at each data point.
  svg.selectAll(".radarCircle")
    .data(songData)
    .enter()
    .append("circle")
    .attr("class", "radarCircle")
    .attr("r", 4)
    .attr("cx", (d, i) => rScale(d.minutes) * Math.cos(i * angleSlice - Math.PI/2))
    .attr("cy", (d, i) => rScale(d.minutes) * Math.sin(i * angleSlice - Math.PI/2))
    .attr("fill", "#4caf4f")
    .attr("fill-opacity", 0.8)
    .append("title")
    .text(d => `${d.track}: ${d.minutes.toFixed(1)} minutes`);
}



/***********************
 * Artist Info with Animated Transitions
 ***********************/
function updateArtistInfo(data, artistName) {
  const placeholderImg = "https://via.placeholder.com/150";
  const artistData = data.filter(
    d =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() === artistName.toLowerCase()
  );
  if (!artistData.length) return;

  const totalPlays = artistData.length;
  const totalMinutes = d3.sum(artistData, d => +d.ms_played) / 60000;
  const firstListenDate = new Date(d3.min(artistData, d => new Date(d.ts)));
  const listensByYear = d3.rollups(
    artistData,
    v => d3.sum(v, d => +d.ms_played / 60000),
    d => new Date(d.ts).getFullYear()
  );
  const [peakYear, peakMinutes] = listensByYear.reduce((a, b) => (a[1] > b[1] ? a : b), [null, 0]);
  const topSongEntry = d3.rollups(
    artistData,
    v => d3.sum(v, d => +d.ms_played / 60000),
    d => d.master_metadata_track_name
  ).reduce((a, b) => (a[1] > b[1] ? a : b), [null, 0]);
  const topSong = topSongEntry[0];
  const topSongMinutes = topSongEntry[1];

  const overallRankings = d3.rollups(
    data,
    v => d3.sum(v, d => +d.ms_played),
    d => d.master_metadata_album_artist_name
  ).sort((a, b) => b[1] - a[1]);
  const overallRank = overallRankings.findIndex(([artist]) => artist.toLowerCase() === artistName.toLowerCase()) + 1;

  const yearRankings = d3.rollups(
    data,
    v => d3.rollups(v, vv => d3.sum(vv, d => +d.ms_played), d => d.master_metadata_album_artist_name),
    d => new Date(d.ts).getFullYear()
  );
  const topYears = [];
  yearRankings.forEach(([year, artistArr]) => {
    artistArr.sort((a, b) => b[1] - a[1]);
    const rank = artistArr.findIndex(([artist]) => artist.toLowerCase() === artistName.toLowerCase()) + 1;
    if (rank > 0 && rank <= 5) {
      topYears.push({
        year,
        rank,
        totalMinutes: artistArr.find(([artist]) => artist.toLowerCase() === artistName.toLowerCase())[1] / 60000
      });
    }
  });

  // Get Artist Image via oEmbed from top song if available.
  const trackForImg = artistData.find(
    d =>
      d.master_metadata_track_name === topSong &&
      d.spotify_track_uri &&
      d.spotify_track_uri.includes("spotify:track:")
  );
  let artistImageUrl = placeholderImg;
  if (trackForImg) {
    const trackId = trackForImg.spotify_track_uri.split(":")[2];
    const oEmbedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
    fetch(oEmbedUrl)
      .then(res => res.json())
      .then(embedData => {
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
              ${totalPlays ? `<p><strong>Total Plays:</strong> ${totalPlays}</p>` : ""}
              ${totalMinutes ? `<p><strong>Total Minutes:</strong> ${totalMinutes.toFixed(1)}</p>` : ""}
              ${firstListenDate ? `<p><strong>First Listened:</strong> ${firstListenDate.toLocaleDateString()}</p>` : ""}
              ${peakYear ? `<p><strong>Peak Listening Year:</strong> ${peakYear} (${peakMinutes.toFixed(1)} minutes)</p>` : ""}
              ${topSong ? `<p><strong>Top Song:</strong> ${topSong} (${topSongMinutes.toFixed(1)} minutes)</p>` : ""}
            </div>
            <div class="info-right">
              ${overallRank ? `<p><strong>Overall Rank:</strong> #${overallRank} among all artists</p>` : ""}
              ${
                topYears.length
                  ? `<p><strong>Top 5 Years:</strong></p>
                     <ul>
                      ${topYears.map(d => `<li>${d.year}: Ranked #${d.rank} (${d.totalMinutes.toFixed(1)} minutes)</li>`).join("")}
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
    d =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() === artistName.toLowerCase()
  );
  if (!artistData.length) {
    d3.select("#barChart").html("<p class='empty-message'>No listening data found for this artist.</p>");
    return;
  }

  const yearData = d3.rollups(
    artistData,
    v => d3.sum(v, d => +d.ms_played / 60000),
    d => new Date(d.ts).getFullYear()
  ).map(([year, totalMinutes]) => ({ year: +year, totalMinutes }));
  yearData.sort((a, b) => a.year - b.year);

  d3.select("#barChart").select("svg").remove();
  const margin = { top: 30, right: 30, bottom: 50, left: 80 },
    width = 400 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;
  const svg = d3.select("#barChart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(yearData.map(d => d.year)).range([0, width]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(yearData, d => d.totalMinutes)]).nice().range([height, 0]);
  svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  svg.append("g").call(d3.axisLeft(y));
  svg.append("text").attr("x", width).attr("y", height + 40).attr("text-anchor", "end").text("Year");
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -60)
    .attr("x", -height / 2)
    .attr("dy", "1em")
    .attr("text-anchor", "middle")
    .text("Total Minutes Played");

  // When a bar is clicked, set the selected year and update song distribution.
  const bars = svg.selectAll("rect")
    .data(yearData)
    .enter()
    .append("rect")
    .attr("x", d => x(d.year))
    .attr("y", height)
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("fill", "#ff7f0e")
    .on("click", (event, d) => {
      drillDownState.selectedYear = d.year;
      updateSongDistribution(artistData);
    });
  bars.append("title").text(d => `${d.year}: ${d.totalMinutes.toFixed(1)} minutes`);
  bars.transition().duration(800).attr("y", d => y(d.totalMinutes)).attr("height", d => height - y(d.totalMinutes));
}

/***********************
 * Scatter Plot with Enhanced Interactions
 ***********************/
function updateScatterPlot(data, artistName) {
  const artistData = data.filter(
    d =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() === artistName.toLowerCase()
  );
  if (!artistData.length) {
    d3.select("#scatterChart").html("<p class='empty-message'>No listening data found for this artist.</p>");
    return;
  }
  const trackStats = d3.rollups(
    artistData,
    v => {
      const totalMinutes = d3.sum(v, d => +d.ms_played / 60000);
      const dayMap = d3.rollup(v, vv => d3.sum(vv, d => +d.ms_played / 60000), d => new Date(d.ts).toLocaleDateString());
      const maxMinutes = d3.max(Array.from(dayMap.values()));
      return { totalMinutes, maxMinutes };
    },
    d => d.master_metadata_track_name
  ).map(([track, stats]) => ({ track, ...stats }));
  d3.select("#scatterChart").select("svg").remove();
  const margin = { top: 30, right: 30, bottom: 50, left: 50 },
    width = 400 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;
  const svg = d3.select("#scatterChart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().domain([0, d3.max(trackStats, d => d.totalMinutes)]).nice().range([0, width]);
  const y = d3.scaleLinear().domain([0, d3.max(trackStats, d => d.maxMinutes)]).nice().range([height, 0]);
  svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
  svg.append("g").call(d3.axisLeft(y));
  svg.append("text").attr("x", width).attr("y", height + 40).attr("text-anchor", "end").text("Total Minutes Played");
  svg.append("text").attr("transform", "rotate(-90)").attr("y", -40).attr("x", -10).attr("text-anchor", "end").text("Max Minutes in a Day");
  const circles = svg.selectAll("circle")
    .data(trackStats)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.totalMinutes))
    .attr("cy", d => y(d.maxMinutes))
    .attr("r", 0)
    .attr("fill", "#69b3a2")
    .attr("opacity", 0.7);
  circles.append("title").text(d => `${d.track}: ${d.totalMinutes.toFixed(1)} total, ${d.maxMinutes.toFixed(1)} max`);
  circles.transition().duration(800).attr("r", 6).delay((d, i) => i * 10);
}

/***********************
 * Sunburst Chart with Drill-Down for Song Distribution
 ***********************/
function updateSunburstChart(data, artistName) {
  const artistData = data.filter(
    d =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() === artistName.toLowerCase() &&
      d.master_metadata_album_album_name
  );
  if (!artistData.length) {
    d3.select("#sunburstChart").html("<p class='empty-message'>No album data found for this artist.</p>");
    return;
  }
  const albums = d3.groups(artistData, d => d.master_metadata_album_album_name);
  const hierarchy = {
    name: artistName,
    children: albums.map(([album, records]) => {
      const tracks = d3.groups(records, d => d.master_metadata_track_name);
      return {
        name: album,
        children: tracks.map(([track, records]) => {
          const minutes = d3.sum(records, d => +d.ms_played / 60000);
          return { name: track, value: minutes };
        })
      };
    })
  };
  d3.select("#sunburstChart").select("svg").remove();
  const width = 400, radius = width / 2;
  const partition = d3.partition().size([2 * Math.PI, radius]);
  const root = d3.hierarchy(hierarchy).sum(d => d.value);
  partition(root);
  const svg = d3.select("#sunburstChart")
    .append("svg")
    .attr("width", width)
    .attr("height", width)
    .append("g")
    .attr("transform", `translate(${radius},${radius})`);
  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .innerRadius(d => d.y0)
    .outerRadius(d => d.y1);
  // Use a new color palette (schemeSet2)
  const color = d3.scaleOrdinal(d3.schemeSet2);
  const paths = svg.selectAll("path")
    .data(root.descendants().filter(d => d.depth))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", d => {
      let current = d;
      while (current.depth > 1) current = current.parent;
      return color(current.data.name);
    })
    .attr("stroke", "#fff")
    .attr("cursor", "pointer")
    .on("mouseover", function(event, d) {
      const percentage = ((d.value / root.value) * 100).toFixed(2);
      d3.select(this).transition().duration(200).attr("opacity", 0.7);
      d3.select("#sunburstTooltip")
        .interrupt()
        .style("opacity", 1)
        .html(`<strong>${d.data.name}</strong><br/>${d.value.toFixed(1)} minutes<br/>(${percentage}%)`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mousemove", function(event, d) {
      d3.select("#sunburstTooltip")
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mouseout", function() {
      d3.select(this).transition().duration(200).attr("opacity", 1);
      d3.select("#sunburstTooltip").transition().duration(200).style("opacity", 0);
    })
    .on("click", function(event, d) {
      if (d.depth === 1) {
        // Set the selected album.
        drillDownState.selectedAlbum = d.data.name;
        // Highlight the selected album: increase stroke width and change stroke color.
        paths.attr("stroke", p => (p.depth === 1 && p.data.name === drillDownState.selectedAlbum) ? "#000" : "#fff")
             .attr("stroke-width", p => (p.depth === 1 && p.data.name === drillDownState.selectedAlbum) ? 4 : 1);
        updateSongDistribution(artistData);
      }
    });
  d3.select("#sunburstTooltip")
    .on("mouseenter", function() {
      d3.select(this).interrupt().style("opacity", 1);
    })
    .on("mouseleave", function() {
      d3.select(this).transition().duration(200).style("opacity", 0);
    });
}



/***********************
 * Mood & Behavior Sankey with Hover Highlighting
 ***********************/
function updateMoodSankey(data, artistName) {
  const artistData = data.filter(
    d =>
      d.master_metadata_album_artist_name &&
      d.master_metadata_album_artist_name.toLowerCase() === artistName.toLowerCase() &&
      d.reason_start &&
      d.reason_end
  );
  if (!artistData.length) {
    d3.select("#moodSankey").html("<p class='empty-message'>No mood or behavior data found for this artist.</p>");
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
    unknown: "Unknown or unclassified reason"
  };
  const reasons = new Set();
  artistData.forEach(d => {
    reasons.add(d.reason_start);
    reasons.add(d.reason_end);
  });
  const reasonsArray = Array.from(reasons).sort();
  const nodes = reasonsArray.map(r => ({ name: r }));
  const nodeIndex = {};
  nodes.forEach((n, i) => { nodeIndex[n.name] = i; });
  const links = d3.rollups(
      artistData,
      v => v.length,
      d => d.reason_start + "||" + d.reason_end
    ).map(([key, value]) => {
      const parts = key.split("||");
      return {
        source: nodeIndex[parts[0]],
        target: nodeIndex[parts[1]],
        value
      };
    }).filter(link => link.source !== link.target && link.source < link.target);
  const maxCombo = links.reduce((max, d) => d.value > max.value ? d : max, { value: 0 });
  d3.select("#moodSankey").select("svg").remove();
  const width = 400, height = 400;
  const svg = d3.select("#moodSankey").append("svg").attr("width", width).attr("height", height);
  const sankey = d3.sankey().nodeWidth(15).nodePadding(10).extent([[1, 1], [width - 1, height - 6]]);
  const { nodes: sankeyNodes, links: sankeyLinks } = sankey({
    nodes: nodes.map(d => Object.assign({}, d)),
    links: links.map(d => Object.assign({}, d))
  });
  const color = d3.scaleOrdinal(d3.schemeCategory10);
  const linkSelection = svg.append("g")
    .selectAll("path")
    .data(sankeyLinks)
    .enter()
    .append("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", d => color(d.source.name))
    .attr("stroke-width", d => Math.max(1, d.width))
    .attr("fill", "none")
    .attr("opacity", 0.5);
  const node = svg.append("g")
    .selectAll("g")
    .data(sankeyNodes)
    .enter()
    .append("g")
    .on("mouseover", function(event, d) {
      linkSelection.attr("opacity", link =>
        link.source.name === d.name || link.target.name === d.name ? 1 : 0.1
      );
    })
    .on("mouseout", function() {
      linkSelection.attr("opacity", 0.5);
    });
  node.append("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => d.y1 - d.y0)
    .attr("width", d => d.x1 - d.x0)
    .attr("fill", d => color(d.name))
    .attr("stroke", "#000");
  node.append("text")
    .attr("x", d => d.x0 - 6)
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .text(d => d.name)
    .filter(d => d.x0 < width / 2)
    .attr("x", d => d.x1 + 6)
    .attr("text-anchor", "start");
  d3.select("#moodInfo").html(`
    <h3>Mood & Behavior Info</h3>
    <p>Each node represents a reason why you started or ended a song.
       The links show the frequency of transitions between these reasons.</p>
    <p>The biggest combo is <strong>${maxCombo.value} plays</strong> from 
       <strong>${sankeyNodes[maxCombo.source] ? sankeyNodes[maxCombo.source].name : "N/A"}</strong>
       to <strong>${sankeyNodes[maxCombo.target] ? sankeyNodes[maxCombo.target].name : "N/A"}</strong>.
    </p>
  `);
  d3.select("#moodSankeyLegend").html("");
  const legend = d3.select("#moodSankeyLegend")
    .append("div")
    .attr("class", "legend-container")
    .style("margin-top", "10px");
  const legendData = sankeyNodes.map(d => d.name);
  legend.selectAll(".legend-item")
    .data(legendData)
    .enter()
    .append("div")
    .attr("class", "legend-item")
    .style("display", "flex")
    .style("align-items", "center")
    .style("margin-bottom", "5px")
    .html(d => {
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
  updateArtistInfo(data, artistName);
  updateScatterPlot(data, artistName);
  updateBarChart(data, artistName);
  updateSunburstChart(data, artistName);     // main album view with drill-down
  updateMoodSankey(data, artistName);
}

/***********************
 * Initialize Search and Load Data
 ***********************/
function initArtistSearch(data) {
  const artistSet = new Set();
  data.forEach(d => {
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
    const filteredArtists = artists.filter(artist => artist.toLowerCase().includes(query));
    if (filteredArtists.length > 0) {
      filteredArtists.forEach(artist => {
        const li = document.createElement("li");
        li.textContent = artist;
        li.addEventListener("click", () => {
          input.value = artist;
          dropdown.innerHTML = "";
          dropdown.style.display = "none";
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
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      dropdown.style.display = "none";
      const artist = input.value.trim();
      updateAllCharts(data, artist);
    }
  });
  document.addEventListener("click", event => {
    if (!input.contains(event.target) && !dropdown.contains(event.target)) {
      dropdown.style.display = "none";
    }
  });
  document.getElementById("artistSearchBtn").addEventListener("click", () => {
    const artist = input.value.trim();
    updateAllCharts(data, artist);
  });
}

// Load CSV and initialize
fetch("data/astrid_data.csv")
  .then(response => response.text())
  .then(csvText => {
    const parsedData = d3.csvParse(csvText);
    window.allParsedData = parsedData;
    initArtistSearch(parsedData);
    const topArtist = parsedData
      .map(d => d.master_metadata_album_artist_name)
      .filter(Boolean)
      .reduce((acc, artist) => {
        acc[artist] = (acc[artist] || 0) + 1;
        return acc;
      }, {});
    const mostPlayedArtist = Object.entries(topArtist).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (mostPlayedArtist) {
      updateAllCharts(parsedData, mostPlayedArtist);
      document.getElementById("artistSearchInput").value = mostPlayedArtist;
    }
  })
  .catch(error => {
    console.error("Error loading CSV data:", error);
    d3.select("#lineChart").html("<p class='empty-message'>Failed to load data.</p>");
  });
