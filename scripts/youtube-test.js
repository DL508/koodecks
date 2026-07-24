// Verify the resilient fetcher's LOGIC with controlled mocks (real YouTube is not
// reachable from this sandbox — host_not_allowed — so we test the decision paths).
const path = require("path").join(__dirname, "..", "lib", "youtube.js");
let pass=0, fail=0;
const t=(n,c)=>{if(c){pass++;console.log("  OK  "+n);}else{fail++;console.log("  XX  "+n);}};

const realFetch = global.fetch;
function withMock(mock, fn){ global.fetch = mock; return fn().finally(()=>{ global.fetch = realFetch; }); }
// Force the library strategy to always fail so we exercise InnerTube deterministically.
const Mod = require("module");
const origLoad = Mod._load;
Mod._load = function(req, ...a){
  if(req === "youtube-transcript") return { YoutubeTranscript: { fetchTranscript: async()=>{ throw new Error("lib down"); } } };
  return origLoad.call(this, req, ...a);
};
delete require.cache[require.resolve(path)];
const yt = require(path);

const json3 = JSON.stringify({ events: [ {segs:[{utf8:"Volcanoes "}]}, {segs:[{utf8:"erupt "},{utf8:"when magma rises."}]} ] });
const playerWithTracks = JSON.stringify({ playabilityStatus:{status:"OK"}, captions:{ playerCaptionsTracklistRenderer:{ captionTracks:[ {baseUrl:"https://www.youtube.com/api/timedtext?v=x", languageCode:"en", kind:""} ] } } });
const playerNoTracks = JSON.stringify({ playabilityStatus:{status:"OK"}, captions:{ playerCaptionsTracklistRenderer:{ captionTracks:[] } } });
const playerLoginReq = JSON.stringify({ playabilityStatus:{status:"LOGIN_REQUIRED"} });

(async()=>{
  // Case 1: InnerTube returns tracks + json3 transcript → success
  await withMock(async(url)=>{
    if(String(url).includes("youtubei/v1/player")) return new Response(playerWithTracks,{status:200,headers:{"content-type":"application/json"}});
    if(String(url).includes("timedtext")) return new Response(json3,{status:200});
    return new Response("no",{status:404});
  }, async()=>{
    const txt = await yt.fetchTranscript("vid00000001","en");
    t("success path returns cleaned transcript", /Volcanoes erupt when magma rises/.test(txt));
  });

  // Case 2: player says zero caption tracks → NO_CAPTIONS (genuine)
  await withMock(async(url)=>{
    if(String(url).includes("youtubei/v1/player")) return new Response(playerNoTracks,{status:200,headers:{"content-type":"application/json"}});
    return new Response("no",{status:404});
  }, async()=>{
    let code=null; try{ await yt.fetchTranscript("vid00000002","en"); }catch(e){ code=e.message; }
    t("empty caption-track list → NO_CAPTIONS", code==="NO_CAPTIONS");
  });

  // Case 3: player HTTP 403/blocked → TRANSCRIPT_FETCH_FAILED (NOT no-captions)
  await withMock(async(url)=>{
    if(String(url).includes("youtubei/v1/player")) return new Response("denied",{status:403});
    return new Response("no",{status:404});
  }, async()=>{
    let code=null,detail=null; try{ await yt.fetchTranscript("vid00000003","en"); }catch(e){ code=e.message; detail=e.detail; }
    t("player 403 → TRANSCRIPT_FETCH_FAILED (not NO_CAPTIONS)", code==="TRANSCRIPT_FETCH_FAILED");
  });

  // Case 4: player LOGIN_REQUIRED → fetch failed, not no-captions
  await withMock(async(url)=>{
    if(String(url).includes("youtubei/v1/player")) return new Response(playerLoginReq,{status:200,headers:{"content-type":"application/json"}});
    return new Response("no",{status:404});
  }, async()=>{
    let code=null; try{ await yt.fetchTranscript("vid00000004","en"); }catch(e){ code=e.message; }
    t("LOGIN_REQUIRED → TRANSCRIPT_FETCH_FAILED (not NO_CAPTIONS)", code==="TRANSCRIPT_FETCH_FAILED");
  });

  // Case 5: tracks present but timedtext returns XML (not json3) → still parses
  const xml = '<?xml version="1.0"?><transcript><text start="0">Water cycles</text><text start="2">through evaporation</text></transcript>';
  await withMock(async(url)=>{
    if(String(url).includes("youtubei/v1/player")) return new Response(playerWithTracks,{status:200,headers:{"content-type":"application/json"}});
    if(String(url).includes("timedtext")) return new Response(xml,{status:200});
    return new Response("no",{status:404});
  }, async()=>{
    const txt = await yt.fetchTranscript("vid00000005","en");
    t("XML timedtext fallback parses", /Water cycles through evaporation/.test(txt));
  });

  // Case 6: language selection prefers Spanish track when lang=es
  const playerBoth = JSON.stringify({ playabilityStatus:{status:"OK"}, captions:{ playerCaptionsTracklistRenderer:{ captionTracks:[
    {baseUrl:"https://www.youtube.com/api/timedtext?l=en", languageCode:"en"},
    {baseUrl:"https://www.youtube.com/api/timedtext?l=es", languageCode:"es"} ] } } });
  await withMock(async(url)=>{
    if(String(url).includes("youtubei/v1/player")) return new Response(playerBoth,{status:200,headers:{"content-type":"application/json"}});
    if(String(url).includes("l=es")) return new Response(JSON.stringify({events:[{segs:[{utf8:"Los volcanes"}]}]}),{status:200});
    if(String(url).includes("timedtext")) return new Response(JSON.stringify({events:[{segs:[{utf8:"English"}]}]}),{status:200});
    return new Response("no",{status:404});
  }, async()=>{
    const txt = await yt.fetchTranscript("vid00000006","es");
    t("lang=es picks the Spanish caption track", /Los volcanes/.test(txt));
  });

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})();
