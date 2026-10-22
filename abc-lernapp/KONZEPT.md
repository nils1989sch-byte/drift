# ABC mit Bruno – Konzept

Eine iPad-Web-App, mit der ein 3-jähriges Kind spielerisch die Buchstaben kennenlernt.
Begleiter ist **Bruno**, ein lila Bär. Der Stil ist angelehnt an die Referenz: Lavendel-Verlauf, weiche weiße Karten, runde Formen, freundliche Farben.

## 1. Ziele & Grundsätze

**Lernziel mit 3 Jahren (realistisch):** Buchstaben *wiedererkennen* und einem Laut und Wort zuordnen („M wie Maus“). Lesen und Schreiben sind noch kein Ziel.

| Grundsatz | Umsetzung in der App |
|---|---|
| Kind kann noch nicht lesen | Alles wird **vorgesprochen**. Icons statt Text, große Ziele (mind. 68 px). |
| Kein Frust | Es gibt **keine Fehler-Töne** und kein „Falsch“. Bruno sagt freundlich: „Das ist das B. Wo ist das M?“ |
| Kurze Einheiten | Eine Runde dauert 5 Sterne, also etwa 2–3 Minuten. Danach kommt eine Feier und eine natürliche Pause. |
| Persönlich | **Buchstaben aus dem eigenen Namen kommen zuerst** (das motiviert am stärksten). |
| Wenige, gute Buchstaben | Das Spiel nutzt immer nur 8 Buchstaben gleichzeitig, nicht alle 26. |
| Großbuchstaben zuerst | Großbuchstaben sind für Kleinkinder leichter. Kleinbuchstaben lassen sich im Elternbereich zuschalten. |
| Keine Werbung, keine Käufe, kein Internet nötig | Rein lokal, Daten bleiben auf dem iPad. |
| Bildschirmzeit | Die Eltern sehen den Verlauf. Später ist ein Timer möglich („Bruno geht jetzt schlafen“). |

## 2. Bereiche (im Prototyp umgesetzt)

1. **Start**: Begrüßung mit Namen, *Buchstabe des Tages*, Sterne von heute, Bruno zum Antippen.
2. **Entdecken (ABC)**: Raster mit allen Buchstaben. Ein Tipp öffnet eine große Karte mit Buchstabe, Bild, Wort und Sprache („A. A wie Affe“).
3. **Finden**: Bruno fragt „Wo ist das M?“, drei bunte Ballons zur Auswahl. 5 richtige Antworten ergeben eine Feier mit Konfetti.
4. **Nachmalen**: Den Buchstaben mit dem Finger auf der gepunkteten Vorlage nachfahren. Ab etwa 65 % Abdeckung gibt es einen Stern.
5. **Elternbereich**: Erreichbar über das Schloss oben rechts, das **2 Sekunden gedrückt** werden muss (Kindersicherung). Er zeigt die Woche, Sterne pro Tag und den Stand jedes Buchstabens. Einstellungen: Name, Schreibweise, Ton an/aus.

## 3. Ideen für später

- **Eigene Stimme aufnehmen**: Mama oder Papa sprechen die Buchstaben selbst ein. Kinder reagieren darauf viel stärker als auf eine Computerstimme.
- **Laut statt Buchstabenname**: „mmm“ statt „Em“, so wie es in Kita und Schule (Anlauttabelle) üblich ist.
- **Eigene Fotos**: „O wie Oma“ mit einem echten Foto von Oma.
- **Sticker-Album** als Belohnung: Für jeden sicheren Buchstaben gibt es ein Tier-Sticker.
- **Umlaute & Sonderlaute**: Ä, Ö, Ü, Sch, Ei.
- **Geräusche-Spiel**: Ein Tierlaut ertönt, das Kind wählt den passenden Anfangsbuchstaben.
- **Eigene Illustrationen** statt Emojis (z. B. mit einem Bildgenerator oder gezeichnet) für einen einheitlichen Look.

## 4. Technik

| Entscheidung | Begründung |
|---|---|
| **Web-App (HTML/CSS/JS, eine Datei)** | Keine Mac- oder Xcode-Pflicht, kein App-Store, sofort auf dem iPad testbar. |
| **Als Web-App zum Home-Bildschirm** | In Safari: *Teilen → Zum Home-Bildschirm*. Startet dann im Vollbild ohne Adressleiste. |
| **Sprachausgabe** über `speechSynthesis` (de-DE) | Auf dem iPad eingebaut. Später durch eigene Aufnahmen (MP3) ersetzbar. |
| **Speicher** über `localStorage` | Fortschritt bleibt lokal auf dem Gerät. |
| **Hosting** | GitHub Pages (kostenlos). Später Offline-Betrieb per Service Worker / PWA-Manifest. |
| **Kindersicherung** | Zusätzlich iPadOS **„Geführter Zugriff“** aktivieren (Einstellungen → Bedienungshilfen). So kann das Kind die App nicht verlassen. |

Später lässt sich daraus eine native App bauen (SwiftUI oder Capacitor), wenn sie im App Store erscheinen soll.

## 5. Fahrplan

| Phase | Inhalt | Dauer (Abende) |
|---|---|---|
| 0 – Prototyp ✅ | Klickbarer Entwurf mit allen 4 Bereichen | erledigt |
| 1 – Test mit der Tochter | 3–4 kurze Sessions beobachten (siehe unten) | 1 Woche |
| 2 – Feinschliff | Erkenntnisse einbauen, eigene Stimme, Fotos, Laute | 2–3 |
| 3 – Offline & Home-Bildschirm | PWA-Manifest, App-Icon, Service Worker, GitHub Pages | 1 |
| 4 – Mehr Spiele | Sticker-Album, Geräusche-Spiel, Umlaute | nach Bedarf |

## 6. Testen

**Technisch (wir):**
- Läuft im iPad-Safari im Hoch- und Querformat und als Home-Bildschirm-App.
- Sprachausgabe startet nach dem ersten Antippen (Safari erlaubt Ton erst nach einer Berührung).
- Das Nachmalen reagiert sauber auf Finger und Apple Pencil.
- Automatische Tests mit Playwright (Klickpfade, keine JavaScript-Fehler).

**Mit dem Kind (du) – nur beobachten, nicht helfen:**
- Findet sie ohne Erklärung den Weg zu den Spielen?
- Welche Bereiche wählt sie freiwillig, und wie lange bleibt sie?
- Wo tippt sie daneben (Ziele zu klein?), wo wird sie ungeduldig (Sprache zu langsam?)
- Trifft sie im „Finden“-Spiel häufiger als zufällig (also mehr als 1 von 3)?
- Erkennt sie nach 1–2 Wochen Buchstaben **außerhalb** der App (Bücher, Schilder)? Das ist der eigentliche Erfolg.

Notizen pro Session: Datum, Dauer, Lieblingsbereich, Auffälligkeiten.

## 7. Dateien

- `app.html`: Quelltext der App
- `index.html`: daraus gebaute, eigenständige Seite fürs iPad (`./build.sh`)
- `KONZEPT.md`: dieses Dokument
