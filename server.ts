import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from "@google/genai";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  app.use(express.json());

  // API route
  app.post('/api/analyze', async (req, res) => {
      const { url } = req.body;
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: `Analizza questa landing page: ${url}. Fornisci un JSON con: proposta_di_valore, pubblico_target, punti_di_forza (array di 5 stringhe), problemi_di_conversione (array di 5 stringhe), cta_presente_o_mancante, punteggio_prontezza_ads (numero da 1 a 10), motivazione, miglioramenti_consigliati (array di stringhe).`,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: {
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
                    }
                  }
              }
          });
          res.json(JSON.parse(response.text || '{}'));
      } catch (e) {
          console.error(e);
          res.status(500).json({ error: 'Errore durante l\'analisi' });
      }
  });

  app.post('/api/generate-brief', async (req, res) => {
      const { formData, analysis } = req.body;
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: `Crea un brief di campagna ads per ${formData.productName}, obiettivo ${formData.objective}, budget ${formData.budget} CHF, in ${formData.country} (${formData.language}). 
              Analisi landing: ${JSON.stringify(analysis)}. 
              Fornisci un JSON con: pubblico (oggetto con eta, genere, interessi), localita, keyword_alta_intenzione (array di stringhe), keyword_esplorative (array di stringhe), keyword_negative (array di stringhe), angoli_comunicazione (array di stringhe), ripartizione_budget (stringa).`,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      pubblico: {
                        type: Type.OBJECT,
                        properties: {
                          eta: { type: Type.STRING },
                          genere: { type: Type.STRING },
                          interessi: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                      },
                      localita: { type: Type.STRING },
                      keyword_alta_intenzione: { type: Type.ARRAY, items: { type: Type.STRING } },
                      keyword_esplorative: { type: Type.ARRAY, items: { type: Type.STRING } },
                      keyword_negative: { type: Type.ARRAY, items: { type: Type.STRING } },
                      angoli_comunicazione: { type: Type.ARRAY, items: { type: Type.STRING } },
                      ripartizione_budget: { type: Type.STRING }
                    }
                  }
              }
          });
          res.json(JSON.parse(response.text || '{}'));
      } catch (e) {
          console.error(e);
          res.status(500).json({ error: 'Errore durante la generazione del brief' });
      }
  });

  app.post('/api/generate-ads', async (req, res) => {
      const { brief, channels } = req.body;
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: `Genera gli annunci per questa campagna: ${JSON.stringify(brief)}. 
              Canali richiesti: ${JSON.stringify(channels)}.
              Fornisci un JSON con: 
              google_ads (array di oggetti: titoli (max 30 car), descrizioni (max 90 car)), 
              meta_ads (array di oggetti: testo_principale, titolo, descrizione, idea_immagine).`,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      google_ads: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                titoli: { type: Type.ARRAY, items: { type: Type.STRING } },
                                descrizioni: { type: Type.ARRAY, items: { type: Type.STRING } }
                            }
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
                            }
                        }
                      }
                    }
                  }
              }
          });
          res.json(JSON.parse(response.text || '{}'));
      } catch (e) {
          console.error(e);
          res.status(500).json({ error: 'Errore durante la generazione degli annunci' });
      }
  });

  app.post('/api/generate-plan', async (req, res) => {
      const { brief, ads, channels } = req.body;
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: `Crea un piano di lancio manuale per questa campagna: brief ${JSON.stringify(brief)}, annunci ${JSON.stringify(ads)}, canali ${JSON.stringify(channels)}.
              Fornisci un JSON con:
              checklist (array di stringhe, passi dettagliati per Google e Meta),
              controllo_post_lancio (oggetto con chiavi 3_giorni, 7_giorni, 14_giorni contenenti stringhe di regole di gestione).`,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
                      controllo_post_lancio: {
                        type: Type.OBJECT,
                        properties: {
                          '3_giorni': { type: Type.STRING },
                          '7_giorni': { type: Type.STRING },
                          '14_giorni': { type: Type.STRING }
                        }
                      }
                    }
                  }
              }
          });
          res.json(JSON.parse(response.text || '{}'));
      } catch (e) {
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

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
});

