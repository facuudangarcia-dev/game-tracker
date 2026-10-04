/**
 * User-facing texts, centralized (docs/decisions.md #16). V1 is Spanish only; to add
 * languages later, this object becomes one locale among several behind a `t()` helper.
 */
export const messages = {
  app: {
    name: 'Game Tracker',
    homePlaceholder:
      'Proyecto inicializado. La biblioteca y el resto de funcionalidades se implementarán en las próximas fases.',
    loading: 'Cargando…',
  },
  apiStatus: {
    checking: 'API: comprobando…',
    up: 'API: conectada',
    down: 'API: sin conexión',
  },
  errors: {
    notFoundTitle: 'Página no encontrada',
    notFoundBody: 'La página que buscás no existe.',
    backHome: 'Volver al inicio',
    unexpected: 'Ocurrió un error inesperado.',
    network: 'No se pudo conectar con el servidor. Intentá de nuevo.',
  },
  auth: {
    email: 'Email',
    password: 'Contraseña',
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    userMenu: 'Menú de usuario',
    logout: 'Cerrar sesión',
    login: {
      title: 'Iniciar sesión',
      submit: 'Ingresar',
      noAccount: '¿No tenés cuenta?',
      goToRegister: 'Registrate',
    },
    register: {
      title: 'Crear cuenta',
      submit: 'Crear cuenta',
      hasAccount: '¿Ya tenés cuenta?',
      goToLogin: 'Iniciá sesión',
    },
    validation: {
      emailRequired: 'Ingresá tu email.',
      emailInvalid: 'Ingresá un email válido.',
      passwordRequired: 'Ingresá tu contraseña.',
      passwordTooShort: (min: number) => `La contraseña debe tener al menos ${min} caracteres.`,
      passwordTooLong: (max: number) => `La contraseña puede tener como máximo ${max} caracteres.`,
      passwordHint: (min: number) => `Mínimo ${min} caracteres.`,
    },
    serverErrors: {
      INVALID_CREDENTIALS: 'Email o contraseña incorrectos.',
      EMAIL_ALREADY_REGISTERED: 'Ya existe una cuenta con ese email.',
      TOO_MANY_REQUESTS: 'Demasiados intentos. Esperá un minuto y volvé a intentar.',
      INVALID_DATA: 'Revisá los datos ingresados.',
    },
  },
} as const;
