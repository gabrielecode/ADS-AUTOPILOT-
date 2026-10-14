/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useState} from 'react';

type Step = 'Landing' | 'Brief' | 'Annunci' | 'Piano' | 'Storico';

export default function App() {
  const [activeStep, setActiveStep] = useState<Step>('Landing');
  const [formData, setFormData] = useState({
    url: '',
    productName: '',
    objective: 'leads',
    budget: 50,
    country: 'Switzerland',
    language: 'Italian',
    channels: { google: true, meta: false },
  });

  const [analysis, setAnalysis] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [ads, setAds] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Storico State
  const [history, setHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('ads_autopilot_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [metrics, setMetrics] = useState({
    spesa: 0,
    click: 0,
    conversioni: 0
  });

  const handleGenerateBrief = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData, analysis }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBrief(data);
      setActiveStep('Brief');
    } catch (e: any) {
      setErrorMsg(e.message || 'Errore nella generazione del brief');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAds = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/generate-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, channels: formData.channels }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAds(data);
      setActiveStep('Annunci');
    } catch (e: any) {
      setErrorMsg(e.message || 'Errore nella generazione degli annunci');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, ads, channels: formData.channels }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlan(data);
      setActiveStep('Piano');

      // Save to history automatically upon completing the plan
      const project = {
        id: Date.now(),
        date: new Date().toLocaleDateString('it-IT'),
        formData,
        analysis,
        brief,
        ads,
        plan: data,
        metrics
      };
      const updated = [project, ...history];
      setHistory(updated);
      localStorage.setItem('ads_autopilot_history', JSON.stringify(updated));
    } catch (e: any) {
      setErrorMsg(e.message || 'Errore nella generazione del piano');
    } finally {
      setLoading(false);
    }
  };

  const exportMarkdown = () => {
    let md = `# Ads Autopilot - Report Campagna\n\n`;
    md += `**Prodotto:** ${formData.productName}\n`;
    md += `**URL:** ${formData.url}\n`;
    md += `**Budget:** ${formData.budget} CHF/giorno\n\n`;
    if (brief) {
      md += `## 1. Brief\n`;
      md += `- **Località:** ${brief.localita}\n`;
      md += `- **Pubblico:** ${brief.pubblico?.eta}, ${brief.pubblico?.genere}\n`;
      md += `- **Budget:** ${brief.ripartizione_budget}\n\n`;
    }
    if (ads) {
      md += `## 2. Annunci\n`;
      ads.google_ads?.forEach((g: any, i: number) => {
        md += `### Google Ad ${i+1}\n- Titoli: ${g.titoli?.join(' | ')}\n- Descrizioni: ${g.descrizioni?.join(' | ')}\n\n`;
      });
      ads.meta_ads?.forEach((m: any, i: number) => {
        md += `### Meta Ad ${i+1}\n- Titolo: ${m.titolo}\n- Testo: ${m.testo_principale}\n\n`;
      });
    }
    if (plan) {
      md += `## 3. Piano di Lancio\n`;
      plan.checklist?.forEach((c: string) => md += `- [ ] ${c}\n`);
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_${formData.productName || 'report'}.md`;
    a.click();
  };


  const steps: Step[] = ['Landing', 'Brief', 'Annunci', 'Piano', 'Storico'];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-8">Ads Autopilot</h1>
        <nav className="space-y-2">
          {steps.map((step) => (
            <button
              key={step}
              onClick={() => setActiveStep(step)}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeStep === step ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {step}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900">{activeStep}</h2>
        </header>

        {activeStep === 'Landing' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 max-w-2xl">
              <h3 className="text-lg font-semibold mb-6">Configurazione Campagna</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL Sito</label>
                  <input type="url" value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} className="w-full p-2 border border-slate-300 rounded-md" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome Prodotto</label>
                  <input type="text" value={formData.productName} onChange={(e) => setFormData({...formData, productName: e.target.value})} className="w-full p-2 border border-slate-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Obiettivo</label>
                  <select value={formData.objective} onChange={(e) => setFormData({...formData, objective: e.target.value})} className="w-full p-2 border border-slate-300 rounded-md">
                    <option value="leads">Lead</option>
                    <option value="registrations">Registrazioni</option>
                    <option value="sales">Vendite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Budget Giornaliero (CHF)</label>
                  <input type="number" value={formData.budget} onChange={(e) => setFormData({...formData, budget: Number(e.target.value)})} className="w-full p-2 border border-slate-300 rounded-md" />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Paese</label>
                    <input type="text" value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})} className="w-full p-2 border border-slate-300 rounded-md" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lingua</label>
                    <input type="text" value={formData.language} onChange={(e) => setFormData({...formData, language: e.target.value})} className="w-full p-2 border border-slate-300 rounded-md" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Canali</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.channels.google} onChange={(e) => setFormData({...formData, channels: {...formData.channels, google: e.target.checked}})} />
                      Google Search
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.channels.meta} onChange={(e) => setFormData({...formData, channels: {...formData.channels, meta: e.target.checked}})} />
                      Meta
                    </label>
                  </div>
                </div>
                <button onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch('/api/analyze', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: formData.url }),
                    });
                    const data = await res.json();
                    setAnalysis(data);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setLoading(false);
                  }
                }} disabled={loading} className="w-full bg-slate-900 text-white py-2 rounded-md font-medium hover:bg-slate-800 mt-6 disabled:bg-slate-400">
                  {loading ? 'Analisi in corso...' : 'Analizza'}
                </button>
                {analysis && (
                  <button onClick={handleGenerateBrief} disabled={loading} className="w-full bg-slate-100 text-slate-900 py-2 rounded-md font-medium hover:bg-slate-200 mt-2 disabled:bg-slate-300">
                    {loading ? 'Generazione brief...' : 'Genera Brief'}
                  </button>
                )}
              </div>
            </div>

            {analysis && (
              <div className="space-y-6 mt-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-2">Proposta di valore</h4>
                    <p className="text-slate-600 text-sm">{analysis.proposta_di_valore}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-2">Pubblico target</h4>
                    <p className="text-slate-600 text-sm">{analysis.pubblico_target}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-2">Punti di forza</h4>
                    <ul className="list-disc list-inside text-slate-600 text-sm">
                      {analysis.punti_di_forza?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-2">Problemi di conversione</h4>
                    <ul className="list-disc list-inside text-slate-600 text-sm">
                      {analysis.problemi_di_conversione?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-2">CTA</h4>
                    <p className="text-slate-600 text-sm">{analysis.cta_presente_o_mancante}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-2">Prontezza Ads</h4>
                    <p className="text-slate-600 text-sm">{analysis.punteggio_prontezza_ads}/10 - {analysis.motivazione}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <h4 className="font-semibold text-slate-900 mb-2">Miglioramenti consigliati</h4>
                  <ul className="list-disc list-inside text-slate-600 text-sm">
                    {analysis.miglioramenti_consigliati?.map((m: string, i: number) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
        {activeStep === 'Brief' && brief && (
          <div className="bg-white p-6 rounded-lg border border-slate-200 max-w-3xl space-y-4">
              <h3 className="text-lg font-semibold mb-4">Brief di Campagna</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700">Pubblico (Età/Genere/Interessi)</label>
                <input type="text" value={`${brief.pubblico.eta} | ${brief.pubblico.genere} | ${brief.pubblico.interessi.join(', ')}`} onChange={(e) => setBrief({...brief, pubblico: { ...brief.pubblico, eta: e.target.value.split(' | ')[0], genere: e.target.value.split(' | ')[1], interessi: e.target.value.split(' | ')[2]?.split(', ') }})} className="w-full p-2 border border-slate-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Località</label>
                <input type="text" value={brief.localita} onChange={(e) => setBrief({...brief, localita: e.target.value})} className="w-full p-2 border border-slate-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Keywords Alta Intenzione</label>
                <textarea value={brief.keyword_alta_intenzione.join('\n')} onChange={(e) => setBrief({...brief, keyword_alta_intenzione: e.target.value.split('\n')})} className="w-full p-2 border border-slate-300 rounded-md" rows={4} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Keywords Esplorative</label>
                <textarea value={brief.keyword_esplorative.join('\n')} onChange={(e) => setBrief({...brief, keyword_esplorative: e.target.value.split('\n')})} className="w-full p-2 border border-slate-300 rounded-md" rows={4} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Keywords Negative</label>
                <textarea value={brief.keyword_negative.join('\n')} onChange={(e) => setBrief({...brief, keyword_negative: e.target.value.split('\n')})} className="w-full p-2 border border-slate-300 rounded-md" rows={4} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Angoli Comunicazione</label>
                <textarea value={brief.angoli_comunicazione.join('\n\n')} onChange={(e) => setBrief({...brief, angoli_comunicazione: e.target.value.split('\n\n')})} className="w-full p-2 border border-slate-300 rounded-md" rows={4} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Ripartizione Budget</label>
                <textarea value={brief.ripartizione_budget} onChange={(e) => setBrief({...brief, ripartizione_budget: e.target.value})} className="w-full p-2 border border-slate-300 rounded-md" rows={3} />
              </div>
              <button onClick={handleGenerateAds} disabled={loading} className="w-full bg-slate-900 text-white py-2 rounded-md font-medium hover:bg-slate-800 mt-6 disabled:bg-slate-400">
                {loading ? 'Generazione annunci...' : 'Genera Annunci'}
              </button>
          </div>
        )}
        {activeStep === 'Annunci' && ads && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Annunci Generati</h3>
            <div className="space-y-4">
                {ads.google_ads?.map((ad: any, i: number) => (
                    <div key={i} className="bg-white p-4 rounded border border-slate-200">
                        <h4 className="font-semibold">Google Ad {i+1}</h4>
                        <p>Titoli: {ad.titoli.join(', ')}</p>
                        <p>Descrizioni: {ad.descrizioni.join(', ')}</p>
                    </div>
                ))}
                {ads.meta_ads?.map((ad: any, i: number) => (
                    <div key={i} className="bg-white p-4 rounded border border-slate-200">
                        <h4 className="font-semibold">Meta Ad {i+1}</h4>
                        <p>Titolo: {ad.titolo}</p>
                        <p>Testo: {ad.testo_principale}</p>
                        <p>Immagine: {ad.idea_immagine}</p>
                    </div>
                ))}
            </div>
            <button onClick={handleGeneratePlan} disabled={loading} className="w-full bg-slate-900 text-white py-2 rounded-md font-medium hover:bg-slate-800 mt-6 disabled:bg-slate-400">
                {loading ? 'Generazione piano...' : 'Genera Piano di Lancio'}
            </button>
          </div>
        )}
        {activeStep === 'Piano' && plan && (
          <div className="space-y-6 max-w-3xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900">Piano di Lancio</h3>
              <button onClick={exportMarkdown} className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors">
                Esporta Report Markdown
              </button>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h4 className="font-semibold mb-2 text-slate-900">Checklist</h4>
              <ul className="list-disc list-inside text-slate-600 text-sm space-y-1">
                {plan.checklist?.map((item: string, i: number) => <li key={i}>{item}</li>)}
              </ul>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-2">
              <h4 className="font-semibold mb-2 text-slate-900">Controllo post-lancio</h4>
              <p className="text-sm text-slate-600"><strong className="text-slate-900">3 giorni:</strong> {plan.controllo_post_lancio?.['3_giorni']}</p>
              <p className="text-sm text-slate-600"><strong className="text-slate-900">7 giorni:</strong> {plan.controllo_post_lancio?.['7_giorni']}</p>
              <p className="text-sm text-slate-600"><strong className="text-slate-900">14 giorni:</strong> {plan.controllo_post_lancio?.['14_giorni']}</p>
            </div>
          </div>
        )}

        {activeStep === 'Storico' && (
          <div className="space-y-6 max-w-4xl">
            <h3 className="text-xl font-bold text-slate-900">Storico Campagne & Risultati</h3>
            {history.length === 0 ? (
              <p className="text-slate-500 text-sm">Nessuna campagna salvata nello storico.</p>
            ) : (
              <div className="space-y-6">
                {history.map((proj, idx) => {
                  const costPerConv = proj.metrics?.conversioni > 0 
                    ? (proj.metrics.spesa / proj.metrics.conversioni).toFixed(2) 
                    : 'N/D';

                  return (
                    <div key={proj.id || idx} className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-lg text-slate-900">{proj.formData?.productName || 'Campagna senza nome'}</h4>
                          <p className="text-xs text-slate-500">URL: {proj.formData?.url} · Salvata il: {proj.date}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setFormData(proj.formData);
                              setAnalysis(proj.analysis);
                              setBrief(proj.brief);
                              setAds(proj.ads);
                              setPlan(proj.plan);
                              setActiveStep('Landing');
                            }}
                            className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded hover:bg-slate-800"
                          >
                            Riapri
                          </button>
                          <button 
                            onClick={() => {
                              const duplicated = { ...proj, id: Date.now(), date: new Date().toLocaleDateString('it-IT') };
                              const updated = [duplicated, ...history];
                              setHistory(updated);
                              localStorage.setItem('ads_autopilot_history', JSON.stringify(updated));
                            }}
                            className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-200"
                          >
                            Duplica
                          </button>
                          <button 
                            onClick={() => {
                              const updated = history.filter(h => h.id !== proj.id);
                              setHistory(updated);
                              localStorage.setItem('ads_autopilot_history', JSON.stringify(updated));
                            }}
                            className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100"
                          >
                            Elimina
                          </button>
                        </div>
                      </div>

                      {/* Performance Tracker */}
                      <div className="border-t border-slate-100 pt-4 mt-4">
                        <h5 className="text-sm font-semibold text-slate-800 mb-3">Risultati Reali & Performance</h5>
                        <div className="grid grid-cols-4 gap-4 items-center">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Spesa Totale (CHF)</label>
                            <input 
                              type="number" 
                              value={proj.metrics?.spesa || 0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const updatedHistory = history.map(h => h.id === proj.id ? { ...h, metrics: { ...h.metrics, spesa: val } } : h);
                                setHistory(updatedHistory);
                                localStorage.setItem('ads_autopilot_history', JSON.stringify(updatedHistory));
                              }}
                              className="w-full p-1.5 text-sm border border-slate-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Click Totali</label>
                            <input 
                              type="number" 
                              value={proj.metrics?.click || 0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const updatedHistory = history.map(h => h.id === proj.id ? { ...h, metrics: { ...h.metrics, click: val } } : h);
                                setHistory(updatedHistory);
                                localStorage.setItem('ads_autopilot_history', JSON.stringify(updatedHistory));
                              }}
                              className="w-full p-1.5 text-sm border border-slate-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Conversioni</label>
                            <input 
                              type="number" 
                              value={proj.metrics?.conversioni || 0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const updatedHistory = history.map(h => h.id === proj.id ? { ...h, metrics: { ...h.metrics, conversioni: val } } : h);
                                setHistory(updatedHistory);
                                localStorage.setItem('ads_autopilot_history', JSON.stringify(updatedHistory));
                              }}
                              className="w-full p-1.5 text-sm border border-slate-300 rounded"
                            />
                          </div>
                          <div className="bg-slate-50 p-3 rounded border border-slate-100 text-center">
                            <span className="block text-xs text-slate-500">Costo / Conversione</span>
                            <span className="text-lg font-bold text-slate-900">{costPerConv !== 'N/D' ? `${costPerConv} CHF` : 'N/D'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
