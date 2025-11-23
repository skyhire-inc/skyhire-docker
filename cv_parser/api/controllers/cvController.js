const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join('/app', 'output');
const PY_SERVICE_URL = process.env.PY_SERVICE_URL || 'http://cv-python:8000';

// helper: wait for a file to exist with retries
async function waitForFile(filePath, attempts = 10, delayMs = 300) {
  for (let i = 0; i < attempts; i++) {
    if (fs.existsSync(filePath)) return true;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return fs.existsSync(filePath);
}

// POST /api/cv/analyze
async function analyzeCV(req, res) {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ ok: false, error: 'Aucun fichier uploadé' });
    }

    const inputPath = req.file.path; // ex: /app/input/filename.pdf

    const resp = await fetch(`${PY_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_path: inputPath, output_dir: OUTPUT_DIR, quiet: true })
    });

    const data = await resp.json();
    if (!data.ok) {
      return res.status(500).json({ ok: false, error: 'Analyse échouée côté service Python', details: data });
    }

    const outputFile = data.output_file || null;
    let content = null;

    if (outputFile) {
      const ok = await waitForFile(outputFile, 15, 300);
      if (ok) {
        try {
          const txt = await fsp.readFile(outputFile, 'utf-8');
          content = JSON.parse(txt);
        } catch (_) {}
      }
    }

    return res.json({ ok: true, output_file: outputFile, result: content });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /api/cv/list
function listAnalyzedCVs(req, res) {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.toLowerCase().endsWith('_analyzed.json'))
      .map(f => {
        const full = path.join(OUTPUT_DIR, f);
        const stat = fs.statSync(full);
        return {
          filename: f,
          size: stat.size,
          mtime: stat.mtimeMs
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json(files);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /api/cv/:filename
function getAnalyzedCV(req, res) {
  try {
    const rawName = req.params.filename || '';
    // sécurité basique contre l'évasion de chemin
    const safeName = path.basename(rawName);
    const fullPath = path.join(OUTPUT_DIR, safeName);
    if (!fullPath.startsWith(OUTPUT_DIR)) {
      return res.status(400).json({ ok: false, error: 'Nom de fichier invalide' });
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ ok: false, error: 'Fichier non trouvé' });
    }
    const data = fs.readFileSync(fullPath, 'utf-8');
    res.type('application/json').send(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// DELETE /api/cv/:filename
function deleteAnalyzedCV(req, res) {
  try {
    const rawName = req.params.filename || '';
    // sécurité basique contre l'évasion de chemin
    const safeName = path.basename(rawName);
    const fullPath = path.join(OUTPUT_DIR, safeName);
    
    if (!fullPath.startsWith(OUTPUT_DIR)) {
      return res.status(400).json({ ok: false, error: 'Nom de fichier invalide' });
    }
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ ok: false, error: 'Fichier non trouvé' });
    }
    
    // Supprimer le fichier
    fs.unlinkSync(fullPath);
    console.log(`🗑️  Deleted CV analysis: ${safeName}`);
    
    res.json({ ok: true, message: 'Fichier supprimé avec succès' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  analyzeCV,
  listAnalyzedCVs,
  getAnalyzedCV,
  deleteAnalyzedCV
};
