// RISEMOBILE: Official Authentication Service (Supabase Auth Engine)
import { supabase, isLiveSupabaseConfigured } from './supabaseClient.js';

const AUTH_STORAGE_KEY = 'risemobile_auth_session';
let memoryAuthSession = null;

// Default authorized administrative user for system bootstrap/demo mode
const DEFAULT_AUTH_USER = {
  id: 'usr-rise-admin-01',
  email: 'admin@risemobile.com',
  user_metadata: {
    name: 'Administrador RiseMobile',
    role: 'admin',
    avatar_initials: 'RM'
  },
  role: 'authenticated',
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z'
};

const listeners = new Set();

const notifyListeners = (event, session) => {
  listeners.forEach((callback) => {
    try {
      callback(event, session);
    } catch (err) {
      console.error('Auth listener error:', err);
    }
  });
};

// -----------------------------------------------------------------------------
// Autorização (modo Supabase): o papel do usuário vem SEMPRE do banco
// (função get_my_access, migration 015) e a falha em confirmar o papel NEGA o
// acesso (falha fechada). Nada aqui é confiável no navegador; a proteção real
// dos dados é feita pelas políticas RLS do banco.
// -----------------------------------------------------------------------------
const ACCESS_CACHE_TTL_MS = 60 * 1000;
const accessCache = new Map();

const DENIED_NO_PERMISSION = 'Sua conta não tem permissão de acesso ao sistema. Solicite a liberação à administração da RiseMobile.';
const DENIED_INACTIVE = 'Acesso desativado. Entre em contato com a administração da RiseMobile.';
const DENIED_UNVERIFIED = 'Não foi possível verificar suas permissões. Tente novamente.';

const isMissingFunctionError = (error) => Boolean(error) && (
  error.code === 'PGRST202' ||
  error.code === '42883' ||
  /Could not find the function|schema cache/i.test(error.message || '')
);

const isMissingTableError = (error) => Boolean(error) && (
  error.code === '42P01' ||
  error.code === 'PGRST205' ||
  /does not exist|schema cache/i.test(error.message || '')
);

const mapAccess = (payload) => {
  const role = payload?.role;
  if (role === 'admin') return { allowed: true, role: 'admin' };
  if (role === 'commission_agent') {
    return {
      allowed: true,
      role: 'commission_agent',
      agent: { id: payload.agent_id, name: payload.name, phone: payload.phone || '' }
    };
  }
  if (role === 'inactive_agent') return { allowed: false, error: DENIED_INACTIVE };
  return { allowed: false, error: DENIED_NO_PERMISSION };
};

// Compatibilidade enquanto a migration 015 ainda não foi aplicada no banco:
// consulta direta, mas qualquer erro inesperado continua negando o acesso.
const resolveLegacyAccess = async (user) => {
  const email = (user.email || '').toLowerCase();
  const columns = 'id, name, phone, is_active';

  let { data: agent, error } = await supabase
    .from('commission_agents')
    .select(columns)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!error && !agent && email) {
    ({ data: agent, error } = await supabase
      .from('commission_agents')
      .select(columns)
      .eq('email', email)
      .maybeSingle());
  }

  if (error) {
    // Tabela ainda não existe (migration 014 não aplicada): não há comissionados.
    if (isMissingTableError(error)) return { allowed: true, role: 'admin' };
    return { allowed: false, error: DENIED_UNVERIFIED };
  }
  if (!agent) return { allowed: true, role: 'admin' };
  if (!agent.is_active) return { allowed: false, error: DENIED_INACTIVE };
  return {
    allowed: true,
    role: 'commission_agent',
    agent: { id: agent.id, name: agent.name, phone: agent.phone || '' }
  };
};

const resolveLiveAccess = async (user) => {
  const cached = accessCache.get(user.id);
  if (cached && Date.now() - cached.ts < ACCESS_CACHE_TTL_MS) return cached.result;

  let result;
  try {
    const { data, error } = await supabase.rpc('get_my_access');
    if (!error && data) {
      result = mapAccess(data);
    } else if (isMissingFunctionError(error)) {
      result = await resolveLegacyAccess(user);
    } else {
      result = { allowed: false, error: DENIED_UNVERIFIED };
    }
  } catch (err) {
    console.error('Erro ao verificar permissões:', err);
    result = { allowed: false, error: DENIED_UNVERIFIED };
  }

  if (result.allowed) accessCache.set(user.id, { ts: Date.now(), result });
  else accessCache.delete(user.id);
  return result;
};

// Devolve uma cópia da sessão com o papel do comissionado no metadata do usuário
const applyAccessToSession = (session, access) => {
  if (!session?.user) return session;
  if (access?.role !== 'commission_agent') return session;
  return {
    ...session,
    user: {
      ...session.user,
      user_metadata: {
        ...session.user.user_metadata,
        role: 'commission_agent',
        name: access.agent.name,
        agent_id: access.agent.id,
        phone: access.agent.phone
      }
    }
  };
};

export const AuthService = {
  /**
   * Realiza login com E-mail e Senha via Supabase Auth
   */
  async signInWithPassword(emailOrObj, passwordArg) {
    let email = '';
    let password = '';

    if (typeof emailOrObj === 'object' && emailOrObj !== null) {
      email = emailOrObj.email || '';
      password = emailOrObj.password || '';
    } else {
      email = emailOrObj || '';
      password = passwordArg || '';
    }

    if (!email || !password) {
      return {
        success: false,
        error: 'Preencha o e-mail e a senha para continuar.'
      };
    }

    const cleanEmail = email.trim().toLowerCase();

    // Validação básica de formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return {
        success: false,
        error: 'Formato de e-mail inválido.'
      };
    }

    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });

        if (error) {
          console.warn('[Supabase Auth Warning]:', error.message);
          // O Supabase só devolve este erro quando e-mail e senha estão corretos,
          // então revelar o motivo não permite descobrir contas de terceiros.
          if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message || '')) {
            return {
              success: false,
              error: 'Seu e-mail ainda não foi confirmado. Abra o link de confirmação enviado para o seu e-mail (veja também o spam) e tente entrar novamente.'
            };
          }
          return {
            success: false,
            error: 'E-mail ou senha incorretos.'
          };
        }

        const rawSession = data?.session || null;
        const rawUser = data?.user || null;

        // Autorização com falha fechada: sem permissão confirmada, não entra.
        let session = rawSession;
        let user = rawUser;
        if (rawUser) {
          const access = await resolveLiveAccess(rawUser);
          if (!access.allowed) {
            await supabase.auth.signOut();
            return { success: false, error: access.error };
          }
          session = applyAccessToSession(rawSession, access);
          user = session?.user || applyAccessToSession({ user: rawUser }, access).user;
        }

        // No modo Supabase a sessão é guardada apenas pelo próprio Supabase
        memoryAuthSession = session;

        notifyListeners('SIGNED_IN', session);
        return { success: true, user, session };
      } else {
        // Modo Local/Demonstração Controlado
        // 1. Administradores padrão
        const isAuthorizedAdmin = (cleanEmail === 'admin@risemobile.com' && password === 'admin123');
        const isAuthorizedDemo = (cleanEmail === 'demo@risemobile.com' && password === 'demo123');

        if (isAuthorizedAdmin || isAuthorizedDemo) {
          const userName = cleanEmail.split('@')[0].replace('.', ' ');
          const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);
          
          const sessionUser = {
            ...DEFAULT_AUTH_USER,
            id: `usr-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '-')}`,
            email: cleanEmail,
            user_metadata: {
              name: formattedName === 'Admin' ? 'Administrador RiseMobile' : formattedName,
              role: 'admin',
              avatar_initials: formattedName.slice(0, 2).toUpperCase()
            }
          };

          const session = {
            access_token: `rise_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            token_type: 'bearer',
            expires_in: 3600 * 24 * 7,
            expires_at: Math.floor(Date.now() / 1000) + (3600 * 24 * 7),
            user: sessionUser
          };

          memoryAuthSession = session;
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
            }
          } catch {
            // Safe storage fallback
          }

          notifyListeners('SIGNED_IN', session);
          return { success: true, user: sessionUser, session };
        }

        // 2. Comissionados Cadastrados
        let agents = [];
        try {
          if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem('risemobile_commission_agents');
            if (raw) agents = JSON.parse(raw);
          }
        } catch {
          agents = [];
        }

        const agent = agents.find(a => a.email && a.email.toLowerCase() === cleanEmail);
        if (agent) {
          if (!agent.is_active) {
            return {
              success: false,
              error: 'Acesso desativado. Entre em contato com a administração da RiseMobile.'
            };
          }

          const expectedPassword = agent.password || agent.password_hash || '123456';
          if (password !== expectedPassword) {
            return {
              success: false,
              error: 'E-mail ou senha incorretos.'
            };
          }

          const sessionUser = {
            id: agent.id,
            email: cleanEmail,
            role: 'commission_agent',
            aud: 'authenticated',
            user_metadata: {
              name: agent.name,
              role: 'commission_agent',
              agent_id: agent.id,
              phone: agent.phone || '',
              avatar_initials: agent.name.slice(0, 2).toUpperCase()
            }
          };

          const session = {
            access_token: `rise_agent_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            token_type: 'bearer',
            expires_in: 3600 * 24 * 7,
            expires_at: Math.floor(Date.now() / 1000) + (3600 * 24 * 7),
            user: sessionUser
          };

          memoryAuthSession = session;
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
            }
          } catch {
            // Safe storage fallback
          }

          notifyListeners('SIGNED_IN', session);
          return { success: true, user: sessionUser, session };
        }

        return {
          success: false,
          error: 'E-mail ou senha incorretos.'
        };
      }
    } catch (err) {
      console.error('Erro na autenticação:', err);
      return {
        success: false,
        error: 'Não foi possível acessar sua conta. Tente novamente.'
      };
    }
  },

  /**
   * Encerra a sessão atual (Logout)
   */
  async signOut() {
    try {
      if (isLiveSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Erro ao deslogar no Supabase:', err);
    } finally {
      memoryAuthSession = null;
      accessCache.clear();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch {
        // Safe storage fallback
      }
      notifyListeners('SIGNED_OUT', null);
    }
    return { success: true };
  },

  /**
   * Recuperação de Senha — Dispara link/token oficial via Supabase Auth
   */
  async resetPasswordForEmail(email) {
    if (!email) {
      return {
        success: false,
        error: 'Informe o e-mail cadastrado.'
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return {
        success: false,
        error: 'Formato de e-mail inválido.'
      };
    }

    try {
      if (isLiveSupabaseConfigured && supabase) {
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}` : '';
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo
        });

        if (error) {
          console.warn('[Supabase Reset Password Warning]:', error.message);
        }
      }

      // Sempre retorna sucesso com mensagem padronizada para evitar enumeração de contas
      return {
        success: true,
        message: 'Se o e-mail estiver autorizado, as instruções de recuperação foram enviadas.'
      };
    } catch (err) {
      console.error('Erro ao recuperar senha:', err);
      return {
        success: false,
        error: 'Não foi possível processar a recuperação. Tente novamente mais tarde.'
      };
    }
  },

  /**
   * Atualização de nova senha
   */
  async updateUserPassword(newPassword) {
    if (!newPassword || newPassword.length < 6) {
      return {
        success: false,
        error: 'A nova senha deve ter no mínimo 6 caracteres.'
      };
    }

    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (error) {
          return {
            success: false,
            error: 'Não foi possível atualizar a senha. Tente novamente.'
          };
        }
      }

      return {
        success: true,
        message: 'Senha redefinida com sucesso!'
      };
    } catch (err) {
      console.error('Erro ao atualizar senha:', err);
      return {
        success: false,
        error: 'Erro ao processar nova senha.'
      };
    }
  },

  /**
   * Obtém a sessão ativa
   */
  async getSession() {
    try {
      if (isLiveSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          // O papel é reconfirmado no banco a cada carregamento (falha fechada)
          const access = await resolveLiveAccess(data.session.user);
          if (!access.allowed) {
            await this.signOut();
            return null;
          }
          const enriched = applyAccessToSession(data.session, access);
          memoryAuthSession = enriched;
          return enriched;
        }

        // Modo Supabase: sem sessão no Supabase = sem login. Nunca confiar em cópia
        // local, senão a tela parece logada enquanto as chamadas ao banco saem anônimas.
        memoryAuthSession = null;
        try {
          if (typeof localStorage !== 'undefined') localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {
          // Safe storage fallback
        }
        return null;
      }

      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.expires_at && parsed.expires_at > Math.floor(Date.now() / 1000)) {
            memoryAuthSession = parsed;
            return parsed;
          } else if (parsed && !parsed.expires_at) {
            memoryAuthSession = parsed;
            return parsed;
          }
        }
      }

      if (memoryAuthSession) {
        return memoryAuthSession;
      }
    } catch (err) {
      console.error('Erro ao verificar sessão:', err);
    }
    return null;
  },

  /**
   * Obtém o usuário atual
   */
  async getUser() {
    const session = await this.getSession();
    return session?.user || null;
  },

  /**
   * Inscreve um ouvinte para mudanças de autenticação
   */
  onAuthStateChange(callback) {
    listeners.add(callback);

    let supabaseUnsubscribe = null;
    if (isLiveSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!session?.user) {
          memoryAuthSession = session;
          callback(event, session);
          return;
        }
        // Fora do callback síncrono para não travar o cliente do Supabase
        setTimeout(async () => {
          const access = await resolveLiveAccess(session.user);
          if (!access.allowed) {
            await AuthService.signOut();
            return;
          }
          const enriched = applyAccessToSession(session, access);
          memoryAuthSession = enriched;
          callback(event, enriched);
        }, 0);
      });
      supabaseUnsubscribe = authListener?.subscription?.unsubscribe;
    }

    return () => {
      listeners.delete(callback);
      if (supabaseUnsubscribe) {
        supabaseUnsubscribe();
      }
    };
  }
};
