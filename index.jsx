import React, { useState, useEffect } from 'react';
import { Sparkles, Film, Search, ChevronRight, RefreshCw, Info, Image as ImageIcon } from 'lucide-react';

const apiKey = ""; // API key is handled by the environment

const App = () => {
  const [step, setStep] = useState('input'); // input, reasons, recommendations
  const [movieInput, setMovieInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [selectedReason, setSelectedReason] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState(null);

  const fetchWithRetry = async (url, options, retries = 5, backoff = 1000) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  };

  const generatePoster = async (title, year) => {
    try {
      const prompt = `A professional, high-quality cinematic movie poster for the film "${title}" (${year}). Minimalist graphic design, evocative atmosphere, artistic, cinematic lighting, 4k resolution style. No crowded text.`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1 }
          })
        }
      );
      const data = await response.json();
      return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
    } catch (err) {
      console.error("Poster generation failed", err);
      return null;
    }
  };

  const getMovieReasons = async () => {
    if (!movieInput.trim()) return;
    setIsLoading(true);
    setError(null);

    const systemPrompt = `You are a movie expert. The user likes a specific movie. 
    Provide exactly 4 distinct, short reasons (max 10 words each) why someone might like this movie. 
    Focus on unique "flavors" like atmosphere, intellectual challenge, or specific cast chemistry.
    Format as JSON with a "reasons" array.`;

    const userQuery = `I like "${movieInput}". Why?`;

    try {
      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
          })
        }
      );

      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      setReasons(result.reasons);
      setStep('reasons');
    } catch (err) {
      setError("I couldn't analyze that movie. Please try another one.");
    } finally {
      setIsLoading(false);
    }
  };

  const getRecommendations = async (reason) => {
    setSelectedReason(reason);
    setIsLoading(true);
    setError(null);

    const systemPrompt = `You are a cinematic advisor. The user likes "${movieInput}" specifically because of "${reason}". 
    Suggest 3 movies they might like that share this specific quality. 
    Prioritize "deep cuts" or less obvious choices.
    For each movie, provide: "title", "year", and a "why".
    Format as a JSON object with a "recommendations" array.`;

    try {
      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Recommendations please." }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
          })
        }
      );

      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      setRecommendations(result.recommendations);
      setStep('recommendations');

      // Fetch posters in parallel after setting state
      const posterPromises = result.recommendations.map(async (rec, index) => {
        const posterUrl = await generatePoster(rec.title, rec.year);
        setRecommendations(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], posterUrl };
          return updated;
        });
      });
      
      await Promise.all(posterPromises);

    } catch (err) {
      setError("Failed to get recommendations. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep('input');
    setMovieInput('');
    setReasons([]);
    setSelectedReason(null);
    setRecommendations([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <header className="mb-8 md:mb-12 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-600 text-white rounded-2xl mb-4 shadow-lg">
            <Film size={28} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">CineFlavor</h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base">Nuanced recommendations powered by AI.</p>
        </header>

        {/* Main Interface */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-5 md:p-8 border border-slate-100">
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-3">
              <Info className="shrink-0" size={18} />
              {error}
            </div>
          )}

          {step === 'input' && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">What's a movie you love?</h2>
                <p className="text-slate-500 text-sm">We'll find your specific taste "flavor".</p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g., Inception, Parasite..."
                  className="w-full p-4 pr-12 text-lg rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-0 transition-all outline-none"
                  value={movieInput}
                  onChange={(e) => setMovieInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && getMovieReasons()}
                />
                <button 
                  onClick={getMovieReasons}
                  disabled={isLoading || !movieInput.trim()}
                  className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 transition-colors"
                >
                  {isLoading ? <RefreshCw className="animate-spin" size={24} /> : <ChevronRight size={24} />}
                </button>
              </div>
            </div>
          )}

          {step === 'reasons' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <button onClick={reset} className="text-slate-400 hover:text-slate-600">
                  <RefreshCw size={18} />
                </button>
                <h2 className="text-sm font-medium text-slate-700 italic">"I like {movieInput} because..."</h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {reasons.map((reason, idx) => (
                  <button
                    key={idx}
                    onClick={() => getRecommendations(reason)}
                    disabled={isLoading}
                    className="w-full text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-700 text-sm md:text-base">{reason}</span>
                    {isLoading && selectedReason === reason ? (
                      <RefreshCw className="animate-spin text-indigo-600 shrink-0" size={20} />
                    ) : (
                      <Sparkles className="text-slate-300 group-hover:text-indigo-400 shrink-0" size={18} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'recommendations' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div className="max-w-[80%]">
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">Your Next Watch</h2>
                  <p className="text-indigo-600 text-xs font-bold mt-1 uppercase tracking-widest truncate">
                    Flavor: {selectedReason}
                  </p>
                </div>
                <button 
                  onClick={reset}
                  className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg"
                >
                  <RefreshCw size={20} />
                </button>
              </div>

              <div className="space-y-12">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row gap-4 md:gap-6 group animate-in fade-in slide-in-from-bottom-4">
                    {/* Poster Container with fixed aspect ratio for mobile-first design */}
                    <div className="w-full md:w-32 lg:w-40 aspect-[2/3] shrink-0 bg-slate-100 rounded-2xl overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300 border border-slate-100 relative">
                      {rec.posterUrl ? (
                        <img 
                          src={rec.posterUrl} 
                          alt={`${rec.title} poster`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-4">
                          <ImageIcon size={24} className="mb-2 animate-pulse" />
                          <span className="text-[10px] font-bold tracking-widest uppercase">Painting...</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col justify-center space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg md:text-xl text-slate-800 leading-tight">{rec.title}</h3>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 shrink-0">
                          {rec.year}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm md:text-base leading-relaxed italic">
                        "{rec.why}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={reset}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 mt-4"
              >
                <Search size={16} /> New Search
              </button>
            </div>
          )}

        </div>

        <footer className="mt-12 text-center text-slate-400 text-xs md:text-sm">
          <p>Powered by Gemini & Imagen • Cinematic Contextual Engine</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
