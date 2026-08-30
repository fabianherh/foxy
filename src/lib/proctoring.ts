export type ProctoringRecording = { type: "camera" | "screen"; blob: Blob; durationMs: number };

export interface ProctoringSession {
  cameraStream: MediaStream;
  screenStream: MediaStream;
  stop: () => Promise<ProctoringRecording[]>;
}

function supportedMimeType(): string {
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function createRecorder(stream: MediaStream, type: "camera" | "screen", bitsPerSecond: number) {
  const mimeType = supportedMimeType();
  const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: bitsPerSecond });
  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  const result = new Promise<ProctoringRecording>((resolve) => {
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => resolve({ type, blob: new Blob(chunks, { type: recorder.mimeType || "video/webm" }), durationMs: Date.now() - startedAt });
  });
  recorder.start(2000);
  return { recorder, result };
}

export async function startProctoring(): Promise<ProctoringSession> {
  if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") throw new Error("Camera and screen recording are not supported in this browser.");
  const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 12, max: 15 } }, audio: false });
  let screenStream: MediaStream;
  try { screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 8, max: 10 } }, audio: false }); }
  catch (error) { cameraStream.getTracks().forEach((track) => track.stop()); throw error; }
  const camera = createRecorder(cameraStream, "camera", 250_000);
  const screen = createRecorder(screenStream, "screen", 450_000);
  screenStream.getVideoTracks()[0]?.addEventListener("ended", () => { if (screen.recorder.state === "recording") screen.recorder.stop(); }, { once: true });
  return {
    cameraStream,
    screenStream,
    async stop() {
      if (camera.recorder.state === "recording") camera.recorder.stop();
      if (screen.recorder.state === "recording") screen.recorder.stop();
      cameraStream.getTracks().forEach((track) => track.stop());
      screenStream.getTracks().forEach((track) => track.stop());
      return await Promise.all([camera.result, screen.result]);
    },
  };
}
