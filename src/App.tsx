/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useState, useEffect} from 'react';

type Step = 'Landing' | 'Brief' | 'Annunci' | 'Piano' | 'Storico';

export default function App() {
  const [activeStep, setActiveStep] = useState<Step>('Landing');
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
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

  // Save to localStorage via useEffect
  useEffect(() => {
    try {
      localStorage.setItem('ads_autopilot_history', JSON.stringify(history));
    } catch (e) {
      console.error(e);
    }
  }, [history]);

  const isValidUrl = (string: string) => {
    try {
      const u = new URL(string);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const hasSelectedChannels = formData.channels.google || formData.channels.meta;

  const handleAnalyze = async () => {
    if (!isValidUrl(formData.url)) {
      setErrorMsg("Inserisci un URL valido (http:// o https://)");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setAnalysis(null);
    setBrief(null);
    setAds(null);
    setPlan(null);
    setCurrentProjectId(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formData.url }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Errore durante l\'analisi');
      }
      setAnalysis(data);
    } catch (e: any) {
      setErrorMsg(e.message || 'Errore durante l\'analisi');
    } finally {
      setLoading(false);
    }
  };

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
      if (!res.ok) throw new Error(data.error || 'Errore nella generazione del brief');
      setBrief(data);
      setActiveStep('Brief');
    } catch (e: any) {
      setErrorMsg(e.message || 'Errore nella generazione del brief');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAds = async () => {
    if (!hasSelectedChannels) {
      setErrorMsg("Seleziona almeno un canale (Google o Meta)");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      // Filter out empty rows (trim) in keyword/angle lists before sending
      const cleanBrief = {
        ...brief,
        keyword_alta_intenzione: (brief?.keyword_alta_intenzione || []).map((k: string) => k.trim()).filter(Boolean),
        keyword_esplorative: (brief?.keyword_esplorative || []).map((k: string) => k.trim()).filter(Boolean),
        keyword_negative: (brief?.keyword_negative || []).map((k: string) => k.trim()).filter(Boolean),
        angoli_comunicazione: (brief?.angoli_comunicazione || []).map((a: string) => a.trim()).filter(Boolean),
      };

      const res = await fetch('/api/generate-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: cleanBrief, channels: formData.channels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nella generazione degli annunci');
      setAds(data);
      setActiveStep('Annunci');
    } catch (e: any) {
      setErrorMsg(e.message || 'Errore nella generazione degli annunci');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!hasSelectedChannels) {
      setErrorMsg("Seleziona almeno un canale (Google o Meta)");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, ads, channels: formData.channels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nella generazione del piano');
      setPlan(data);
      setActiveStep('Piano');

      // Update or add project to history
      const projectId = currentProjectId || Date.now();
      if (!currentProjectId) {
        setCurrentProjectId(projectId);
      }

      const project = {
        id: projectId,
        date: new Date().toLocaleDateString('it-IT'),
        formData,
        analysis,
        brief,
        ads,
        plan: data,
      };

      const existingIndex = history.findIndex(h => h.id === projectId);
      if (existingIndex >= 0) {
        const updated = [...history];
        updated[existingIndex] = project;
        setHistory(updated);
      } else {
        setHistory([project, ...history]);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Errore nella generazione del piano');
    } finally {
      setLoading(false);
    }
  };

  const exportMarkdown = () => {
    let md = `# Ads Autopilot - Report Campagna\n\n`;
    md += `**Prodotto:** ${formData.productName || 'N/D'}\n`;
    md += `**URL:** ${formData.url || 'N/D'}\n`;
    md += `**Budget:** ${formData.budget} CHF al giorno\n\n`;
    
    if (analysis) {
      md += `## Analisi Landing Page\n`;
      md += `- **Proposta di valore:** ${analysis.proposta_di_valore || 'N/D'}\n`;
      md += `- **Pubblico target:** ${analysis.pubblico_target || 'N/D'}\n`;
      md += `- **Punti di forza:** ${(analysis.punti_di_forza ?? []).join(', ')}\n`;
      md += `- **Problemi di conversione:** ${(analysis.problemi_di_conversione ?? []).join(', ')}\n\n`;
    }

    if (brief) {
      md += `## 1. Brief\n`;
      md += `- **Località:** ${brief.localita || 'N/D'}\n`;
      md += `- **Pubblico:** Età: ${brief.pubblico?.eta || 'N/D'}, Genere: ${brief.pubblico?.genere || 'N/D'}, Interessi: ${(brief.pubblico?.interessi ?? []).join(', ')}\n`;
      md += `- **Keywords Alta Intenzione:** ${(brief.keyword_alta_intenzione ?? []).join(', ')}\n`;
      md += `- **Keywords Esplorative:** ${(brief.keyword_esplorative ?? []).join(', ')}\n`;
      md += `- **Budget:** ${brief.ripartizione_budget || 'N/D'}\n\n`;
    }
    if (ads) {
      md += `## 2. Annunci\n`;
      (ads.google_ads ?? []).forEach((g: any, i: number) => {
        md += `### Google Ad ${i+1}\n- Titoli: ${(g.titoli ?? []).join(' | ')}\n- Descrizioni: ${(g.descrizioni ?? []).join(' | ')}\n\n`;
      });
      (ads.meta_ads ?? []).forEach((m: any, i: number) => {
        md += `### Meta Ad ${i+1}\n- Titolo: ${m.titolo || ''}\n- Testo: ${m.testo_principale || ''}\n\n`;
      });
    }
    if (plan) {
      md += `## 3. Piano di Lancio\n`;
      (plan.checklist ?? []).forEach((c: string) => md += `- [ ] ${c}\n`);
      md += `\n### Controllo post-lancio\n`;
      md += `- **3 giorni:** ${plan.controllo_post_lancio?.['3_giorni'] || 'N/D'}\n`;
      md += `- **7 giorni:** ${plan.controllo_post_lancio?.['7_giorni'] || 'N/D'}\n`;
      md += `- **14 giorni:** ${plan.controllo_post_lancio?.['14_giorni'] || 'N/D'}\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_${formData.productName || 'report'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const steps: Step[] = ['Landing', 'Brief', 'Annunci', 'Piano', 'Storico'];

  const isStepDisabled = (step: Step) => {
    if (step === 'Brief') return !analysis;
    if (step === 'Annunci') return !brief;
    if (step === 'Piano') return !ads;
    return false;
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col">
        <h1 className="text-xl font-bold text-slate-900 mb-8">Ads Autopilot</h1>
        <nav className="space-y-2 flex-1">
          {steps.map((step) => {
            const disabled = isStepDisabled(step);
            return (
              <button
                key={step}
                disabled={disabled}
                onClick={() => !disabled && setActiveStep(step)}
                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeStep === step
                    ? 'bg-slate-900 text-white'
                    : disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {step}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-slate-900">{activeStep}</h2>
        </header>

        {errorMsg && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center text-sm">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">✕</button>
          </div>
        )}

        {activeStep === 'Landing' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 max-w-2xl shadow-sm">
              <h3 className="text-lg font-semibold mb-6 text-slate-900">Configurazione Campagna</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL Sito</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({...formData, url: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome Prodotto</label>
                  <input
                    type="text"
                    value={formData.productName}
                    onChange={(e) => setFormData({...formData, productName: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    placeholder="es. SaaS di fatturazione"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Obiettivo</label>
                  <select
                    value={formData.objective}
                    onChange={(e) => setFormData({...formData, objective: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value="leads">Lead</option>
                    <option value="registrations">Registrazioni</option>
                    <option value="sales">Vendite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Budget Giornaliero (CHF)</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({...formData, budget: Number(e.target.value)})}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Paese</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lingua</label>
                    <input
                      type="text"
                      value={formData.language}
                      onChange={(e) => setFormData({...formData, language: e.target.value})}
                      className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Canali</label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.channels.google}
                        onChange={(e) => setFormData({...formData, channels: {...formData.channels, google: e.target.checked}})}
                      />
                      Google Search
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.channels.meta}
                        onChange={(e) => setFormData({...formData, channels: {...formData.channels, meta: e.target.checked}})}
                      />
                      Meta
                    </label>
                  </div>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !isValidUrl(formData.url)}
                  className="w-full bg-slate-900 text-white py-2 rounded-md font-medium hover:bg-slate-800 mt-6 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {loading ? 'Analisi in corso...' : 'Analizza'}
                </button>
                {analysis && (
                  <button
                    onClick={handleGenerateBrief}
                    disabled={loading}
                    className="w-full bg-slate-100 text-slate-900 py-2 rounded-md font-medium hover:bg-slate-200 mt-2 disabled:bg-slate-300 transition-colors text-sm"
                  >
                    {loading ? 'Generazione brief...' : 'Genera Brief'}
                  </button>
                )}
              </div>
            </div>

            {analysis && (
              <div className="space-y-6 mt-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <h4 className="font-semibold text-slate-900 mb-2">Proposta di valore</h4>
                    <p className="text-slate-600 text-sm">{analysis.proposta_di_valore}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <h4 className="font-semibold text-slate-900 mb-2">Pubblico target</h4>
                    <p className="text-slate-600 text-sm">{analysis.pubblico_target}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <h4 className="font-semibold text-slate-900 mb-2">Punti di forza</h4>
                    <ul className="list-disc list-inside text-slate-600 text-sm space-y-1">
                      {(analysis.punti_di_forza ?? []).map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <h4 className="font-semibold text-slate-900 mb-2">Problemi di conversione</h4>
                    <ul className="list-disc list-inside text-slate-600 text-sm space-y-1">
                      {(analysis.problemi_di_conversione ?? []).map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <h4 className="font-semibold text-slate-900 mb-2">CTA</h4>
                    <p className="text-slate-600 text-sm">{analysis.cta_presente_o_mancante}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <h4 className="font-semibold text-slate-900 mb-2">Prontezza Ads</h4>
                    <p className="text-slate-600 text-sm">{analysis.punteggio_prontezza_ads}/10 - {analysis.motivazione}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                  <h4 className="font-semibold text-slate-900 mb-2">Miglioramenti consigliati</h4>
                  <ul className="list-disc list-inside text-slate-600 text-sm space-y-1">
                    {(analysis.miglioramenti_consigliati ?? []).map((m: string, i: number) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {activeStep === 'Brief' && (
          brief ? (
            <div className="bg-white p-6 rounded-lg border border-slate-200 max-w-3xl space-y-4 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Brief di Campagna</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Età</label>
                  <input
                    type="text"
                    defaultValue={brief.pubblico?.eta || ''}
                    onBlur={(e) => setBrief({
                      ...brief,
                      pubblico: { ...brief.pubblico, eta: e.target.value }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    placeholder="es. 25-54"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Genere</label>
                  <input
                    type="text"
                    defaultValue={brief.pubblico?.genere || ''}
                    onBlur={(e) => setBrief({
                      ...brief,
                      pubblico: { ...brief.pubblico, genere: e.target.value }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    placeholder="es. Tutti"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Interessi (separati da virgola)</label>
                  <input
                    type="text"
                    defaultValue={(brief.pubblico?.interessi ?? []).join(', ')}
                    onBlur={(e) => setBrief({
                      ...brief,
                      pubblico: {
                        ...brief.pubblico,
                        interessi: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)
                      }
                    })}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    placeholder="Tech, Marketing"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Località</label>
                <input
                  type="text"
                  value={brief.localita || ''}
                  onChange={(e) => setBrief({...brief, localita: e.target.value})}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keywords Alta Intenzione</label>
                <textarea
                  value={(brief.keyword_alta_intenzione ?? []).join('\n')}
                  onChange={(e) => setBrief({...brief, keyword_alta_intenzione: e.target.value.split('\n')})}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm font-mono"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keywords Esplorative</label>
                <textarea
                  value={(brief.keyword_esplorative ?? []).join('\n')}
                  onChange={(e) => setBrief({...brief, keyword_esplorative: e.target.value.split('\n')})}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm font-mono"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keywords Negative</label>
                <textarea
                  value={(brief.keyword_negative ?? []).join('\n')}
                  onChange={(e) => setBrief({...brief, keyword_negative: e.target.value.split('\n')})}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm font-mono"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Angoli Comunicazione</label>
                <textarea
                  value={(brief.angoli_comunicazione ?? []).join('\n\n')}
                  onChange={(e) => setBrief({...brief, angoli_comunicazione: e.target.value.split('\n\n')})}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ripartizione Budget</label>
                <textarea
                  value={brief.ripartizione_budget || ''}
                  onChange={(e) => setBrief({...brief, ripartizione_budget: e.target.value})}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  rows={3}
                />
              </div>
              <button
                onClick={handleGenerateAds}
                disabled={loading || !hasSelectedChannels}
                className="w-full bg-slate-900 text-white py-2 rounded-md font-medium hover:bg-slate-800 mt-6 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {loading ? 'Generazione annunci...' : 'Genera Annunci'}
              </button>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-slate-500">
              <p className="text-base font-medium">Nessun brief disponibile. Completa prima l'analisi della landing page.</p>
            </div>
          )
        )}

        {activeStep === 'Annunci' && (
          ads ? (
            <div className="space-y-6 max-w-3xl">
              <h3 className="text-lg font-semibold text-slate-900">Annunci Generati</h3>
              <div className="space-y-4">
                {(ads.google_ads ?? []).map((ad: any, i: number) => (
                  <div key={i} className="bg-white p-5 rounded-lg border border-slate-200 space-y-2 shadow-sm">
                    <h4 className="font-semibold text-slate-900">Google Ad {i+1}</h4>
                    <p className="text-sm text-slate-700"><strong>Titoli:</strong> {(ad.titoli ?? []).join(' | ')}</p>
                    <p className="text-sm text-slate-700"><strong>Descrizioni:</strong> {(ad.descrizioni ?? []).join(' | ')}</p>
                  </div>
                ))}
                {(ads.meta_ads ?? []).map((ad: any, i: number) => (
                  <div key={i} className="bg-white p-5 rounded-lg border border-slate-200 space-y-2 shadow-sm">
                    <h4 className="font-semibold text-slate-900">Meta Ad {i+1}</h4>
                    <p className="text-sm text-slate-700"><strong>Titolo:</strong> {ad.titolo}</p>
                    <p className="text-sm text-slate-700"><strong>Testo:</strong> {ad.testo_principale}</p>
                    <p className="text-sm text-slate-500"><strong>Immagine:</strong> {ad.idea_immagine}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={handleGeneratePlan}
                disabled={loading || !hasSelectedChannels}
                className="w-full bg-slate-900 text-white py-2 rounded-md font-medium hover:bg-slate-800 mt-6 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {loading ? 'Generazione piano...' : 'Genera Piano di Lancio'}
              </button>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-slate-500">
              <p className="text-base font-medium">Nessun annuncio disponibile. Genera prima il brief e gli annunci.</p>
            </div>
          )
        )}

        {activeStep === 'Piano' && (
          plan ? (
            <div className="space-y-6 max-w-3xl">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-900">Piano di Lancio</h3>
                <button
                  onClick={exportMarkdown}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Esporta Report Markdown
                </button>
              </div>
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <h4 className="font-semibold mb-2 text-slate-900">Checklist</h4>
                <ul className="list-disc list-inside text-slate-600 text-sm space-y-1.5">
                  {(plan.checklist ?? []).map((item: string, i: number) => <li key={i}>{item}</li>)}
                </ul>
              </div>
              <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-3 shadow-sm">
                <h4 className="font-semibold mb-2 text-slate-900">Controllo post-lancio</h4>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">3 giorni:</strong> {plan.controllo_post_lancio?.['3_giorni']}</p>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">7 giorni:</strong> {plan.controllo_post_lancio?.['7_giorni']}</p>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">14 giorni:</strong> {plan.controllo_post_lancio?.['14_giorni']}</p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-slate-500">
              <p className="text-base font-medium">Nessun piano disponibile. Completa i passaggi precedenti per generare il piano.</p>
            </div>
          )
        )}

        {activeStep === 'Storico' && (
          <div className="space-y-6 max-w-4xl">
            <h3 className="text-xl font-bold text-slate-900">Storico Campagne & Risultati</h3>
            {history.length === 0 ? (
              <div className="bg-white p-12 rounded-lg border border-slate-200 text-center text-slate-500">
                <p className="text-base font-medium">Nessuna campagna salvata nello storico.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {history.map((proj, idx) => (
                  <div key={proj.id || idx} className="bg-white p-6 rounded-lg border border-slate-200 space-y-4 shadow-sm">
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
                            setCurrentProjectId(proj.id);
                            setActiveStep('Landing');
                          }}
                          className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded hover:bg-slate-800 transition-colors font-medium"
                        >
                          Riapri
                        </button>
                        <button
                          onClick={() => {
                            const duplicated = { ...proj, id: Date.now(), date: new Date().toLocaleDateString('it-IT') };
                            setHistory([duplicated, ...history]);
                          }}
                          className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-200 transition-colors font-medium"
                        >
                          Duplica
                        </button>
                        <button
                          onClick={() => {
                            if (currentProjectId === proj.id) {
                              setCurrentProjectId(null);
                            }
                            setHistory(history.filter(h => h.id !== proj.id));
                          }}
                          className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100 transition-colors font-medium"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
