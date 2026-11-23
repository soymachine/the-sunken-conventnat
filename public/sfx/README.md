# Sounds

`bank.json` maps each sound name (see `src/audio/bank.ts`) to a file in this folder, with the part of it that is
played (`start`/`end`, seconds), its `gain`, its fades and whether it loops. A name missing from the bank is silent
(a few combat and interface sounds fall back to a synthesised stand-in; music never does).

The sound desk (`/admin.html`) edits this in the browser. To publish what was set there: "Descargar paquete"
downloads a .zip with the new files and the whole `bank.json`; unzip it over this folder:

    unzip -o sonidos-YYYY-MM-DD.zip -d public/sfx
