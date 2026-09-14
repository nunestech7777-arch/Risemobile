import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck,
  KeyRound,
  ArrowLeft
} from 'lucide-react';
import { RiseMobileLogo } from '../common/RiseMobileLogo';
import { ShaderBackground } from '../ui/adisyon-shader';
import { AuthService } from '../../lib/authService';

export const LoginScreen = ({
  onLoginSuccess
}) => {
  // Views: 'login' | 'forgot' | 'reset'
  const [view, setView] = useState('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // UI interaction states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Handle Login Submit
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Preencha seu e-mail e sua senha.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await AuthService.signInWithPassword({
        email: email.trim(),
        password
      });

      if (res.success) {
        if (onLoginSuccess) {
          onLoginSuccess(res.user, res.session);
        }
      } else {
        setErrorMessage(res.error || 'E-mail ou senha incorretos.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage('Não foi possível acessar sua conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password Submit
  const handleForgotPassword = async (e) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim()) {
      setErrorMessage('Informe seu e-mail para receber as instruções.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await AuthService.resetPasswordForEmail(email.trim());
      if (res.success) {
        setSuccessMessage(res.message || 'Link de recuperação enviado para seu e-mail.');
      } else {
        setErrorMessage(res.error || 'Não foi possível enviar a recuperação.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setErrorMessage('Erro ao solicitar recuperação de senha.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Reset Password Submit
  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    setErrorMessage('');
    setSuccessMessage('');

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await AuthService.updateUserPassword(newPassword);
      if (res.success) {
        setSuccessMessage('Senha atualizada com sucesso! Você já pode fazer login.');
        setTimeout(() => {
          setView('login');
          setPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }, 2000);
      } else {
        setErrorMessage(res.error || 'Não foi possível atualizar a senha.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setErrorMessage('Erro ao redefinir a senha.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen w-full flex flex-col justify-between bg-[#040714] text-slate-100 dark-ambient-canvas transition-colors duration-300 relative overflow-hidden select-none">
      {/* 21st.dev Adisyon Waves Shader Atmosphere Layer */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <ShaderBackground className="w-full h-full" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-4 sm:px-8 py-5 flex items-center justify-start">
        <div className="flex items-center gap-2.5">
          <RiseMobileLogo isExpanded={true} size="md" />
        </div>
      </header>

      {/* Main Authentication Card Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md">
          {/* Glassmorphism Architectural Panel: Squared & Premium Structure (18px radius) */}
          <div className="bg-[#0B101B]/45 backdrop-blur-2xl sm:backdrop-blur-3xl border border-white/[0.14] rounded-2xl p-6 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all relative overflow-hidden text-slate-100">
            
            {/* Subtle Inner Top Glow Line */}
            <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

            {/* Header Content */}
            <div className="text-center mb-6">
              <div className="flex justify-center">
                <RiseMobileLogo isExpanded={true} size="xl" className="mx-auto" />
              </div>
              {view !== 'login' && (
                <>
                  <h2 className="text-xl font-bold tracking-tight text-white mt-3 drop-shadow-sm">
                    {view === 'forgot' && 'Recuperar Senha'}
                    {view === 'reset' && 'Nova Senha'}
                  </h2>
                  <p className="text-xs text-slate-300/80 mt-1.5 font-medium">
                    {view === 'forgot' && 'Digite seu e-mail para receber as instruções.'}
                    {view === 'reset' && 'Defina uma nova senha de no mínimo 6 caracteres.'}
                  </p>
                </>
              )}
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div 
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-rose-500/15 backdrop-blur-md border border-rose-500/35 flex items-start gap-2.5 text-rose-200 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="text-xs font-semibold leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Success Message Alert */}
            {successMessage && (
              <div 
                role="status"
                className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 backdrop-blur-md border border-emerald-500/35 flex items-start gap-2.5 text-emerald-200 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span className="text-xs font-semibold leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* ======================================================== */}
            {/* VIEW 1: LOGIN FORM */}
            {/* ======================================================== */}
            {view === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4 text-left">
                {/* Email Input */}
                <div className="space-y-1.5">
                  <label 
                    htmlFor="login-email" 
                    className="block text-xs font-bold text-slate-200/90 tracking-wide uppercase"
                  >
                    E-mail
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="admin@risemobile.com"
                      autoComplete="email"
                      required
                      className="w-full bg-white/[0.06] backdrop-blur-md text-white placeholder-slate-400/80 border border-white/[0.12] hover:border-white/25 focus:border-blue-400/90 focus:bg-white/[0.09] focus:ring-2 focus:ring-blue-500/20 text-sm rounded-xl pl-10 pr-4 py-3 transition-all outline-none font-medium shadow-inner"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label 
                      htmlFor="login-password" 
                      className="block text-xs font-bold text-slate-200 tracking-wide uppercase"
                    >
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setView('forgot');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-300 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="w-full bg-white/[0.06] backdrop-blur-md text-white placeholder-slate-300/80 border border-white/[0.14] hover:border-white/30 focus:border-blue-400 focus:bg-white/[0.09] focus:ring-2 focus:ring-blue-500/20 text-sm rounded-xl pl-10 pr-11 py-3 transition-all outline-none font-medium shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-slate-300 hover:text-white transition-colors p-1 rounded-lg focus:outline-none cursor-pointer"
                      title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/30 text-blue-500 focus:ring-blue-500 bg-white/[0.06] cursor-pointer"
                  />
                  <label 
                    htmlFor="remember-me" 
                    className="text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    Manter conectado neste dispositivo
                  </label>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  className="w-full mt-3 h-12 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-[0_4px_25px_rgba(37,99,235,0.45)] hover:shadow-[0_4px_30px_rgba(37,99,235,0.6)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Entrando...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ======================================================== */}
            {/* VIEW 2: FORGOT PASSWORD FORM */}
            {/* ======================================================== */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label 
                    htmlFor="forgot-email" 
                    className="block text-xs font-bold text-slate-200 tracking-wide uppercase"
                  >
                    E-mail Cadastrado
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-300 pointer-events-none">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="seu-email@risemobile.com"
                      autoComplete="email"
                      required
                      className="w-full bg-white/[0.06] backdrop-blur-md text-white placeholder-slate-300/80 border border-white/[0.14] hover:border-white/30 focus:border-blue-400 focus:bg-white/[0.09] focus:ring-2 focus:ring-blue-500/20 text-sm rounded-xl pl-10 pr-4 py-3 transition-all outline-none font-medium shadow-inner"
                    />
                  </div>
                </div>

                {/* Send Recovery Button */}
                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full mt-2 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-[0_4px_25px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Enviando link...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Enviar link de recuperação</span>
                    </>
                  )}
                </button>

                {/* Back to Login Button */}
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para o Login</span>
                </button>
              </form>
            )}

            {/* ======================================================== */}
            {/* VIEW 3: RESET PASSWORD FORM */}
            {/* ======================================================== */}
            {view === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4 text-left">
                {/* New Password */}
                <div className="space-y-1.5">
                  <label 
                    htmlFor="reset-new-password" 
                    className="block text-xs font-bold text-slate-200/90 tracking-wide uppercase"
                  >
                    Nova Senha
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reset-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      required
                      className="w-full bg-white/[0.06] backdrop-blur-md text-white placeholder-slate-400/80 border border-white/[0.12] hover:border-white/25 focus:border-blue-400/90 focus:bg-white/[0.09] focus:ring-2 focus:ring-blue-500/20 text-sm rounded-xl pl-10 pr-11 py-3 transition-all outline-none font-medium shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 text-slate-400 hover:text-white transition-colors p-1 rounded-lg focus:outline-none cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label 
                    htmlFor="reset-confirm-password" 
                    className="block text-xs font-bold text-slate-200/90 tracking-wide uppercase"
                  >
                    Confirmar Nova Senha
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reset-confirm-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Repita a nova senha"
                      autoComplete="new-password"
                      required
                      className="w-full bg-white/[0.06] backdrop-blur-md text-white placeholder-slate-400/80 border border-white/[0.12] hover:border-white/25 focus:border-blue-400/90 focus:bg-white/[0.09] focus:ring-2 focus:ring-blue-500/20 text-sm rounded-xl pl-10 pr-4 py-3 transition-all outline-none font-medium shadow-inner"
                    />
                  </div>
                </div>

                {/* Submit Reset Button */}
                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="w-full mt-2 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-[0_4px_25px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Salvando senha...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Salvar nova senha</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Bottom Security Footer */}
            <div className="mt-8 pt-5 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Acesso Seguro Supabase
              </span>
              <span className="font-mono text-slate-400/80">v2.4 • 2026</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-400/80 font-medium">
        RiseMobile Ecosystem — Sistema de Atacado & Distribuição
      </footer>
    </div>
  );
};

export default LoginScreen;
