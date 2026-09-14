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

export const AuthService = {
  /**
   * Realiza login com E-mail e Senha via Supabase Auth
   */
  async signInWithPassword({ email, password }) {
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
          // Mensagem genérica para proteção contra enumeração de usuários
          return {
            success: false,
            error: 'E-mail ou senha incorretos.'
          };
        }

        const session = data?.session || null;
        const user = data?.user || null;

        memoryAuthSession = session;
        if (session) {
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
            }
          } catch {
            // Safe storage fallback
          }
        }

        notifyListeners('SIGNED_IN', session);
        return { success: true, user, session };
      } else {
        // Modo Local/Demonstração Controlado
        // Apenas credenciais autorizadas existentes
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
        } else {
          return {
            success: false,
            error: 'E-mail ou senha incorretos.'
          };
        }
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
          memoryAuthSession = data.session;
          return data.session;
        }
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
        memoryAuthSession = session;
        callback(event, session);
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
