const key = process.env.GEMINI_API_KEY || 'AIzaSyCb6af-TsyRW5ohgan08IE3DfSxuYCJf4g';

async function run() {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
    const data = await res.json();
    if (data.models) {
      console.log("Available models:");
      data.models.forEach(m => console.log(m.name, "-", m.supportedGenerationMethods));
    } else {
      console.log("Error or no models:", data);
    }
  } catch(e) {
    console.error("Fetch failed:", e);
  }
}
run();
