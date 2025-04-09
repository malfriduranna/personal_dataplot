d3.csv("data/astrid_data.csv").then(function(data) {
    data.forEach(d => {
      if (d.ts) {
        d.year = d.ts.slice(0, 4);
      }
      d.ms_played = +d.ms_played || 0;
    });
  
    const years = Array.from(
      new Set(
        data
          .filter(d => d.year && d.master_metadata_album_artist_name)
          .map(d => d.year)
      )
    ).sort((a, b) => +b - +a);
  
    const dropdown = d3.select("#yearSelect");
    dropdown
      .selectAll("option")
      .data(years)
      .enter()
      .append("option")
      .text(d => d)
      .attr("value", d => d);
  
    updateChart(years[0]);
  
    dropdown.property("value", years[0]);
  
    dropdown.on("change", function (event) {
        event.preventDefault(); 
        event.stopPropagation();     
        updateChart(this.value);
      
        const scrollY = window.scrollY;
        requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
      });
  
    function updateChart(selectedYear) {
      const filtered = data.filter(
        d => d.year === selectedYear && d.master_metadata_album_artist_name && d.master_metadata_track_name
      );

      buildSummary(selectedYear, filtered);
  
      // === Top Artists ===
      const artistMap = d3.rollup(
        filtered,
        v => d3.sum(v, d => d.ms_played),
        d => d.master_metadata_album_artist_name
      );
  
      const topArtists = Array.from(artistMap, ([artist, total]) => ({ artist, total }))
        .sort((a, b) => d3.descending(a.total, b.total))
        .slice(0, 5);
  
      const artistContainer = d3.select("#top-artists");
      artistContainer.selectAll("div").remove();
  
      topArtists.forEach((d, i) => {
        const artistName = d.artist || "Unknown";
  
        const card = artistContainer.append("div").attr("class", "artist-card");
  
        const track = filtered.find(x => x.master_metadata_album_artist_name === d.artist && x.spotify_track_uri);
  
        if (track && track.spotify_track_uri.includes("spotify:track:")) {
          const trackId = track.spotify_track_uri.split(":")[2];
          const oEmbedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
  
          fetch(oEmbedUrl)
            .then(res => res.json())
            .then(embedData => {
              card.html(`
                <div class="artist-content">
                  <img src="${embedData.thumbnail_url}" alt="${artistName}" class="artist-img" />
                  <div class="artists-content-text">
                    <p>${artistName}</p>
                  </div>
                </div>
              `);
            })
            .catch(() => {
              card.html(`<p>${artistName}</p>`);
            });
        } else {
          card.html(`<p>${artistName}</p>`);
        }
      });
  
      // === Top Songs ===
      const trackMap = d3.rollup(
        filtered,
        v => d3.sum(v, d => d.ms_played),
        d => d.master_metadata_track_name
      );
  
      const topTracks = Array.from(trackMap, ([track, total]) => ({ track, total }))
        .sort((a, b) => d3.descending(a.total, b.total))
        .slice(0, 5);
  
      const songContainer = d3.select("#top-songs");
      songContainer.selectAll("div").remove();
  
      topTracks.forEach((d, i) => {
        const trackName = d.track || "Unknown";
  
        const track = filtered.find(x => x.master_metadata_track_name === d.track && x.spotify_track_uri);
  
        const card = songContainer.append("div").attr("class", "song-card");
  
        if (track && track.spotify_track_uri.includes("spotify:track:")) {
          const trackId = track.spotify_track_uri.split(":")[2];
          const oEmbedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
  
          fetch(oEmbedUrl)
            .then(res => res.json())
            .then(embedData => {
              card.html(`
                <div class="song-content">
                  <img src="${embedData.thumbnail_url}" alt="${trackName}" class="artist-img" />
                  <div class="song-content-text">
                    <p>${trackName}</p>
                  </div>
                </div>
              `);
            })
            .catch(() => {
              card.html(`<p>${trackName}</p>`);
            });
        } else {
          card.html(`<p>${trackName}</p>`);
        }
      });
    }

    function buildSummary(selectedYear, filteredData) {
      const summary = d3.select("#listening-summary");
      summary.html(""); // clear old
    
      // 1. Total listening time
      const totalMs = d3.sum(filteredData, d => d.ms_played);
      const totalMinutes = Math.round(totalMs / 60000);
    
      // 2. Busiest day
      const byDay = d3.rollup(
        filteredData,
        v => d3.sum(v, d => d.ms_played),
        d => d.ts.split("T")[0]
      );
      const [busiestDay, busiestMs] = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1])[0];
      const busiestMinutes = Math.round(busiestMs / 60000);
    
      // 3. Most active time of day
      const timeOfDay = {
        Morning: 0, Afternoon: 0, Evening: 0, Night: 0
      };
      filteredData.forEach(d => {
        const hour = new Date(d.ts).getHours();
        if (hour >= 5 && hour < 12) timeOfDay.Morning += d.ms_played;
        else if (hour >= 12 && hour < 17) timeOfDay.Afternoon += d.ms_played;
        else if (hour >= 17 && hour < 22) timeOfDay.Evening += d.ms_played;
        else timeOfDay.Night += d.ms_played;
      });
      const mostListenedTime = Object.entries(timeOfDay).sort((a, b) => b[1] - a[1])[0][0];
    
      // 4. Longest streak
      const dates = Array.from(new Set(filteredData.map(d => d.ts.split("T")[0]))).sort();
      let longestStreak = 1;
      let currentStreak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          currentStreak++;
          if (currentStreak > longestStreak) longestStreak = currentStreak;
        } else {
          currentStreak = 1;
        }
      }
    
      // ✨ Inject summary HTML
      summary.html(`
        <p>🎧 You listened to <strong>${totalMinutes.toLocaleString()}</strong> minutes of music in <strong>${selectedYear}</strong>!</p>
        <p>📅 Your <strong>busiest listening day</strong> was <strong>${busiestDay}</strong> with <strong>${busiestMinutes}</strong> minutes.</p>
        <p>⏰ In ${selectedYear}, you listened most in the <strong>${mostListenedTime}</strong>.</p>
        <p>🔥 Your <strong>longest listening streak</strong> in ${selectedYear} was <strong>${longestStreak} days in a row</strong>!</p>
      `);
    }
    
  });
  