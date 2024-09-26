import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

let gestureRecognizer;
let webcamStream = null;
let runningMode = "IMAGE";
let webcamRunning = false;
let recognitionRunning = false;

const loadingOverlay = document.getElementById("loading");
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureOutput = document.getElementById("gesture_output");

const createGestureRecognizer = async () => {
  loadingOverlay.style.display = "flex";
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
      delegate: "GPU"
    },
    runningMode: runningMode
  });
  loadingOverlay.style.display = "none";
  enableWebcamButton();
};

createGestureRecognizer();

function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

if (hasGetUserMedia()) {
  const webcamToggle = document.getElementById("webcamToggle");
  const recognitionToggle = document.getElementById("recognitionToggle");

  webcamToggle.addEventListener("change", toggleWebcam);
  recognitionToggle.addEventListener("change", toggleRecognition);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

function enableWebcamButton() {
  const webcamToggle = document.getElementById("webcamToggle");
  webcamToggle.disabled = false;
}

function la(){
  navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
    webcamStream = stream;
    video.srcObject = stream;
    video.addEventListener("loadeddata", () => {
      webcamRunning = true;
      recognitionToggle.disabled = false;
      resizeCanvasToMatchVideo();
    });
  });
}

function toggleWebcam() {
  const webcamToggle = document.getElementById("webcamToggle");
  const recognitionToggle = document.getElementById("recognitionToggle");

  if (webcamToggle.checked && !webcamRunning) {
    navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
      webcamStream = stream;
      video.srcObject = stream;
      video.addEventListener("loadeddata", () => {
        webcamRunning = true;
        recognitionToggle.disabled = false;
        resizeCanvasToMatchVideo();
      });
    });
  } else {
    if (webcamStream) {
      webcamRunning = false;
      recognitionToggle.disabled = true;
      recognitionToggle.checked = false;
      recognitionRunning = false;
      // await predictWebcam();
      let tracks = webcamStream.getTracks();
      tracks.forEach(track => track.stop());
      video.srcObject = null;
    }
  }
}

function resizeCanvasToMatchVideo() {
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;
}

async function toggleRecognition() {
  if (!webcamRunning) {
    alert("Webcam is not enabled.");
    return;
  }

  if (!gestureRecognizer) {
    alert("Gesture recognizer not loaded yet. Please wait.");
    return;
  }
  recognitionRunning = !recognitionRunning;
  console.log(recognitionRunning);
  if (recognitionRunning) {
    predictWebcam();
  }
}

let lastVideoTime = -1;
let results = undefined;

async function predictWebcam() {
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
  }

  let nowInMs = Date.now();
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    if (video.srcObject == null) {
      return;
    }
    else {
      results = gestureRecognizer.recognizeForVideo(video, nowInMs);
    }
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  const drawingUtils = new DrawingUtils(canvasCtx);

  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
      drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
    }
  }

  canvasCtx.restore();

  if (results.gestures.length > 0) {
    gestureOutput.style.display = "block";
    const categoryName = results.gestures[0][0].categoryName;
    const categoryScore = parseFloat(results.gestures[0][0].score * 100).toFixed(2);
    const handedness = results.handednesses[0][0].displayName;
    gestureOutput.innerText = `Gesture: ${categoryName}\nConfidence: ${categoryScore}%\nHandedness: ${handedness}`;
  } else {
    gestureOutput.style.display = "none";
  }

  if (webcamRunning && recognitionRunning) {
    window.requestAnimationFrame(predictWebcam);
  } else {
    gestureOutput.style.display = "none";
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  }
}