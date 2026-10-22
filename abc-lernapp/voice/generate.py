#!/usr/bin/env python3
"""Erzeugt Brunos Stimme mit Gemini-TTS (Google AI Studio API).

Aufruf:
  GEMINI_API_KEY=... python3 generate.py --samples            # Stimmproben zum Auswählen
  GEMINI_API_KEY=... python3 generate.py --voice Puck         # alle Clips
  GEMINI_API_KEY=... python3 generate.py --voice Puck --name Mia --only hello-name

Bereits vorhandene Clips werden übersprungen (--force erzwingt Neu-Erzeugung).
Ausgabe: <key>.mp3 + manifest.json in diesem Ordner.
"""
import argparse, base64, json, os, ssl, subprocess, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
API = "https://generativelanguage.googleapis.com/v1beta/models"
STYLE = ("Du bist Bruno, ein lieber, warmherziger Teddybär, und sprichst mit einem dreijährigen Kind. "
         "Sprich langsam, deutlich und fröhlich, mit einem Lächeln in der Stimme, wie ein Kinderbuch-Erzähler. "
         "Betone den Buchstaben klar. Sage genau diesen Text und nichts anderes:\n")
SAMPLE_VOICES = ["Puck", "Achird", "Sulafat", "Leda", "Aoede", "Umbriel", "Zubenelgenubi", "Kore"]

WORDS = json.load(open(os.path.join(HERE, "..", "design", "words.json"), encoding="utf-8"))


def clips(name):
    c = {}
    for w in WORDS:
        L, word = w["letter"].upper(), w["word"]
        c[f"name-{L}"] = f"{L}. … {L} wie {word}!"
        c[f"ask-{L}"] = f"Wo ist das {L}?"
        c[f"is-{L}"] = f"Das ist das {L}."
        c[f"trace-{L}"] = f"Mal das {L}."
    c.update({
        "praise-1": "Super!", "praise-2": "Juhu, richtig!", "praise-3": "Toll gemacht!",
        "praise-4": "Klasse!", "praise-5": "Ja, genau!",
        "try-1": "Hmm, probier's nochmal!", "try-2": "Fast! Schau noch mal genau.", "try-3": "Nicht schlimm. Noch ein Versuch!",
        "traced": "Toll gemalt!", "party": "Super gemacht! Fünf Sterne!",
        "hello": "Hallo! Ich bin Bruno.", "play-q": "Magst du Ballons fangen?",
        "tickle": "Hihi, das kitzelt!", "today": "Heute üben wir das …",
    })
    if name:
        c["hello-name"] = f"Hallo {name}! Spielst du mit mir?"
    return c


def ssl_ctx():
    ca = "/root/.ccr/ca-bundle.crt"
    return ssl.create_default_context(cafile=ca) if os.path.exists(ca) else ssl.create_default_context()


def call(path, key, body=None):
    req = urllib.request.Request(f"{API}{path}", data=json.dumps(body).encode() if body else None,
                                 headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, context=ssl_ctx(), timeout=120) as r:
        return json.load(r)


def pick_model(key):
    if os.environ.get("GEMINI_TTS_MODEL"):
        return os.environ["GEMINI_TTS_MODEL"]
    models = [m["name"].split("/")[-1] for m in call("", key).get("models", []) if "tts" in m["name"]]
    if not models:
        sys.exit("Kein TTS-Modell gefunden. Setze GEMINI_TTS_MODEL.")
    models.sort(key=lambda m: ("pro" in m, "preview" in m))  # flash zuerst, stabile vor preview
    return models[0]


def tts(key, model, voice, text):
    body = {"contents": [{"parts": [{"text": STYLE + text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    for attempt in range(6):
        try:
            r = call(f"/{model}:generateContent", key, body)
            return base64.b64decode(r["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 5:
                wait = 2 ** attempt * 5
                print(f"  {e.code}, warte {wait}s …"); time.sleep(wait); continue
            raise SystemExit(f"API-Fehler {e.code}: {e.read().decode()[:400]}")


def to_mp3(pcm, out):
    # 24 kHz 16-bit mono PCM -> Stille vorn/hinten kürzen, leicht normalisieren, MP3 mono
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "pipe:0",
                    "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                           "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                           "apad=pad_dur=0.08,loudnorm=I=-18:TP=-2",
                    "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "48k", out], input=pcm, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="Puck")
    ap.add_argument("--name", default="")
    ap.add_argument("--samples", action="store_true")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    key = os.environ.get("GEMINI_API_KEY") or sys.exit("GEMINI_API_KEY fehlt.")
    model = pick_model(key)
    print("Modell:", model)

    if a.samples:
        os.makedirs(os.path.join(HERE, "samples"), exist_ok=True)
        for v in SAMPLE_VOICES:
            out = os.path.join(HERE, "samples", f"{v}.mp3")
            print("Probe", v); to_mp3(tts(key, model, v, "Hallo! Ich bin Bruno. … M wie Maus! Wo ist das M? Juhu, richtig!"), out)
        return

    all_clips = clips(a.name)
    todo = {k: t for k, t in all_clips.items() if not a.only or k in a.only}
    for i, (k, text) in enumerate(todo.items(), 1):
        out = os.path.join(HERE, f"{k}.mp3")
        if os.path.exists(out) and not a.force:
            continue
        print(f"[{i}/{len(todo)}] {k}: {text}")
        to_mp3(tts(key, model, a.voice, text), out)

    manifest = {"voice": a.voice, "model": model,
                "clips": {k: f"voice/{k}.mp3" for k in all_clips if os.path.exists(os.path.join(HERE, f"{k}.mp3"))}}
    json.dump(manifest, open(os.path.join(HERE, "manifest.json"), "w"), ensure_ascii=False, indent=1)
    print(f"Fertig: {len(manifest['clips'])} Clips in manifest.json")


if __name__ == "__main__":
    main()
