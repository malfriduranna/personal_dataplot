const fetch = require("node-fetch");

const clientId = "2f076e6dca2b4f7282763d26d3956e22";
const clientSecret = "98a5e1831dd541e7b57abd2a00dc76fd";

async function getAccessToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(clientId + ":" + clientSecret).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  console.log("Access Token:", data.access_token);
}

getAccessToken();

