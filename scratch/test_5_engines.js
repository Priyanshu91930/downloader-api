async function testEngines() {
  const url = "https://www.instagram.com/reel/DeRnRpJsGNm/";
  console.log("Testing 5 Engine Fallback for:", url);

  // Engine 1: Botcahx
  try {
    const res = await fetch(`https://api.botcahx.biz/api/dowloader/ig?url=${encodeURIComponent(url)}&apikey=btch`);
    console.log("Engine 1 Botcahx Status:", res.status);
    if (res.ok) {
      const json = await res.json();
      console.log("Engine 1 Result:", json.status ? "SUCCESS" : "FAIL");
    }
  } catch (e) {
    console.log("Engine 1 Error:", e.message);
  }

  // Engine 2: Vercel Origin
  try {
    const res = await fetch(`https://downloader-api-tau.vercel.app/api/download/instagram?url=${encodeURIComponent(url)}`);
    console.log("Engine 2 Vercel Status:", res.status);
    if (res.ok) {
      const json = await res.json();
      console.log("Engine 2 Result:", json.success ? "SUCCESS" : "FAIL");
    }
  } catch (e) {
    console.log("Engine 2 Error:", e.message);
  }

  // Engine 3: SnapInst / SaveIG
  try {
    const res = await fetch("https://saveig.app/api/ajaxSearch", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: `q=${encodeURIComponent(url)}&t=media&lang=en`,
    });
    console.log("Engine 3 SaveIG Status:", res.status);
    if (res.ok) {
      const json = await res.json();
      console.log("Engine 3 Result:", json.status ? "SUCCESS" : "FAIL");
    }
  } catch (e) {
    console.log("Engine 3 Error:", e.message);
  }
}

testEngines();
