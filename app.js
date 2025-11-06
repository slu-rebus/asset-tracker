// app.js

const masterListURL = "https://raw.githubusercontent.com/slu-rebus/asset-tracker/main/masterList.csv";
const logListAPI = "https://api.github.com/repos/slu-rebus/asset-tracker/contents/logList.csv";

// --- Elements ---
const startBtn = document.getElementById('startScan');
const popup = document.getElementById('popup');
const popupTitle = document.getElementById('popup-title');
const popupMsg = document.getElementById('popup-message');
const okBtn = document.getElementById('okButton');
const cancelBtn = document.getElementById('cancelButton');
const commentBox = document.getElementById('commentBox');

// --- Sounds ---
const firstBeep = document.getElementById('firstBeep');
const successBeep = document.getElementById('successBeep');
const errorBeep = document.getElementById('errorBeep');

let masterList = [];
let logList = [];
let githubToken = "";

// Parse CSV → array of objects
function parseCSV(data) {
  const [header, ...rows] = data.trim().split("\n").map(r => r.split(","));
  return rows.map(row => Object.fromEntries(header.map((h, i) => [h.trim(), row[i]?.trim()])));
}

// Convert objects → CSV
function toCSV(data) {
  const header = Object.keys(data[0]).join(",");
  const rows = data.map(obj => Object.values(obj).map(v => `"${v || ""}"`).join(","));
  return `${header}\n${rows.join("\n")}`;
}

async function loadData() {
  const [mRes, lRes] = await Promise.all([
    fetch(masterListURL),
    fetch(`https://raw.githubusercontent.com/<yourusername>/<yourrepo>/main/logList.csv`)
  ]);
  masterList = parseCSV(await mRes.text());
  logList = parseCSV(await lRes.text());
  console.log("Loaded data:", masterList.length, "signs");
}

startBtn.addEventListener("click", async () => {
  githubToken = prompt("Enter GitHub Access Token:"); // temporary for local use
  await loadData();
  startScanning();
});

function startScanning() {
  const constraints = {
    audio: false,
    video: { facingMode: "environment" }
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      const video = document.querySelector('#camera');
      video.srcObject = stream;
      video.setAttribute("playsinline", true); // iOS Safari fix
      video.play();

      // Initialize Quagga after camera starts
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.querySelector('#camera'),
          constraints: {
            facingMode: "environment"
          }
        },
        decoder: {
          readers: ["code_128_reader", "ean_reader", "ean_8_reader"]
        },
        locate: true
      }, (err) => {
        if (err) {
          console.error("Quagga init error:", err);
          alert("Error initializing camera. Please check browser permissions.");
          return;
        }
        console.log("Scanner started.");
        Quagga.start();
      });

      Quagga.onDetected(result => {
        const code = result.codeResult.code.trim();
        console.log("Detected:", code);
        firstBeep.play();
        Quagga.stop();
        handleScan(result);
      });
    })
    .catch(err => {
      console.error("Camera access denied:", err);
      alert("⚠️ Please allow camera access to use the scanner.");
    });
}

function handleScan(result) {
  const code = result.codeResult.code.trim();
  firstBeep.play();

  popup.style.display = 'block';
  popupTitle.textContent = `Scanned Code: ${code}`;
  popupMsg.textContent = "This is a test popup.";
  
  okBtn.onclick = () => {
    popup.style.display = 'none';
    successBeep.play();
    alert(`✅ You scanned: ${code}`);
    startScanning();
  };

  cancelBtn.onclick = () => {
    popup.style.display = 'none';
    errorBeep.play();
    startScanning();
  };
}

async function logEntry(code, comment) {
  const now = new Date().toISOString();
  const newEntry = {
    SignNo: code,
    Status: "OKAY",
    Comments: comment,
    TimeScanned: now
  };

  logList.push(newEntry);
  const updatedCSV = toCSV(logList);

  // Get the file's current SHA (required for GitHub PUT)
  const res = await fetch(logListAPI);
  const json = await res.json();

  const updateRes = await fetch(logListAPI, {
    method: "PUT",
    headers: {
      "Authorization": `token ${githubToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `Log update for ${code} at ${now}`,
      content: btoa(unescape(encodeURIComponent(updatedCSV))),
      sha: json.sha
    })
  });

  if (updateRes.ok) {
    successBeep.play();
    alert(`✅ Logged ${code} successfully!`);
  } else {
    errorBeep.play();
    alert("❌ Error writing to GitHub log file.");
  }
}
