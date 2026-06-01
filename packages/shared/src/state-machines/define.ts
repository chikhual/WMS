/**
 * Framework minimalista de state machines para Maker WMS.
 *
 * Uso:
 *   const machine = defineStateMachine({ initial, states })
 *   const result = machine.transition(currentState, event, payload)
 *   // Si la transición es inválida lanza StateMachineError
 */

export interface TransitionDef {
  target: string;
  requires?: string[]; // campos obligatorios en el payload
  guard?: (payload: TransitionPayload) => boolean; // condición adicional
}

export interface StateDef {
  terminal?: boolean;
  on?: Record<string, TransitionDef>;
}

export interface StateMachineDef {
  initial: string;
  states: Record<string, StateDef>;
}

export interface TransitionPayload {
  reason?: string;
  evidence?: string[];
  [key: string]: unknown;
}

export interface TransitionResult {
  from: string;
  to: string;
  event: string;
  payload: TransitionPayload;
}

export class StateMachineError extends Error {
  constructor(
    public readonly code: 'INVALID_TRANSITION' | 'MISSING_REQUIRED_FIELDS' | 'GUARD_FAILED' | 'TERMINAL_STATE',
    message: string,
  ) {
    super(message);
    this.name = 'StateMachineError';
  }
}

export function defineStateMachine(def: StateMachineDef) {
  return {
    def,

    /**
     * Valida y ejecuta una transición.
     * @returns TransitionResult con los estados from/to
     * @throws StateMachineError si la transición no es válida
     */
    transition(currentState: string, event: string, payload: TransitionPayload = {}): TransitionResult {
      const stateDef = def.states[currentState];

      if (!stateDef) {
        throw new StateMachineError('INVALID_TRANSITION', `Estado desconocido: "${currentState}"`);
      }

      if (stateDef.terminal) {
        throw new StateMachineError(
          'TERMINAL_STATE',
          `El estado "${currentState}" es terminal — no acepta más transiciones`,
        );
      }

      const transitionDef = stateDef.on?.[event];

      if (!transitionDef) {
        const validEvents = Object.keys(stateDef.on ?? {});
        throw new StateMachineError(
          'INVALID_TRANSITION',
          `Transición "${event}" no permitida desde "${currentState}". Válidas: [${validEvents.join(', ')}]`,
        );
      }

      // Validar campos requeridos en el payload
      if (transitionDef.requires?.length) {
        const missing = transitionDef.requires.filter((field) => !payload[field]);
        if (missing.length > 0) {
          throw new StateMachineError(
            'MISSING_REQUIRED_FIELDS',
            `La transición "${event}" requiere: ${missing.join(', ')}`,
          );
        }
      }

      // Validar guard si existe
      if (transitionDef.guard && !transitionDef.guard(payload)) {
        throw new StateMachineError('GUARD_FAILED', `Condición no cumplida para la transición "${event}"`);
      }

      return {
        from: currentState,
        to: transitionDef.target,
        event,
        payload,
      };
    },

    /** Verifica si un evento es válido desde el estado actual sin ejecutar */
    canTransition(currentState: string, event: string): boolean {
      const stateDef = def.states[currentState];
      return !stateDef?.terminal && !!stateDef?.on?.[event];
    },

    /** Lista de eventos válidos desde el estado actual */
    validEvents(currentState: string): string[] {
      const stateDef = def.states[currentState];
      if (!stateDef || stateDef.terminal) return [];
      return Object.keys(stateDef.on ?? {});
    },

    get initial() {
      return def.initial;
    },

    get states() {
      return Object.keys(def.states);
    },
  };
}

export type StateMachine = ReturnType<typeof defineStateMachine>;
