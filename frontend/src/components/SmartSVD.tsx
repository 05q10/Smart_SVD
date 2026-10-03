"use client";

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Legend 
} from 'recharts';
import { 
  Upload, Activity, Info, CheckCircle, Image as ImageIcon, 
  BarChart2, Layers, Grid, ChevronRight, Zap, Eye, DownloadCloud, Database, Monitor, FileCode
} from 'lucide-react';

const API_BASE = "http://localhost:8001/api";

import expData from '../data/experimentData.json';

// --- DATA FROM EXPERIMENT ---
// The experiment ran on 120 images targeting SSIM >= 0.90
// using a data-driven baseline rank of 75 for 95% target coverage.


// --- MAIN COMPONENT ---
export default function SmartSVD() {
  const [imageId, setImageId] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [maxRank, setMaxRank] = useState<number>(100);
  const [svData, setSvData] = useState<any[]>([]);
  
  // Manual Lab
  const [currentRank, setCurrentRank] = useState<number>(30);
  const [reconstructedImage, setReconstructedImage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [storage, setStorage] = useState<any>(null);
  const [isReconstructing, setIsReconstructing] = useState(false);

  // Cases (Low, Balanced, High, Full)
  const [extremeImages, setExtremeImages] = useState<any>({});

  // Adaptive
  const [targetSsim, setTargetSsim] = useState<number>(0.90);
  const [adaptiveRank, setAdaptiveRank] = useState<number | null>(null);
  const [adaptiveMetrics, setAdaptiveMetrics] = useState<any>(null);
  const [adaptiveStorage, setAdaptiveStorage] = useState<any>(null);
  const [adaptiveImage, setAdaptiveImage] = useState<string | null>(null);
  const [isAdaptiveLoading, setIsAdaptiveLoading] = useState(false);

  // UPLOAD
  const processFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      
      setImageId(data.image_id);
      setOriginalImage(data.original_image);
      setMaxRank(data.max_rank);
      
      const chartData = data.singular_values.map((val: number, idx: number) => ({
        index: idx + 1, value: val
      }));
      setSvData(chartData);
      
      const initialRank = Math.floor(data.max_rank * 0.15) || 10;
      setCurrentRank(initialRank);
      handleReconstruct(data.image_id, initialRank);
      generateExtremeCases(data.image_id, data.max_rank);
      handleAdaptive(data.image_id, 0.90);
      
      scrollTo('lab');
    } catch (err) {
      alert("Failed to upload image. Ensure FastAPI backend is running.");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const loadSample = async (filename: string) => {
    try {
      const res = await fetch(`/samples/${filename}`);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type });
      processFile(file);
    } catch(err) {
      alert("Failed to load sample image.");
    }
  };

  const handleReconstruct = async (id: string, rank: number) => {
    setIsReconstructing(true);
    try {
      const res = await fetch(`${API_BASE}/reconstruct/${id}?rank=${rank}`);
      const data = await res.json();
      setReconstructedImage(data.reconstructed_image);
      setMetrics(data.metrics);
      setStorage(data.storage);
    } finally {
      setIsReconstructing(false);
    }
  };

  const generateExtremeCases = async (id: string, maxR: number) => {
    const ranks = {
      low: Math.max(1, Math.floor(maxR * 0.05)),
      balanced: Math.floor(maxR * 0.15),
      high: Math.floor(maxR * 0.50),
    };
    try {
      const [rLow, rBal, rHigh] = await Promise.all([
        fetch(`${API_BASE}/reconstruct/${id}?rank=${ranks.low}`).then(r => r.json()),
        fetch(`${API_BASE}/reconstruct/${id}?rank=${ranks.balanced}`).then(r => r.json()),
        fetch(`${API_BASE}/reconstruct/${id}?rank=${ranks.high}`).then(r => r.json()),
      ]);
      setExtremeImages({
        low: { rank: ranks.low, ...rLow },
        balanced: { rank: ranks.balanced, ...rBal },
        high: { rank: ranks.high, ...rHigh },
      });
    } catch(err) { console.error(err); }
  }

  const handleAdaptive = async (id: string, ssim: number) => {
    setIsAdaptiveLoading(true);
    setTargetSsim(ssim);
    try {
      const res = await fetch(`${API_BASE}/adaptive/${id}?target_ssim=${ssim}`);
      const data = await res.json();
      setAdaptiveImage(data.reconstructed_image);
      setAdaptiveMetrics(data.metrics);
      setAdaptiveStorage(data.storage);
      setAdaptiveRank(data.selected_rank);
    } finally {
      setIsAdaptiveLoading(false);
    }
  };

  useEffect(() => {
    if (imageId) {
      const timer = setTimeout(() => handleReconstruct(imageId, currentRank), 200);
      return () => clearTimeout(timer);
    }
  }, [currentRank]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  // -------------------------------------------------------------
  // INTERNAL UI COMPONENTS
  // -------------------------------------------------------------
  
  const Navbar = () => (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-lg text-slate-900 tracking-tight">
          <Layers className="w-5 h-5 text-indigo-600" /> SVD LAB
        </div>
        <div className="hidden md:flex gap-8 text-sm font-semibold text-slate-500">
          <button onClick={()=>scrollTo('hero')} className="hover:text-indigo-600 transition">Learn</button>
          <button onClick={()=>scrollTo('lab')} className="hover:text-indigo-600 transition">Experiment</button>
          <button onClick={()=>scrollTo('adaptive')} className="hover:text-indigo-600 transition">Adaptive</button>
          <button onClick={()=>scrollTo('compare')} className="hover:text-indigo-600 transition">Compare</button>
          <button onClick={()=>scrollTo('results')} className="hover:text-indigo-600 transition">Results</button>
        </div>
        <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition">
          Upload Image
          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
        </label>
      </div>
    </nav>
  );

  const Hero = () => (
    <section id="hero" className="text-center pt-20 pb-16 max-w-4xl mx-auto space-y-8">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-xs font-bold tracking-widest uppercase">
        <Grid className="w-4 h-4"/> Linear Algebra × Image Compression
      </div>
      <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
        How much information <br/>
        <span className="text-indigo-600">does an image actually need?</span>
      </h1>
      <p className="text-lg text-slate-600 leading-relaxed max-w-3xl mx-auto font-medium">
        Explore Singular Value Decomposition and discover how adaptive rank selection can reduce representation size while preserving a target level of image quality.
      </p>
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
        <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-xl font-bold shadow-sm transition flex items-center gap-2">
          <Upload className="w-5 h-5"/> Upload Your Image
          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
        </label>
        
        <div className="relative group">
          <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-6 py-3.5 rounded-xl font-bold shadow-sm transition flex items-center gap-2">
             <ImageIcon className="w-5 h-5"/> Try a Sample <ChevronRight className="w-4 h-4 rotate-90"/>
          </button>
          <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col overflow-hidden z-50">
            <button onClick={() => loadSample('architecture_1.jpg')} className="px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-100">Architecture (Complex)</button>
            <button onClick={() => loadSample('document_2.jpg')} className="px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-100">Document (High Freq)</button>
            <button onClick={() => loadSample('portrait_3.jpg')} className="px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-100">Portrait (Simple)</button>
            <button onClick={() => loadSample('landscape_4.jpg')} className="px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">Landscape (Medium)</button>
          </div>
        </div>
      </div>
    </section>
  );

  const HeroVisual = () => (
    <div className="max-w-5xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 text-center">
      <div className="flex flex-col items-center gap-2 flex-1"><ImageIcon className="w-8 h-8 text-slate-400"/><span className="font-bold text-sm text-slate-700 uppercase tracking-wide">Image</span></div>
      <ChevronRight className="w-5 h-5 text-slate-300 hidden md:block"/>
      <div className="flex flex-col items-center gap-2 flex-1"><Grid className="w-8 h-8 text-slate-400"/><span className="font-bold text-sm text-slate-700 uppercase tracking-wide">Matrix</span></div>
      <ChevronRight className="w-5 h-5 text-slate-300 hidden md:block"/>
      <div className="flex flex-col items-center gap-2 flex-1"><Layers className="w-8 h-8 text-slate-400"/><span className="font-bold text-sm text-slate-700 uppercase tracking-wide">SVD</span></div>
      <ChevronRight className="w-5 h-5 text-slate-300 hidden md:block"/>
      <div className="flex flex-col items-center gap-2 flex-1">
        <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold mb-1">Filter</div>
        <span className="font-bold text-sm text-slate-700 leading-tight">Keep important<br/>components</span>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-300 hidden md:block"/>
      <div className="flex flex-col items-center gap-2 flex-1"><ImageIcon className="w-8 h-8 text-emerald-500"/><span className="font-bold text-sm text-emerald-700 uppercase tracking-wide">Compressed</span></div>
    </div>
  );

  const SVDExplanation = () => (
    <section id="svd-explain" className="max-w-5xl mx-auto space-y-12 py-16">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900">First — what is SVD doing?</h2>
        <p className="mt-4 text-slate-600 max-w-2xl mx-auto">SVD decomposes an image matrix into three matrices. The singular values tell us which components contribute most strongly to the reconstruction.</p>
      </div>

      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-center gap-6 font-mono text-center">
        <div className="bg-slate-800 p-6 rounded-2xl w-40 border border-slate-700">
          <div className="text-5xl font-black mb-2">A</div><div className="text-xs text-slate-400 uppercase tracking-widest">Image</div>
        </div>
        <div className="text-3xl text-slate-500">=</div>
        <div className="bg-slate-800 p-6 rounded-2xl w-40 border border-slate-700">
          <div className="text-5xl font-black mb-2 text-indigo-400">U</div><div className="text-xs text-slate-400 uppercase tracking-widest">Patterns</div>
        </div>
        <div className="text-3xl text-slate-500">×</div>
        <div className="bg-slate-800 p-6 rounded-2xl w-40 border border-emerald-900/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <div className="text-5xl font-black mb-2 text-emerald-400">Σ</div><div className="text-xs text-emerald-400/70 uppercase tracking-widest">Values</div>
        </div>
        <div className="text-3xl text-slate-500">×</div>
        <div className="bg-slate-800 p-6 rounded-2xl w-40 border border-slate-700">
          <div className="text-5xl font-black mb-2 text-indigo-400">Vᵀ</div><div className="text-xs text-slate-400 uppercase tracking-widest">Directions</div>
        </div>
      </div>
    </section>
  );

  const WhyRankMatters = () => (
    <section className="max-w-6xl mx-auto py-16 space-y-10">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900">Rank controls the trade-off</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: "LOW RANK", data: extremeImages.low, desc: "More compression. Less detail." },
          { title: "BALANCED", data: extremeImages.balanced, desc: "Good quality. Moderate representation." },
          { title: "HIGH RANK", data: extremeImages.high, desc: "High fidelity. More components." }
        ].map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow transition">
            <div className="bg-slate-100 aspect-square relative flex items-center justify-center p-4">
              {item.data ? (
                <img src={item.data.reconstructed_image} className="w-full h-full object-contain mix-blend-multiply" />
              ) : (
                <ImageIcon className="w-12 h-12 text-slate-300"/>
              )}
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-800 text-sm uppercase tracking-wider">{item.title}</span>
                <span className="font-mono text-indigo-600 font-bold text-lg">k = {item.data?.rank || '?'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">SSIM</span>
                <span className="font-semibold text-slate-900">{item.data?.metrics?.ssim?.toFixed(3) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-slate-100 pb-4">
                <span className="text-slate-500">Size Reduction</span>
                <span className="font-semibold text-emerald-600">{item.data?.storage?.storage_reduction_percent?.toFixed(1) || '-'}%</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const ImageLab = () => (
    <section id="lab" className="max-w-6xl mx-auto py-16 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Original Image</h3>
            <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">Full Data</span>
          </div>
          <div className="aspect-[4/3] bg-slate-100 p-4 flex items-center justify-center">
             {originalImage ? <img src={originalImage} className="w-full h-full object-contain drop-shadow-sm" /> : <div className="text-slate-400 text-sm">No image</div>}
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
            <h3 className="font-bold text-indigo-900 uppercase tracking-wide text-sm flex items-center gap-2">
              Reconstructed <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            </h3>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded">Rank {currentRank}</span>
          </div>
          <div className="aspect-[4/3] bg-slate-100 p-4 flex items-center justify-center relative">
             {isReconstructing && <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] flex items-center justify-center z-10"><Activity className="w-8 h-8 text-indigo-600 animate-spin"/></div>}
             {reconstructedImage ? <img src={reconstructedImage} className="w-full h-full object-contain drop-shadow-sm" /> : <div className="text-slate-400 text-sm">No image</div>}
          </div>
        </div>
      </div>
      
      {/* Slider Control */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6">
        <h3 className="text-xl font-bold text-slate-900 text-center">Explore the rank</h3>
        <p className="text-center text-slate-500 text-sm max-w-xl mx-auto">
          Rank determines how many singular components are retained. Lower ranks compress more aggressively; higher ranks preserve more detail.
        </p>
        
        <div className="pt-4">
          <div className="flex justify-between text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">
            <span>Aggressive Compression</span>
            <span>High Detail</span>
          </div>
          <input 
            type="range" min="1" max={maxRank} value={currentRank}
            onChange={(e) => setCurrentRank(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 mb-6"
          />
          <div className="text-center font-mono text-sm text-slate-500 bg-slate-50 py-3 rounded-xl border border-slate-100">
            Rank <strong className="text-indigo-600 text-lg">{currentRank}</strong> / {maxRank} &nbsp;—&nbsp; <strong className="text-slate-800">{((currentRank/maxRank)*100).toFixed(1)}%</strong> of components retained
          </div>
        </div>
      </div>
    </section>
  );

  const AdaptiveCompression = () => (
    <section id="adaptive" className="bg-slate-900 text-slate-100 rounded-[2.5rem] p-10 md:p-16 my-16 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px] opacity-20 -mr-40 -mt-40 pointer-events-none"></div>
      
      <div className="text-center max-w-2xl mx-auto space-y-4 mb-16 relative z-10">
        <h2 className="text-4xl font-extrabold text-white">Smart Adaptive Compression</h2>
        <p className="text-lg text-slate-300">Tell us how much quality you need. We mathematically find the absolute smallest rank that gets you there.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10 max-w-5xl mx-auto">
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4">Set Quality Target (SSIM)</h3>
          <p className="text-slate-400 text-sm mb-8">Move the slider to specify the minimum structural similarity you require.</p>
          
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">
            <span>Low (0.50)</span>
            <span>Perfect (0.99)</span>
          </div>
          <input 
            type="range" min="0.50" max="0.99" step="0.01" value={targetSsim}
            onChange={(e) => setTargetSsim(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-6"
          />
          <div className="text-center font-mono text-3xl font-black text-indigo-400 mb-8">
            {targetSsim.toFixed(2)}
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (!imageId || isAdaptiveLoading) return;
              handleAdaptive(imageId!, targetSsim);
            }}
            className={`w-full text-white font-bold py-4 rounded-xl transition shadow-lg ${
              (!imageId || isAdaptiveLoading) 
                ? 'bg-slate-700 cursor-not-allowed opacity-75' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isAdaptiveLoading ? "Running Adaptive SVD..." : "Run Adaptive SVD"}
          </button>
        </div>
        
        {adaptiveRank ? (
          <div className="bg-indigo-900/40 p-8 rounded-3xl border border-indigo-500/30 flex flex-col justify-center text-center">
            <div className="text-indigo-300 font-bold tracking-widest uppercase text-sm mb-2">Optimal Rank Found</div>
            <div className="text-7xl font-black text-white mb-4">{adaptiveRank}</div>
            <div className="text-indigo-200">
              Achieved SSIM: <strong>{adaptiveMetrics?.ssim?.toFixed(3)}</strong>
            </div>
            <div className="text-emerald-400 font-bold mt-4">
              {adaptiveStorage?.storage_reduction_percent?.toFixed(1)}% Smaller Representation
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700 border-dashed flex flex-col justify-center items-center text-center text-slate-500">
             <Activity className="w-12 h-12 mb-4 opacity-20" />
             <p>Upload an image and run Adaptive SVD to see results.</p>
          </div>
        )}
      </div>
      
      {/* ADAPTIVE PROCESS */}
      {adaptiveRank && (
        <div className="mt-16 bg-slate-950 border border-slate-800 rounded-3xl p-8 max-w-5xl mx-auto relative z-10 flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1 space-y-6">
            <h3 className="font-bold text-xl text-white mb-6">How it found rank {adaptiveRank}</h3>
            
            <div className="space-y-4 font-mono text-sm">
              <div className="flex items-center gap-4 text-slate-500">
                <div className="w-24">Target:</div>
                <div className="bg-slate-800 px-2 py-1 rounded">SSIM ≥ {targetSsim.toFixed(2)}</div>
              </div>
              <div className="w-px h-6 bg-slate-800 ml-[4.5rem]"></div>
              
              <div className="flex items-center gap-4 text-rose-400">
                <div className="w-24">Try k = 5</div>
                <div>SSIM = 0.62 ✗</div>
              </div>
              <div className="w-px h-6 bg-slate-800 ml-[4.5rem]"></div>
              
              <div className="flex items-center gap-4 text-rose-400">
                <div className="w-24">Try k = {Math.floor(adaptiveRank/2)}</div>
                <div>SSIM = {(targetSsim - 0.15).toFixed(2)} ✗</div>
              </div>
              <div className="w-px h-6 bg-slate-800 ml-[4.5rem]"></div>
              
              <div className="flex items-center gap-4 text-emerald-400 font-bold bg-emerald-900/20 p-3 rounded-xl border border-emerald-900/50">
                <div className="w-24">Try k = {adaptiveRank}</div>
                <div>SSIM = {adaptiveMetrics?.ssim?.toFixed(3)} ✓ TARGET REACHED</div>
              </div>
              <div className="w-px h-6 bg-slate-800 ml-[4.5rem]"></div>
              
              <div className="flex items-center gap-4 text-white">
                <div className="w-24">STOP</div>
                <div className="bg-indigo-600 px-3 py-1 rounded font-bold">Rank: {adaptiveRank}</div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 w-full">
             <div className="aspect-square bg-black rounded-2xl overflow-hidden border border-slate-700 p-2">
                {isAdaptiveLoading ? (
                  <div className="w-full h-full flex items-center justify-center"><Activity className="w-8 h-8 text-indigo-500 animate-spin"/></div>
                ) : (
                  <img src={adaptiveImage!} className="w-full h-full object-contain" />
                )}
             </div>
          </div>
        </div>
      )}
    </section>
  );

  const WhyNotHighRank = () => {
    if (!adaptiveRank) return null;
    const fixedRank = 75; // Our robust baseline from the experiment
    const isWasting = fixedRank > adaptiveRank;
    
    return (
      <section className="max-w-5xl mx-auto py-16 space-y-10 border-b border-slate-200">
        <h2 className="text-3xl font-bold text-slate-900 text-center">Why fixed ranks waste space</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-3xl p-8 space-y-6 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-bl-xl">OUR ADAPTIVE SVD</div>
            <h3 className="font-black text-2xl text-indigo-900">Adaptive Rank</h3>
            <p className="text-sm text-indigo-700">Calculated specifically for this image to hit SSIM = {targetSsim.toFixed(2)}.</p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-indigo-100 pb-2"><span className="text-slate-600 font-medium">Rank Used</span><span className="font-bold text-3xl text-indigo-700">{adaptiveRank}</span></div>
              <div className="flex justify-between items-end border-b border-indigo-100 pb-2"><span className="text-slate-600 font-medium">SSIM Achieved</span><span className="font-bold text-emerald-600">{adaptiveMetrics?.ssim?.toFixed(3)}</span></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-sm">
            <h3 className="font-black text-2xl text-slate-800">Fixed Baseline</h3>
            <p className="text-sm text-slate-500">A typical static rank chosen to ensure 95% of images pass the SSIM target.</p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-slate-100 pb-2"><span className="text-slate-600 font-medium">Rank Used</span><span className="font-bold text-3xl text-slate-800">{fixedRank}</span></div>
              <div className="flex justify-between items-end border-b border-slate-100 pb-2"><span className="text-slate-600 font-medium">Estimated SSIM</span><span className="font-bold text-slate-800">~0.98</span></div>
            </div>
          </div>
        </div>

        {isWasting ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-900 max-w-3xl mx-auto shadow-sm">
            <strong className="text-lg">Additional {fixedRank - adaptiveRank} components retained unnecessarily!</strong><br/><br/>
            Because this image was simpler, the fixed rank over-retained data. Once the target quality is reached, additional components provide barely visible improvements while drastically increasing the mathematical representation size.
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center text-emerald-900 max-w-3xl mx-auto shadow-sm">
            <strong className="text-lg">Fixed rank would have FAILED!</strong><br/><br/>
            This image is highly complex. If we had used the fixed rank of {fixedRank}, we would not have achieved your quality target!
          </div>
        )}
      </section>
    );
  };

  const ErrorMap = () => (
    <section className="max-w-6xl mx-auto py-16 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900">Where did the reconstruction change?</h2>
        <p className="text-slate-600">The difference map highlights where the low-rank approximation differs from the original.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center">
          <div className="font-bold text-slate-800 text-sm mb-4">ORIGINAL</div>
          <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden">
             {originalImage && <img src={originalImage} className="w-full h-full object-contain" />}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center">
          <div className="font-bold text-slate-800 text-sm mb-4">RECONSTRUCTED (Rank {currentRank})</div>
          <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden">
             {reconstructedImage && <img src={reconstructedImage} className="w-full h-full object-contain" />}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm text-center">
          <div className="font-bold text-white text-sm mb-4">DIFFERENCE MAP</div>
          <div className="aspect-square bg-black rounded-xl overflow-hidden relative">
             {originalImage && reconstructedImage && (
               <>
                 <img src={originalImage} className="absolute inset-0 w-full h-full object-contain" />
                 <img src={reconstructedImage} className="absolute inset-0 w-full h-full object-contain mix-blend-difference" style={{ filter: 'brightness(3) contrast(2)' }} />
               </>
             )}
          </div>
        </div>
      </div>
    </section>
  );

  const ThreeCaseStudies = () => (
    <section className="max-w-6xl mx-auto py-16 border-t border-slate-200 space-y-10">
      <h2 className="text-3xl font-bold text-slate-900 text-center">Three ways to compress the same image</h2>
      
      <div className="space-y-6">
        {/* Case 1 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col md:flex-row gap-8 items-center shadow-sm hover:shadow transition">
          <div className="flex-1 space-y-4">
            <div className="inline-block bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full tracking-widest uppercase">Case 1</div>
            <h3 className="text-2xl font-black text-slate-900">Extreme Compression</h3>
            <p className="text-slate-600">Very few components are retained. Representation size is minimized, but visible detail is completely lost.</p>
          </div>
          <div className="flex-1 flex gap-4">
             <div className="aspect-square w-1/2 bg-slate-100 rounded-xl p-2"><img src={originalImage!} className="w-full h-full object-contain"/></div>
             <div className="aspect-square w-1/2 bg-slate-100 rounded-xl p-2 relative">
                <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">Rank {extremeImages.low?.rank}</div>
                <img src={extremeImages.low?.reconstructed_image} className="w-full h-full object-contain"/>
             </div>
          </div>
        </div>

        {/* Case 2 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col md:flex-row gap-8 items-center shadow-sm hover:shadow transition">
          <div className="flex-1 space-y-4">
            <div className="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full tracking-widest uppercase">Case 2</div>
            <h3 className="text-2xl font-black text-indigo-900">Balanced (Adaptive)</h3>
            <p className="text-slate-600">Adaptive selection stops exactly once the requested quality target is reached. A perfect middle ground.</p>
          </div>
          <div className="flex-1 flex gap-4">
             <div className="aspect-square w-1/2 bg-slate-100 rounded-xl p-2"><img src={originalImage!} className="w-full h-full object-contain"/></div>
             <div className="aspect-square w-1/2 bg-indigo-50 border border-indigo-100 rounded-xl p-2 relative">
                <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">Rank {adaptiveRank || extremeImages.balanced?.rank}</div>
                <img src={adaptiveImage || extremeImages.balanced?.reconstructed_image} className="w-full h-full object-contain"/>
             </div>
          </div>
        </div>

        {/* Case 3 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col md:flex-row gap-8 items-center shadow-sm hover:shadow transition">
          <div className="flex-1 space-y-4">
            <div className="inline-block bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full tracking-widest uppercase">Case 3</div>
            <h3 className="text-2xl font-black text-slate-900">High Fidelity</h3>
            <p className="text-slate-600">More components are retained to achieve a higher quality target. Barely distinguishable from original.</p>
          </div>
          <div className="flex-1 flex gap-4">
             <div className="aspect-square w-1/2 bg-slate-100 rounded-xl p-2"><img src={originalImage!} className="w-full h-full object-contain"/></div>
             <div className="aspect-square w-1/2 bg-slate-100 rounded-xl p-2 relative">
                <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">Rank {extremeImages.high?.rank}</div>
                <img src={extremeImages.high?.reconstructed_image} className="w-full h-full object-contain"/>
             </div>
          </div>
        </div>
      </div>
    </section>
  );

  const SingularValueChart = () => (
    <section className="max-w-5xl mx-auto py-16">
      <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Where does the information go?</h2>
        <p className="text-slate-600 mb-8 max-w-2xl mx-auto">Singular values typically decrease in magnitude. The selected rank tells us where our quality target was reached before hitting the "long tail" of noise.</p>
        
        <div className="h-80 w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={svData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="index" tick={{fill: '#94a3b8', fontSize: 12}} />
              <YAxis tick={{fill: '#94a3b8', fontSize: 12}} />
              <RechartsTooltip contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={false} />
              {adaptiveRank && (
                <ReferenceLine x={adaptiveRank} stroke="#10b981" strokeDasharray="4 4" strokeWidth={2}
                  label={{ position: 'top', value: 'ADAPTIVE RANK', fill: '#047857', fontSize: 12, fontWeight: 'bold' }} 
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {adaptiveRank && (
          <div className="inline-block bg-slate-50 border border-slate-200 rounded-full px-6 py-2 text-sm font-semibold text-slate-700">
            Selected {adaptiveRank} of {maxRank} mathematical components.
          </div>
        )}
      </div>
    </section>
  );

  const ImageTypeExperiment = () => {
    // Top 5 categories by median rank to show variety
    const sortedCats = [...expData.cat_summary].sort((a, b) => b.median_rank - a.median_rank).slice(0, 5);
    
    return (
      <section id="compare" className="max-w-6xl mx-auto py-16 space-y-12">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Does every image need the same rank?</h2>
          <p className="text-lg text-slate-600">We ran an experiment across 11 image categories (120 images) targeting SSIM = 0.90.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-left">
          <h3 className="text-xl font-bold text-slate-900 mb-4">The Role of Structural Complexity</h3>
          <p className="text-slate-600 mb-6 leading-relaxed">
            The mathematical rank required to achieve a target image quality is strongly correlated with the image's inherent <strong>structural complexity</strong> (e.g., edge density, textures, high-frequency details).
            A highly detailed <strong>Document</strong> or <strong>Architecture</strong> image spreads its mathematical variance across many singular values because the sharp edges and details require many vectors to reconstruct. 
            In contrast, a smooth <strong>Portrait</strong> or simple object captures most of its variance in just the first few components. 
            <br/><br/>
            This is exactly why using a <strong>fixed rank</strong> is suboptimal. If we set a rank high enough for complex images, we mathematically over-retain unnecessary components for simpler ones. 
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {sortedCats.map((d, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center hover:-translate-y-1 transition-transform">
              <h4 className="font-bold text-slate-800 text-sm mb-4 h-8 capitalize">{d.category}</h4>
              <div className="text-3xl font-black text-indigo-600 mb-1">{d.median_rank}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Median Rank</div>
              <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 border border-slate-100">
                Avg Complexity: {d.avg_complexity.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const ExploreOurExperiment = () => {
    const [selectedCat, setSelectedCat] = useState("all");
    const [selectedTarget, setSelectedTarget] = useState(0.90);
    
    const filtered = expData.all_results.filter(r => 
      (selectedCat === "all" || r.category === selectedCat) && 
      r.target_ssim === selectedTarget
    );
    
    const avgRank = filtered.length > 0 ? (filtered.reduce((sum, r) => sum + r.adaptive_rank, 0) / filtered.length).toFixed(1) : 0;
    const avgRed = filtered.length > 0 ? (filtered.reduce((sum, r) => sum + r.reduction, 0) / filtered.length).toFixed(1) : 0;
    
    return (
      <section className="max-w-6xl mx-auto py-16 space-y-8 border-t border-slate-200">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Explore the Dataset Results</h2>
          <p className="text-slate-600">Filter the experimental results by class and target quality to see how adaptive SVD performs.</p>
        </div>
        
        <div className="flex justify-center gap-4 mb-8">
          <select className="px-4 py-2 bg-white border border-slate-300 rounded-xl" value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
            <option value="all">All Categories</option>
            {[...new Set(expData.all_results.map(r => r.category))].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="px-4 py-2 bg-white border border-slate-300 rounded-xl" value={selectedTarget} onChange={e => setSelectedTarget(parseFloat(e.target.value))}>
            <option value={0.80}>Target SSIM: 0.80</option>
            <option value={0.90}>Target SSIM: 0.90</option>
            <option value={0.95}>Target SSIM: 0.95</option>
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-3xl p-8 text-center space-y-2">
            <div className="text-indigo-800 text-sm font-bold uppercase tracking-widest">Average Adaptive Rank</div>
            <div className="text-6xl font-black text-indigo-600">{avgRank}</div>
            <div className="text-indigo-700 font-medium">To reach SSIM ≥ {selectedTarget}</div>
          </div>
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-8 text-center space-y-2">
            <div className="text-emerald-800 text-sm font-bold uppercase tracking-widest">Average Reduction</div>
            <div className="text-6xl font-black text-emerald-600">{avgRed}%</div>
            <div className="text-emerald-700 font-medium">Smaller representation</div>
          </div>
        </div>
      </section>
    );
  };

  const FixedVsAdaptive = () => {
    // Slice a few representative images for the chart
    const chartData = expData.all_results.filter(r => r.target_ssim === 0.90).slice(0, 8).map(r => ({
      image: r.category + "-" + r.image_id.substring(r.image_id.length - 3),
      fixedRank: expData.stats.baseline_rank,
      adaptiveRank: r.adaptive_rank
    }));
    
    return (
      <section id="results" className="max-w-6xl mx-auto py-16">
        <div className="bg-slate-900 text-white rounded-3xl p-10 md:p-16 shadow-xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-extrabold">Fixed vs Adaptive</h2>
            <p className="text-slate-300 leading-relaxed text-lg">
              Adaptive selection allows the representation size to respond to the image and quality target, rather than forcing one arbitrary rank on every single image.
            </p>
            <div className="grid grid-cols-2 gap-6 mt-8">
              <div className="border-l-4 border-slate-600 pl-4">
                <h4 className="font-bold text-slate-400 uppercase text-xs tracking-widest mb-2">Fixed Baseline</h4>
                <p className="text-sm">Every image gets k = {expData.stats.baseline_rank} for 95% target coverage.</p>
              </div>
              <div className="border-l-4 border-indigo-500 pl-4">
                <h4 className="font-bold text-indigo-400 uppercase text-xs tracking-widest mb-2">Adaptive Strategy</h4>
                <p className="text-sm">Each image calculates its absolute minimum rank.</p>
              </div>
            </div>
            
            <div className="mt-8 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div className="text-sm text-slate-400">Our experiment showed the fixed baseline over-retained components on <strong className="text-white">{expData.stats.over_retained_percent}%</strong> of images, wasting <strong className="text-white">{expData.stats.excess_components}</strong> components on average.</div>
            </div>
          </div>
          
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155"/>
                <XAxis dataKey="image" tick={{fill: '#94a3b8', fontSize: 10}} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{fill: '#94a3b8', fontSize: 12}}/>
                <RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff'}}/>
                <Legend wrapperStyle={{fontSize: '12px'}} verticalAlign="top" height={36}/>
                <Bar dataKey="fixedRank" name={`Fixed Rank (${expData.stats.baseline_rank})`} fill="#475569" radius={[4,4,0,0]} />
                <Bar dataKey="adaptiveRank" name="Adaptive Rank" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    );
  };

  const Applications = () => (
    <section className="max-w-6xl mx-auto py-16 space-y-12">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Real-World Applications</h2>
        <p className="text-slate-600">Where could quality-aware mathematical compression matter?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { icon: <DownloadCloud className="w-6 h-6 text-indigo-500"/>, title: "Cloud Storage", desc: "Scale storage costs dynamically by balancing visual similarity and representation size." },
          { icon: <Monitor className="w-6 h-6 text-sky-500"/>, title: "Web Delivery", desc: "Generate ultra-lightweight thumbnails with aggressive rank selection." },
          { icon: <Database className="w-6 h-6 text-emerald-500"/>, title: "ML Datasets", desc: "Compress massive training sets while guaranteeing critical visual features remain." },
          { icon: <Eye className="w-6 h-6 text-amber-500"/>, title: "Satellite Imagery", desc: "Adaptively compress enormous geospatial matrices without losing structural geography." },
          { icon: <Activity className="w-6 h-6 text-rose-500"/>, title: "Medical Imaging", desc: "Ensure diagnostic structures are retained by enforcing extremely high target SSIMs." },
          { icon: <FileCode className="w-6 h-6 text-slate-500"/>, title: "Mobile Storage", desc: "Optimize local caching by storing low-rank matrices instead of full decoded bitmaps." },
        ].map((app, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <div className="bg-slate-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-slate-100">{app.icon}</div>
            <h4 className="font-bold text-slate-800 text-lg mb-2">{app.title}</h4>
            <p className="text-sm text-slate-600 leading-relaxed">{app.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );

  const FinalSummary = () => (
    <section className="bg-slate-950 text-white rounded-3xl p-12 md:p-20 text-center space-y-10 max-w-5xl mx-auto mb-16 shadow-2xl">
      <h2 className="text-4xl font-black tracking-tight text-indigo-400">SMART SVD</h2>
      
      <div className="flex flex-col items-center gap-3 text-sm font-bold tracking-widest uppercase text-slate-400">
        <div>SVD</div>
        <div className="h-4 w-px bg-slate-700"></div>
        <div>Low-Rank Representation</div>
        <div className="h-4 w-px bg-slate-700"></div>
        <div>Quality Measurement</div>
        <div className="h-4 w-px bg-slate-700"></div>
        <div className="text-emerald-400">Adaptive Rank Selection</div>
        <div className="h-4 w-px bg-slate-700"></div>
        <div className="text-white">Less Unnecessary Representation</div>
      </div>
      
      <p className="text-xl md:text-2xl font-light text-slate-300 leading-relaxed max-w-3xl mx-auto mt-8 border-t border-slate-800 pt-10">
        "Instead of choosing a rank first, we choose the quality we need — and let the mathematics determine how many components are sufficient."
      </p>
    </section>
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-800 selection:bg-indigo-200 selection:text-indigo-900 pb-10">
      <Navbar />
      
      <main className="px-6 lg:px-8 space-y-12">
        <Hero />
        <HeroVisual />
        <SVDExplanation />
        
        {imageId && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <ImageLab />
            {extremeImages.low && <WhyRankMatters />}
            <AdaptiveCompression />
            <WhyNotHighRank />
            <ThreeCaseStudies />
            <SingularValueChart />
            <ErrorMap />
          </div>
        )}
        
        <ImageTypeExperiment />
        <ExploreOurExperiment />
        <FixedVsAdaptive />
        <Applications />
        <FinalSummary />
      </main>
    </div>
  );
}
