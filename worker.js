// ═══════════════════════════════════════════════════
//  Cloudflare Worker — Secret Answer Checker
//  Deploy this at: https://dash.cloudflare.com
//  This file NEVER gets sent to the browser.
// ═══════════════════════════════════════════════════

// ── ALL SECRETS LIVE HERE — only on the server ──
const STAGES = [
  {
    answer: "thailand",           // lowercase, trimmed
    clue:   "00110101 00110101",  // shown after correct answer
    hint:   "54 68 61 69 6C 61 6E 64 → ASCII text"  // shown after 300 clicks
  },
  {
    answer: "chatgpt",
    clue:   "00111000 00110100",
    hint:   "Q2hhdEdQVA== → base64 decode it"
  },
  {
    answer: "gifted computer",
    clue:   "01000110 01100010",
    hint:   "Binary → ASCII (each 8 bits = 1 character)"
  },
  {
    answer: "computer",
    clue:   "01101001 01011011",
    hint:   "FRPSXWHU → Caesar cipher, shift -3"
  }
];

// ── CORS helper (allows your GitHub Pages domain) ──
function cors(req) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}

export default {
  async fetch(req) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(req) });
    }

    const url = new URL(req.url);

    // ── POST /check  { stage, answer } ──
    if (url.pathname === "/check" && req.method === "POST") {
      let body;
      try { body = await req.json(); } catch { return err(req, "bad json"); }

      const { stage, answer } = body;
      if (stage == null || !answer) return err(req, "missing fields");
      if (stage < 0 || stage >= STAGES.length) return err(req, "invalid stage");

      const correct = answer.trim().toLowerCase() === STAGES[stage].answer;
      const payload = correct
        ? { correct: true,  clue: STAGES[stage].clue }
        : { correct: false };

      return new Response(JSON.stringify(payload), { headers: cors(req) });
    }

    // ── POST /hint  { stage } ──
    if (url.pathname === "/hint" && req.method === "POST") {
      let body;
      try { body = await req.json(); } catch { return err(req, "bad json"); }

      const { stage } = body;
      if (stage == null || stage < 0 || stage >= STAGES.length) return err(req, "invalid stage");

      return new Response(
        JSON.stringify({ hint: STAGES[stage].hint }),
        { headers: cors(req) }
      );
    }

    return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors(req) });
  }
};

function err(req, msg) {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: cors(req) });
}
