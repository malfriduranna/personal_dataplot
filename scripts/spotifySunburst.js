function updateSunburstChart(data, artistName) {
    let selectedAlbumNode = null;
  
    // Build album track count map
    const albumTrackCountMap = new Map();
    data.forEach((d) => {
      const album = d.master_metadata_album_album_name;
      const track = d.master_metadata_track_name;
      if (!album || !track) return;
      if (!albumTrackCountMap.has(album))
        albumTrackCountMap.set(album, new Set());
      albumTrackCountMap.get(album).add(track);
    });
  
    const artistData = data.filter(
      (d) =>
        d.master_metadata_album_artist_name?.toLowerCase() ===
        artistName.toLowerCase()
    );
  
    if (artistData.length === 0) {
      d3.select("#sunburstChart").html(
        "<p class='empty-message'>No data found for this artist.</p>"
      );
      d3.select("#insightContent").html("");
      d3.select("#tooltip_sunburst").style("opacity", 0).html("");
      d3.select("#albumDetails").html("");
      return;
    }
  
    const albumsMap = d3.group(
      artistData,
      (d) => d.master_metadata_album_album_name
    );
    const hierarchyData = {
      name: artistName,
      children: Array.from(albumsMap, ([album, albumRows]) => {
        const tracksMap = d3.group(
          albumRows,
          (d) => d.master_metadata_track_name
        );
        const tracks = Array.from(tracksMap, ([track, rows]) => ({
          name: track,
          value: d3.sum(rows, (d) => d.ms_played),
          uri: rows[0].spotify_track_uri,
        }));
        const firstTrackWithUri = albumRows.find((d) =>
          d.spotify_track_uri?.includes("spotify:track:")
        );
        const imagePromise = firstTrackWithUri
          ? fetch(
              `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${
                firstTrackWithUri.spotify_track_uri.split(":")[2]
              }`
            )
              .then((res) => res.json())
              .then((embedData) => embedData.thumbnail_url)
              .catch(() => "")
          : Promise.resolve("");
        return {
          name: album,
          imagePromise,
          children: tracks,
        };
      }),
    };
  
    d3.select("#sunburstChart").select("svg").remove();
  
    const width = 400;
    const radius = width / 2;
  
    const root = d3
      .hierarchy(hierarchyData)
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value);
  
    d3.partition().size([2 * Math.PI, radius])(root);
  
    const arc = d3
      .arc()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1);
  
    const svg = d3
      .select("#sunburstChart")
      .append("svg")
      .attr("width", width)
      .attr("height", width)
      .append("g")
      .attr("transform", `translate(${radius},${radius})`);
  
    const color = d3.scaleOrdinal(d3.schemeTableau10);
  
    const arcs = svg
      .selectAll("g")
      .data(root.descendants().filter((d) => d.depth))
      .enter()
      .append("g")
      .attr("class", "arc-group");
  
    arcs
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) =>
        d.depth === 1 ? color(d.data.name) : color(d.parent.data.name)
      )
      .attr("stroke", "#fff")
      .style("cursor", (d) => (d.depth === 1 ? "pointer" : "default"))
      .on("mouseover", (event, d) => {
        if (selectedAlbumNode) return;
        arcs.select("path").style("opacity", 0.4);
        d3.select(event.currentTarget).style("opacity", 1);
  
        const info =
          d.depth === 1
            ? `<div class='mini_tooltip'><strong>${d.data.name}</strong><br>${(
                d.value / 60000
              ).toFixed(1)} min</div>`
            : `<div class='mini_tooltip'><strong>${d.data.name}</strong><br>${(
                d.data.value / 60000
              ).toFixed(1)} min</div>`;
  
        d3.select("#tooltip_sunburst")
          .style("opacity", 1)
          .style("left", event.pageX + 15 + "px")
          .style("top", event.pageY - 20 + "px")
          .html(info);
      })
      .on("mousemove", (event) => {
        if (!selectedAlbumNode) {
          d3.select("#tooltip_sunburst")
            .style("left", event.pageX + 15 + "px")
            .style("top", event.pageY - 20 + "px");
        }
      })
      .on("mouseout", () => {
        if (selectedAlbumNode) return;
        arcs.select("path").style("opacity", 1);
        d3.select("#tooltip_sunburst").style("opacity", 0).html("");
      })
      .on("click", (event, d) => {
        if (selectedAlbumNode || d.depth !== 1) return;
        selectedAlbumNode = d;
  
        arcs
          .select("path")
          .style("stroke-width", "1px")
          .style("opacity", (arcD) =>
            arcD === d || arcD.parent === d ? 1 : 0.1
          );
  
        d3.select(event.currentTarget)
          .style("stroke-width", "3px")
          .classed("arc-selected", true);
  
        const listenedTracks = d.children.filter((t) => t.data.value > 0);
        const listenedRatio = listenedTracks.length / d.children.length;
        const mean = d3.mean(d.children.map((t) => t.data.value));
        const isCompleted =
          listenedRatio > 0.8 &&
          listenedTracks.every((t) => t.data.value >= 0.9 * mean);
  
        const albumInfo = d.children
          .sort((a, b) => b.data.value - a.data.value)
          .map(
            (track) =>
              `<li>${track.data.name} - ${(track.data.value / 60000).toFixed(
                1
              )} min</li>`
          )
          .join("");
  
        const albumName = d.data.name;
        const totalTracks =
          albumTrackCountMap.get(albumName)?.size || d.children.length;
  
        d.data.imagePromise.then((albumImage) => {
          d3.select("#albumDetails").html(`
              <div class="album_details_container">
                  <div class="album_details_header">
                      <h2>${albumName}</h2>
                      <button id="closeAlbumDetails" class="button">X</button>
                  </div>
                  <div class="album_details_content">
                      ${
                        albumImage
                          ? `<img src="${albumImage}" alt="Album cover" class="album-cover">`
                          : ""
                      }
                      <p><strong>Total Listening Time:</strong> ${(
                        d.value / 60000
                      ).toFixed(1)} min</p>
                      <p><strong>Tracks on Album:</strong> ${totalTracks}</p>
                      <p><strong>Tracks You Listened To:</strong> ${
                        listenedTracks.length
                      }</p>
                      <p><strong>Completion Ratio:</strong> ${(
                        (listenedTracks.length / totalTracks) *
                        100
                      ).toFixed(0)}%</p>
                      <p><strong>Status:</strong> ${
                        isCompleted
                          ? "Album likely completed 🎉"
                          : "Partially listened"
                      }</p>
                      <ul>${albumInfo}</ul>
                      <div id="album-listening-trend">
                        <svg width="900" height="500"></svg>
                      </div>
                  </div>
              </div>
          `);
  
          // Close logic
          d3.select("#closeAlbumDetails").on("click", () => {
            selectedAlbumNode = null;
            d3.select("#albumDetails").html("");
            arcs
              .select("path")
              .classed("arc-selected", false)
              .style("stroke-width", "1px")
              .style("opacity", 1);
          });
  
          // Add album line chart
          const parseDate = d3.timeParse("%Y-%m-%d");
          const formatDate = d3.timeFormat("%Y-%m-%d");
  
          const albumListeningData = artistData
            .filter(
              (row) =>
                row.master_metadata_album_album_name === d.data.name &&
                row.ms_played > 0
            )
            .map((row) => ({
              date: formatDate(new Date(row.ts)),
              minutes: row.ms_played / 60000,
            }));
  
          const dateMap = d3.rollup(
            albumListeningData,
            (v) => d3.sum(v, (d) => d.minutes),
            (d) => d.date
          );
  
          const trendData = Array.from(dateMap, ([date, minutes]) => ({
            date: parseDate(date),
            minutes,
          })).sort((a, b) => a.date - b.date);
  
          const margin = { top: 30, right: 40, bottom: 50, left: 60 },
          width = 900 - margin.left - margin.right,
          height = 400 - margin.top - margin.bottom;
        
  
          const svgTrend = d3
            .select("#album-listening-trend svg")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
  
          const x = d3
            .scaleTime()
            .domain(d3.extent(trendData, (d) => d.date))
            .range([0, width]);
  
          const y = d3
            .scaleLinear()
            .domain([0, d3.max(trendData, (d) => d.minutes)])
            .nice()
            .range([height, 0]);
  
          svgTrend
            .append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(5));
          svgTrend.append("g").call(d3.axisLeft(y));
  
          const line = d3
            .line()
            .x((d) => x(d.date))
            .y((d) => y(d.minutes));
  
          svgTrend
            .append("path")
            .datum(trendData)
            .attr("fill", "none")
            .attr("stroke", "#69b3a2")
            .attr("stroke-width", 2)
            .attr("d", line);
        });
      });
  
    // Summary stats
    const trackNodes = root.descendants().filter((d) => d.depth === 2);
    const albumNodes = root.descendants().filter((d) => d.depth === 1);
  
    const topTracks = trackNodes
      .sort((a, b) => b.data.value - a.data.value)
      .slice(0, 3);
    const topAlbums = albumNodes.sort((a, b) => b.value - a.value).slice(0, 3);
  
    const completedAlbums = albumNodes.filter((album) => {
      const albumTracks = album.children.length;
      const allTrackDurations = album.children.map((d) => d.data.value);
      const mean = d3.mean(allTrackDurations);
      const completionRatio =
        allTrackDurations.filter((d) => d > 0.9 * mean).length / albumTracks;
      return completionRatio > 0.8;
    });
  
    const albumListeningInsight =
      completedAlbums.length / albumNodes.length > 0.6
        ? "You tend to listen to full albums."
        : "You mostly listen to a few tracks per album.";
  
    const firstListenDate = d3.min(
      artistData,
      (d) => new Date(d.ts)
    ).toLocaleDateString();
  
    d3.select("#insightContent").html(`
      <p><strong>First time you listened to this artist:</strong><br>${firstListenDate}</p>
      <p><strong>Listening habit:</strong><br>${albumListeningInsight}</p>
      <p><strong>Top Albums:</strong>
        <ul>${topAlbums
          .map(
            (a) =>
              `<li>${a.data.name} (${(a.value / 60000).toFixed(1)} min)</li>`
          )
          .join("")}</ul>
      </p>
      <p><strong>Top Tracks:</strong>
        <ul>${topTracks
          .map(
            (t) =>
              `<li>${t.data.name} (${(t.data.value / 60000).toFixed(1)} min)</li>`
          )
          .join("")}</ul>
      </p>
    `);
  
    d3.select("#albumDetails").html("");
  }
  

// --- Autocomplete Search Engine ---
/**
 * initArtistSearch
 * Initializes the search input with an autocomplete dropdown.
 *
 * @param {Array} data - Array of parsed data objects.
 */
function initArtistSearch(data) {
  // Create a unique list of artist names.
  const artistSet = new Set();
  data.forEach((d) => {
    if (d.master_metadata_album_artist_name) {
      artistSet.add(d.master_metadata_album_artist_name);
    }
  });
  const artists = Array.from(artistSet).sort();

  const input = document.getElementById("artistSearchInput");
  const dropdown = document.getElementById("artistDropdown");

  // Function to update the dropdown based on the input.
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
          updateSunburstChart(window.allParsedData, artist);
        });
        dropdown.appendChild(li);
      });
      dropdown.style.display = "block";
    } else {
      dropdown.style.display = "none";
    }
  }

  input.addEventListener("input", showDropdown);

  // Trigger search on Enter key.
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      dropdown.style.display = "none";
      updateSunburstChart(window.allParsedData, input.value.trim());
    }
  });

  // Hide dropdown when clicking outside.
  document.addEventListener("click", (event) => {
    if (!input.contains(event.target) && !dropdown.contains(event.target)) {
      dropdown.style.display = "none";
    }
  });

  // Bind the search button.
  document.getElementById("artistSearchBtn").addEventListener("click", () => {
    updateSunburstChart(window.allParsedData, input.value.trim());
  });
}

// --- Initialize the Dashboard ---
// Assume that your CSV data is already fetched and parsed, and stored in window.allParsedData.
// For example, you might have a separate script that loads "data/astrid_data.csv" and sets window.allParsedData.
// Once the data is loaded, initialize the search.
// --- Load CSV and Initialize Everything ---
fetch("data/astrid_data.csv")
  .then((response) => response.text())
  .then((csvText) => {
    const parsedData = d3.csvParse(csvText);
    window.allParsedData = parsedData;

    // Initialize the search and optionally load a default chart
    initArtistSearch(parsedData);

    // Optional: auto-show top artist
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
      updateSunburstChart(parsedData, mostPlayedArtist);
      document.getElementById("artistSearchInput").value = mostPlayedArtist;
    }
  })
  .catch((error) => {
    console.error("Error loading CSV data:", error);
    d3.select("#sunburstChart").html(
      "<p class='empty-message'>Failed to load data.</p>"
    );
  });
