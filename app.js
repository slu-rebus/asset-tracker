// app.js

const masterListURL = "https://raw.githubusercontent.com/<yourusername>/rebus-signage-tracker/main/masterList.csv";
const logListURL = "https://raw.githubusercontent.com/<yourusername>/rebus-signage-tracker/main/logList.csv";

// Elements
const startBtn = document.getElementById('startScan');
const popup = document.getElementById('popup');
const popupTitle = document.getElementById('popup-title');
const popupMsg = document.getElementById('popup-message');
const okBtn = document.getElementById('okButton');
const cancelBtn = document.getElementById('cancelButton');
const commentBox = document.getElementById('commentBox');

// Sounds
const firstBeep = document.getElementById('firstBeep');
const successBeep = document.getElementById('successBeep');
const errorBeep = document.getElementById('errorBeep');

let masterList = [];
let logList = [];

// Convert CSV → array of objects
function parseCSV(data) {
  const [header, ...rows] = data.trim().split("\n").map(r => r.split(","));
  return rows.map(row => Object.fromEntries(header.map((h, i) => [h.trim(), row[i]?.trim()])));
}

// Fetch the CSVs
async function loadData() {
  const [mRes, lRes] = await Promise.all([fetch(masterListURL), fetch(logListURL)]);
  masterList = parseCSV(await mRes.text());
  logList = parseCSV(await lRes.text());
  console.log("Data loaded", masterList.length, logList.length);
}

startBtn.addEventListener("click", async () => {
  await loadData();
  startScanning();
});

function startScanning() {
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector('#camera')
    },
    decoder: {
      readers: ["code_128_reader", "ean_reader", "ean_8_reader"]
    }
  }, (err) => {
    if (err) {
      console.error(err);
      return;
    }
    Quagga.start();
  });

  Quagga.onDetected(handleScan);
}

function handleScan(result) {
  const code = result.codeResult.code.trim();
  firstBeep.play();
  Quagga.stop();

  // Check master list
  const sign = masterList.find(s => s.SignNo === code);
  if (!sign) {
    errorBeep.play();
    alert(`❌ Sign ${code} not found in master list`);
    startScanning();
    return;
  }

  // Check if already scanned today
  const today = new Date().toISOString().slice(0,10);
  const scannedToday = logList.find(l => l.SignNo === code && l.TimeScanned.startsWith(today));

  popup.style.display = 'block';
  popupTitle.textContent = `Sign ${code}`;
  popupMsg.textContent = scannedToday
    ? "Already scanned today. Add a comment to update the log?"
    : "Mark as OKAY or add a comment.";

  okBtn.onclick = () => {
    popup.style.display = 'none';
    const comment = commentBox.value.trim();
    logEntry(code, comment);
    commentBox.value = "";
    startScanning();
  };

  cancelBtn.onclick = () => {
    popup.style.display = 'none';
    commentBox.value = "";
    startScanning();
  };
}

function logEntry(code, comment) {
  successBeep.play();
  const now = new Date().toISOString();
  console.log(`Logging: ${code}, Comment: ${comment}, Time: ${now}`);
  // TODO: Append to GitHub logList.csv (next step)
}
