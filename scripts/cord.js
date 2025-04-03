/**
 * updateParallelCoordinatesPlot
 * Creates a parallel coordinates plot showing selected dimensions from the CSV data.
 *
 * It extracts:
 * - ms_played (listening duration)
 * - hour (extracted from ts)
 * - dayOfWeek (extracted from ts)
 *
 * @param {Array} data - Array of parsed data objects.
 */
function updateParallelCoordinatesPlot(data) {
  // Set up dimensions for the SVG container.
  const margin = { top: 30, right: 10, bottom: 10, left: 10 },
    width = 800 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  // Define the dimensions we want to show.
  const dims = ["ms_played", "hour", "dayOfWeek"];

  // Prepare the data: convert ms_played to number and extract hour/dayOfWeek from ts.
  data.forEach((d) => {
    d.ms_played = +d.ms_played;
    const date = new Date(d.ts);
    d.hour = date.getHours();
    d.dayOfWeek = date.getDay();
  });

  // Create a y-scale for each dimension.
  const y = {};
  y.ms_played = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.ms_played))
    .range([height, 0]);
  y.hour = d3.scaleLinear().domain([0, 23]).range([height, 0]);
  y.dayOfWeek = d3.scaleLinear().domain([0, 6]).range([height, 0]);

  // Create an x-scale: position each dimension along the horizontal axis.
  const x = d3.scalePoint().domain(dims).range([0, width]).padding(0.5);

  // Clear any previous content in the container.
  d3.select("#parallelCoordinatesPlot").html("");

  // Append the SVG container.
  const svg = d3
    .select("#parallelCoordinatesPlot")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Function to create a path for each data record.
  function path(d) {
    return d3.line()(dims.map((p) => [x(p), y[p](d[p])]));
  }

  // Draw background lines (light opacity) for context.
  svg
    .append("g")
    .attr("class", "background")
    .selectAll("path")
    .data(data)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("stroke", "steelblue")
    .attr("stroke-opacity", 0.2)
    .attr("fill", "none");

  // Draw foreground lines.
  svg
    .append("g")
    .attr("class", "foreground")
    .selectAll("path")
    .data(data)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("stroke", "steelblue")
    .attr("stroke-opacity", 0.7)
    .attr("fill", "none");

  // Draw one axis per dimension.
  const g = svg
    .selectAll(".dimension")
    .data(dims)
    .enter()
    .append("g")
    .attr("class", "dimension")
    .attr("transform", (d) => `translate(${x(d)})`);

  // For each axis, draw the axis and add a label.
  g.append("g")
    .each(function (d) {
      d3.select(this).call(d3.axisLeft(y[d]));
    })
    .append("text")
    .style("text-anchor", "middle")
    .attr("y", -9)
    .text((d) => d);
}

document.getElementById("artistSearchBtn").addEventListener("click", () => {
  const artistName = document.getElementById("artistSearchInput").value.trim();
  if (!artistName) {
    alert("Please enter an artist name");
    return;
  }
  updateAlbumDistributionSunburst(window.allParsedData, artistName);
});
