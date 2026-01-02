import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDoc,
  query 
} from 'firebase/firestore';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip 
} from 'recharts';
import { 
  Plus, History, LayoutDashboard, Trophy, LogOut, Zap, User, Lock, Activity, TrendingDown 
} from 'lucide-react';
import { auth, googleProvider, db } from './firebase';

// --- Configurações ---
const APP_ID = 'tirzeflow-pro';
const ALTURA_PADRAO = 1.65; [span_1](start_span)//[span_1](end_span)

export default function App() {
  const [user, setUser] = useState(null);
  const [isAllowed, setIsAllowed] = useState(false); // Controle de Whitelist
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [records, setRecords] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);
  
  // Estado do Formulário
  const [formData, setFormData] = useState({
    semana: 1,
    peso: '',
    data: new Date().toISOString().split('T')[0]
  });

  // --- Lógica de Negócio (Baseada no PDF) ---
  const calcularDose = (semana) => semana <= 4 ? 2.5 : 5.0; [span_2](start_span)//[span_2](end_span)
  const calcularIMC = (peso) => (peso / (ALTURA_PADRAO * ALTURA_PADRAO)).toFixed(2); [span_3](start_span)//[span_3](end_span)

  // --- Autenticação e Verificação de Permissão ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      if (u) {
        // Verifica se o usuário está na "whitelist" (lista de permitidos)
        // Aqui simulamos verificando se existe um documento na coleção 'users' ou 'whitelist'
        // Para simplificar: O primeiro acesso cria o registro se não houver restrição rígida no Firestore Rules
        // No cenário ideal, você criaria manualmente o documento do usuário no banco antes dele logar.
        
        const userRef = doc(db, 'artifacts', APP_ID, 'users', u.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() || u.email) { 
           // Se quiser restringir, mude a lógica aqui para checar uma lista específica
           setUser(u);
           setIsAllowed(true); 
        } else {
           setError("Usuário não autorizado. Contate o administrador.");
           await signOut(auth);
        }
      } else {
        setUser(null);
        setIsAllowed(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Listeners de Dados (Firestore) ---
  useEffect(() => {
    if (!user || !isAllowed) return;

    // 1. Meus Registros
    const qRecords = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'tracking'));
    const unsubRecords = onSnapshot(qRecords, (snap) => {
      const data = snap.docs.map(d => d.data());
      const sorted = data.sort((a, b) => a.semana - b.semana);
      setRecords(sorted);
      
      // Atualiza formulário para próxima semana automaticamente
      if (sorted.length > 0) {
        setFormData(prev => ({
          ...prev, 
          semana: sorted.length + 1,
          peso: ''
        }));
      }
    });

    // 2. Ranking Global
    const qRank = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'ranking'));
    const unsubRank = onSnapshot(qRank, (snap) => {
      const data = snap.docs.map(d => d.data());
      // Ordenar por maior perda de peso
      setRanking(data.sort((a, b) => b.totalPerdido - a.totalPerdido));
    });

    return () => { unsubRecords(); unsubRank(); };
  }, [user, isAllowed]);

  // --- Handlers ---
  const handleLogin = async () => {
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError("Erro ao conectar com Google.");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const pesoNum = parseFloat(formData.peso);
    const imc = calcularIMC(pesoNum); [span_4](start_span)//[span_4](end_span)
    const dose = calcularDose(formData.semana);
    
    const record = { 
      ...formData, 
      peso: pesoNum, 
      imc, 
      dose,
      updatedAt: new Date().toISOString() 
    };

    try {
      // 1. Salvar Registro Histórico
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'tracking', `sem-${formData.semana}`), record);
      
      // 2. Atualizar Perfil no Ranking
      // Pega o peso inicial (primeiro registro ou o atual se for o primeiro)
      const pesoInicial = records.length > 0 ? records[0].peso : pesoNum;
      const totalPerdido = parseFloat((pesoInicial - pesoNum).toFixed(1));

      // Cria/Atualiza documento público do usuário
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'ranking', user.uid), {
        uid: user.uid,
        nome: user.displayName,
        foto: user.photoURL,
        pesoAtual: pesoNum,
        pesoInicial: pesoInicial,
        totalPerdido: totalPerdido > 0 ? totalPerdido : 0,
        ultimaAtualizacao: new Date().toISOString()
      });

      // Se for o primeiro acesso, cria o documento de "User" para garantir acesso futuro
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid), {
        email: user.email,
        lastLogin: new Date().toISOString()
      }, { merge: true });
      
      setIsModalOpen(false);
      setFormData(prev => ({ ...prev, peso: '' }));
    } catch (e) {
      console.error(e);
      setError("Erro ao salvar dados. Verifique sua conexão.");
    }
  };

  // --- Renderização ---

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <span className="text-xs font-bold text-slate-400 animate-pulse">CARREGANDO...</span>
    </div>
  );

  // Tela de Login (Google)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
        <div className="bg-blue-600 p-4 rounded-2xl mb-6 shadow-lg shadow-blue-200">
           <Activity className="text-white w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black mb-2 text-slate-900 tracking-tight">Tirze<span className="text-blue-600">Flow</span></h1>
        <p className="text-slate-400 text-sm mb-12 text-center max-w-[250px]">
          App exclusivo para controle de peso e ranking de performance.
        </p>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-xl text-xs font-bold mb-6 flex items-center gap-2">
            <Lock size={14} /> {error}
          </div>
        )}

        <button 
          onClick={handleLogin} 
          className="w-full max-w-xs bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
          Entrar com Google
        </button>
        <p className="mt-6 text-[10px] text-slate-300 uppercase tracking-widest font-bold">Acesso Restrito</p>
      </div>
    );
  }

  const pesoAtual = records.length > 0 ? records[records.length-1].peso : 0;
  const pesoInicial = records.length > 0 ? records[0].peso : pesoAtual;
  const perdaTotal = (pesoInicial - pesoAtual).toFixed(1);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-28 relative">
      {/* Header */}
      <header className="bg-white px-6 py-5 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full border-2 border-slate-100" />
          <div>
            <p className="font-bold text-slate-900 text-sm leading-tight">{user.displayName}</p>
            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Semana {records.length + 1}</p>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="bg-slate-50 p-2 rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
          <LogOut size={18} />
        </button>
      </header>

      <main className="p-5 space-y-6">
        {activeTab === 'dashboard' && (
          <>
            {/* Cards de Resumo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                   <Activity size={60} />
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-widest">Peso Atual</p>
                <div className="text-3xl font-black text-slate-800">
                  {pesoAtual || '--'} <span className="text-xs text-slate-400 font-medium">kg</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                   <span className="text-[10px] font-bold text-blue-600">Dose: {calcularDose(records.length + 1)}mg</span>
                </div>
              </div>

              <div className="bg-slate-900 p-5 rounded-3xl text-white shadow-lg shadow-slate-200 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-3 opacity-10">
                   <TrendingDown size={60} />
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-widest">Eliminado</p>
                <div className="text-3xl font-black text-emerald-400">
                  -{perdaTotal} <span className="text-xs text-slate-500 font-medium">kg</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-400">
                  Desde o início
                </div>
              </div>
            </div>

            {/* Gráfico */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 h-64 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                <Activity size={14} /> Evolução
              </h3>
              {records.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={records}>
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="semana" hide />
                    <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      labelFormatter={(l) => `Semana ${l}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="peso" 
                      stroke="#2563eb" 
                      strokeWidth={3} 
                      fill="url(#colorWeight)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs text-center">
                  <Zap className="mb-2 opacity-50" />
                  Registre +2 semanas para ver o gráfico
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'ranking' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-yellow-500 to-amber-600 p-6 rounded-3xl text-white shadow-lg shadow-amber-200">
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="text-yellow-100" size={24} />
                <h2 className="font-black italic text-xl">Leaderboard</h2>
              </div>
              <p className="text-xs text-yellow-100 opacity-90">Competição saudável! Veja quem eliminou mais peso total até agora.</p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
              {ranking.map((player, index) => (
                <div 
                  key={player.uid} 
                  className={`flex items-center justify-between p-4 border-b border-slate-50 last:border-0 ${player.uid === user.uid ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                      index === 1 ? 'bg-slate-100 text-slate-700' : 
                      index === 2 ? 'bg-orange-100 text-orange-700' : 
                      'bg-slate-50 text-slate-400'
                    }`}>
                      {index + 1}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {player.foto ? (
                         <img src={player.foto} className="w-8 h-8 rounded-full bg-slate-200" />
                      ) : (
                         <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center"><User size={14}/></div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-slate-800 leading-none">{player.uid === user.uid ? 'Você' : player.nome.split(' ')[0]}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {player.pesoAtual}kg atual
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-xl text-xs font-black">
                      -{player.totalPerdido} kg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            <h2 className="font-bold text-slate-800 px-2">Histórico Completo</h2>
            {records.slice().reverse().map((rec) => (
              <div key={rec.semana} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-50 w-12 h-12 rounded-xl flex flex-col items-center justify-center border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase">SEM</span>
                    <span className="text-lg font-black text-slate-800">{rec.semana}</span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{rec.peso} kg</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      IMC {rec.imc} • {rec.dose}mg
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  {new Date(rec.data).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Button */}
      <button 
        onClick={() => setIsModalOpen(true)} 
        className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-200 flex items-center justify-center z-40 active:scale-90 transition-all hover:bg-blue-700"
      >
        <Plus size={28} />
      </button>

      {/* Navbar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-8 py-4 flex justify-between items-center z-30 pb-8">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-300'}`}>
          <LayoutDashboard size={24} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">Início</span>
        </button>
        <button onClick={() => setActiveTab('ranking')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'ranking' ? 'text-blue-600' : 'text-slate-300'}`}>
          <Trophy size={24} strokeWidth={activeTab === 'ranking' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">Ranking</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-300'}`}>
          <History size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">Histórico</span>
        </button>
      </nav>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800">Registrar Peso</h2>
                <p className="text-xs text-slate-400">Semana {formData.semana}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="bg-slate-100 p-2 rounded-full text-slate-400">
                <Plus className="rotate-45" size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Data do Registro</label>
                <input 
                  type="date" 
                  value={formData.data}
                  onChange={e => setFormData({...formData, data: e.target.value})}
                  className="w-full bg-slate-50 p-4 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Peso (kg)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1" 
                    placeholder="00.0"
                    value={formData.peso} 
                    onChange={e => setFormData({...formData, peso: e.target.value})} 
                    className="w-full bg-slate-50 p-4 rounded-xl font-black text-3xl text-slate-900 outline-none focus:ring-2 focus:ring-blue-100" 
                    autoFocus 
                    required 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">kg</span>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all">
                  Confirmar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
