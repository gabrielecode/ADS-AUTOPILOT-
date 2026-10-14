import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

async function callGemini(prompt: string, schema: any) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    }
  });
  return JSON.parse(response.text || '{}');
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxRequests = 20;

  let record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(ip, record);
  } else {
    record.count++;
  }

  if (record.count > maxRequests) {
    return res.status(429).json({ error: 'Troppe richieste. Riprova tra qualche minuto.' });
  }
  next();
}

function isPrivateIPOrLocalhost(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return true;
    }
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const parts = match.slice(1, 5).map(Number);
      if (
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        parts[0] === 127 ||
        (parts[0] === 169 && parts[1] === 254) ||
        parts[0] === 0
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(rateLimiter);

  const analysisSchema = {
    type: Type.OBJECT,
    properties: {
      proposta_di_valore: { type: Type.STRING },
      pubblico_target: { type: Type.STRING },
      punti_di_forza: { type: Type.ARRAY, items: { type: Type.STRING } },
      problemi_di_conversione: { type: Type.ARRAY, items: { type: Type.STRING } },
      cta_presente_o_mancante: { type: Type.STRING },
      punteggio_prontezza_ads: { type: Type.NUMBER },
      motivazione: { type: Type.STRING },
      miglioramenti_consigliati: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: [
      'proposta_di_valore',
      'pubblico_target',
      'punti_di_forza',
      'problemi_di_conversione',
      'cta_presente_o_mancante',
      'punteggio_prontezza_ads',
      'motivazione',
      'miglioramenti_consigliati'
    ]
  };

  const briefSchema = {
    type: Type.OBJECT,
    properties: {
      pubblico: {
        type: Type.OBJECT,
        properties: {
          eta: { type: Type.STRING },
          genere: { type: Type.STRING },
          interessi: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['eta', 'genere', 'interessi']
      },
      localita: { type: Type.STRING },
      keyword_alta_intenzione: { type: Type.ARRAY, items: { type: Type.STRING } },
      keyword_esplorative: { type: Type.ARRAY, items: { type: Type.STRING } },
      keyword_negative: { type: Type.ARRAY, items: { type: Type.STRING } },
      angoli_comunicazione: { type: Type.ARRAY, items: { type: Type.STRING } },
      ripartizione_budget: { type: Type.STRING }
    },
    required: [
      'pubblico',
      'localita',
      'keyword_alta_intenzione',
      'keyword_esplorative',
      'keyword_negative',
      'angoli_comunicazione',
      'ripartizione_budget'
    ]
  };

  const adsSchema = {
    type: Type.OBJECT,
    properties: {
      google_ads: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            titoli: { type: Type.ARRAY, items: { type: Type.STRING } },
            descrizioni: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['titoli', 'descrizioni']
        }
      },
      meta_ads: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            testo_principale: { type: Type.STRING },
            titolo: { type: Type.STRING },
            descrizione: { type: Type.STRING },
            idea_immagine: { type: Type.STRING }
          },
          required: ['testo_principale', 'titolo', 'descrizione', 'idea_immagine']
        }
      }
    },
    required: ['google_ads', 'meta_ads']
  };

  const planSchema = {
    type: Type.OBJECT,
    properties: {
      checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
      controllo_post_lancio: {
        type: Type.OBJECT,
        properties: {
          '3_giorni': { type: Type.STRING },
          '7_giorni': { type: Type.STRING },
          '14_giorni': { type: Type.STRING }
        },
        required: ['3_giorni', '7_giorni', '14_giorni']
      }
    },
    required: ['checklist', 'controllo_post_lancio']
  };

  app.post('/api/analyze', async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL mancante o non valido' });
    }
    if (isPrivateIPOrLocalhost(url)) {
      return res.status(422).json({ error: 'URL non consentito o bloccato (localhost/IP privati non ammessi)' });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const fetchRes = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AdsAutopilotBot' }
      });
      clearTimeout(timeoutId);

      if (!fetchRes.ok) {
        return res.status(422).json({ error: `Impossibile raggiungere l'URL (HTTP status ${fetchRes.status})` });
      }

      const buffer = await fetchRes.arrayBuffer();
      if (buffer.byteLength > 1024 * 1024) {
        return res.status(422).json({ error: 'La pagina supera la dimensione massima consentita (1MB)' });
      }

      const decoder = new TextDecoder('utf-8');
      const htmlContent = decoder.decode(buffer);

      const $ = cheerio.load(htmlContent);
      $('script, style, noscript, iframe, svg').remove();

      const title = $('title').text().trim();
      const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
      const h1s = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean);
      const h2s = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean);
      const h3s = $('h3').map((_, el) => $(el).text().trim()).get().filter(Boolean);
      const buttonsAndCtas = $('button, a.btn, .cta, [role="button"], input[type="submit"]').map((_, el) => $(el).text().trim()).get().filter(Boolean);
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 15000);

      const scrapedSummary = `
URL: ${url}
Title: ${title}
Meta Description: ${metaDescription}
H1: ${h1s.join(' | ')}
H2: ${h2s.join(' | ')}
H3: ${h3s.join(' | ')}
Buttons/CTAs: ${buttonsAndCtas.join(' | ')}
Visible Text: ${bodyText}
      `.trim();

      const prompt = `Analizza questa landing page estratta:
${scrapedSummary}

Fornisci un JSON con: proposta_di_valore, pubblico_target, punti_di_forza (array di stringhe), problemi_di_conversione (array di stringhe), cta_presente_o_mancante, punteggio_prontezza_ads (numero da 1 a 10), motivazione, miglioramenti_consigliati (array di stringhe).`;

      const data = await callGemini(prompt, analysisSchema);
      res.json(data);
    } catch (e: any) {
      console.error(e);
      res.status(422).json({ error: `Errore durante l'analisi della landing: ${e.message || 'Timeout o errore di rete'}` });
    }
  });

  app.post('/api/generate-brief', async (req, res) => {
    const { formData, analysis } = req.body;
    if (!formData || !analysis || !formData.productName) {
      return res.status(400).json({ error: 'Dati incompleti per la generazione del brief' });
    }
    try {
      const prompt = `Crea un brief di campagna ads per ${formData.productName}, obiettivo ${formData.objective}, budget ${formData.budget} CHF al giorno, in ${formData.country} (${formData.language}). 
Analisi landing: ${JSON.stringify(analysis)}. 
Fornisci un JSON con: pubblico (oggetto con eta, genere, interessi), localita, keyword_alta_intenzione (array di stringhe), keyword_esplorative (array di stringhe), keyword_negative (array di stringhe), angoli_comunicazione (array di stringhe), ripartizione_budget (stringa specificando i CHF al giorno).`;

      const data = await callGemini(prompt, briefSchema);
      res.json(data);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Errore durante la generazione del brief' });
    }
  });

  app.post('/api/generate-ads', async (req, res) => {
    const { brief, channels } = req.body;
    if (!brief || !channels) {
      return res.status(400).json({ error: 'Brief o canali mancanti' });
    }
    try {
      const prompt = `Genera gli annunci per questa campagna: ${JSON.stringify(brief)}. 
Canali richiesti: ${JSON.stringify(channels)}.
Fornisci un JSON con: 
google_ads (array di oggetti con titoli max 30 caratteri e descrizioni max 90 caratteri), 
meta_ads (array di oggetti con testo_principale, titolo, descrizione, idea_immagine).`;

      const data = await callGemini(prompt, adsSchema);

      if (data.google_ads && Array.isArray(data.google_ads)) {
        data.google_ads = data.google_ads.map((ad: any) => {
          let titoli = (ad.titoli || []).map((t: string) => t.trim()).filter((t: string) => t.length > 0 && t.length <= 30);
          let descrizioni = (ad.descrizioni || []).map((d: string) => d.trim()).filter((d: string) => d.length > 0 && d.length <= 90);
          while (titoli.length < 3) {
            titoli.push(`Scopri ${brief.localita || 'di Più'}`.slice(0, 30));
          }
          while (descrizioni.length < 2) {
            descrizioni.push(`Offerta esclusiva. Clicca e scopri i dettagli adesso!`.slice(0, 90));
          }
          return { titoli, descrizioni };
        });
      }

      if (!channels?.google) delete data.google_ads;
      if (!channels?.meta) delete data.meta_ads;

      res.json(data);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Errore durante la generazione degli annunci' });
    }
  });

  app.post('/api/generate-plan', async (req, res) => {
    const { brief, ads, channels } = req.body;
    if (!brief || !ads || !channels) {
      return res.status(400).json({ error: 'Dati incompleti per la generazione del piano' });
    }
    try {
      const prompt = `Crea un piano di lancio manuale per questa campagna: brief ${JSON.stringify(brief)}, annunci ${JSON.stringify(ads)}, canali ${JSON.stringify(channels)}.
Fornisci un JSON con:
checklist (array di stringhe, passi dettagliati per Google e Meta),
controllo_post_lancio (oggetto con chiavi '3_giorni', '7_giorni', '14_giorni' contenenti stringhe di regole di gestione).`;

      const data = await callGemini(prompt, planSchema);
      res.json(data);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Errore durante la generazione del piano' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      });
  } else {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on port 3000');
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
