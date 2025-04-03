/**
 * updateBubbleClusterChart
 * Creates a bubble cluster chart where each album is represented as a large bubble
 * containing smaller bubbles for its tracks. The bubble sizes represent the listening time (ms_played),
 * and both album and its track bubbles share the same color.
 *
 * Additionally, a legend is created:
 * - The album legend shows the album names and corresponding colors.
 * - The top songs legend lists the top 5 most played tracks.
 *
 * Data columns referenced:
 * - ts
 * - ms_played
 * - master_metadata_album_album_name
 * - master_metadata_album_artist_name
 * - master_metadata_track_name
 *
 * @param {Array} data - Array of parsed data objects.
 * @param {String} artistName - The artist to filter on.
 */
function updateBubbleClusterChart(data, artistName) {
    // Filter data for the selected artist.
    const artistData = data.filter(d => 
      d.master_metadata_album_artist_name === artistName
    );
    if (artistData.length === 0) {
      d3.select("#artistListeningDepthChart").html("<p class='empty-message'>No data found for this artist.</p>");
      return;
    }
  
    // Group data by album and then by track.
    const albumsMap = d3.group(
      artistData,
      d => d.master_metadata_album_album_name
    );
    const hierarchyData = {
      name: artistName,
      children: Array.from(albumsMap, ([album, albumRows]) => {
        // Group by track within the album.
        const tracksMap = d3.group(
          albumRows,
          d => d.master_metadata_track_name
        );
        const tracks = Array.from(tracksMap, ([track, trackRows]) => ({
          name: track,
          value: d3.sum(trackRows, d => d.ms_played)
        }));
        return {
          name: album,
          children: tracks,
          value: d3.sum(tracks, t => t.value)
        };
      })
    };
  
    // Set up dimensions.
    const width = 600, height = 600;
    
    // Clear any previous chart.
    d3.select("#artistListeningDepthChart").html("");
    
    // Create an SVG container and center the group.
    const svg = d3.select("#artistListeningDepthChart")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width/2}, ${height/2})`);
    
    // Create a pack layout.
    const pack = d3.pack()
      .size([width, height])
      .padding(5);
    
    // Create a hierarchy and compute the sums.
    const root = d3.hierarchy(hierarchyData)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);
    
    pack(root);
    
    // Create a color scale for albums.
    // We use d3.schemeCategory10; album nodes will define the color.
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Draw nodes (both album and track bubbles).
    const nodes = svg.selectAll("g")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("transform", d => `translate(${d.x - width/2}, ${d.y - height/2})`);
    
    nodes.append("circle")
      .attr("r", d => d.r)
      .style("fill", d => {
        if (d.depth === 0) return "#fff";
        if (d.depth === 1) return color(d.data.name);           // Album bubble color.
        if (d.depth === 2) return color(d.parent.data.name);       // Track bubble: same as album.
        return "#ccc";
      })
      .style("stroke", "#333")
      .on("mouseover", (event, d) => {
        let info;
        if (d.depth === 1) {
          info = `<strong>Album: ${d.data.name}</strong><br/>${(d.value/60000).toFixed(2)} minutes`;
        } else if (d.depth === 2) {
          // For track nodes, d.data.value might not be directly present.
          info = `<strong>Track: ${d.data.name}</strong><br/>${(d.data.value/60000).toFixed(2)} minutes`;
        } else {
          info = `<strong>${d.data.name}</strong>`;
        }
        d3.select("#tooltip")
          .style("opacity", 1)
          .html(info)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 20 + "px");
      })
      .on("mousemove", (event) => {
        d3.select("#tooltip")
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 20 + "px");
      })
      .on("mouseout", () => {
        d3.select("#tooltip").style("opacity", 0);
      });
    
    // Optionally, add text labels for album nodes if the bubble is large enough.
    nodes.filter(d => d.depth === 1 && d.r > 20)
      .append("text")
      .attr("dy", "0.3em")
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("pointer-events", "none")
    
    // ---- Create a Legend ----
    // Create an HTML legend appended below the SVG.
    const legend = d3.select("#artistListeningDepthChart")
      .append("div")
      .attr("class", "legend")
      .style("margin-top", "10px");
  
    // List album names with their corresponding color.
    legend.append("div")
      .attr("class", "legend-title")
      .style("font-weight", "bold")
      .text("Albums:");
  
    const albumLegend = legend.selectAll(".legend-item")
      .data(root.children) // root.children are the album nodes.
      .enter()
      .append("div")
      .attr("class", "legend-item")
      .style("display", "inline-block")
      .style("margin-right", "10px");
  
    albumLegend.append("span")
      .attr("class", "legend-color")
      .style("display", "inline-block")
      .style("width", "12px")
      .style("height", "12px")
      .style("background-color", d => color(d.data.name))
      .style("margin-right", "4px");
  
    albumLegend.append("span")
      .attr("class", "legend-label")
      .text(d => d.data.name);
  
    // ---- Top Songs Legend ----
    // Filter track nodes (depth 2) and sort descending by their value.
    const trackNodes = root.descendants().filter(d => d.depth === 2);
    trackNodes.sort((a, b) => b.data.value - a.data.value);
    // Take top 5 tracks.
    const topTracks = trackNodes.slice(0, 5);
    
    const topSongsLegend = legend.append("div")
      .attr("class", "top-songs")
      .style("margin-top", "10px");
  
    topSongsLegend.append("div")
      .attr("class", "legend-title")
      .style("font-weight", "bold")
      .text("Top Songs:");
  
    const topSongsList = topSongsLegend.append("ol")
      .style("padding-left", "20px");
  
    topTracks.forEach(d => {
      topSongsList.append("li")
        .text(`${d.data.name} – ${(d.data.value / 60000).toFixed(2)} minutes`);
    });
  }
  

document.getElementById("artistSearchBtn").addEventListener("click", () => {
  const artistName = document.getElementById("artistSearchInput").value.trim();
  if (!artistName) {
    alert("Please enter an artist name");
    return;
  }
  updateBubbleClusterChart(window.allParsedData, artistName);
});
