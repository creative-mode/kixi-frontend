// Enquanto a correção de uma prova decorre, o aluno vê uma mensagem que o acalma e o informa, e nunca um erro por demora
// (kixi#542). A correção das respostas abertas pode levar mais do que um instante, e isso não é uma falha: o ecrã tem de o
// dizer, mostrar em que ponto está, e deixar claro que o aluno não precisa de esperar ali.

export interface FaseDaEspera {
  /** Para o teste e para o `data-fase` do ecrã. */
  id: 'inicio' | 'a-decorrer' | 'demora';
  titulo: string;
  /** A frase principal, sempre tranquilizadora. */
  mensagem: string;
  /** Só quando já passou muito tempo: o que fazer, dito sem alarme. */
  conselho: string | null;
  /** De quanto em quanto tempo o ecrã volta a ler o resultado. */
  intervaloMs: number;
}

const SEGUNDO = 1000;
const MINUTO = 60 * SEGUNDO;

/**
 * A fase da espera a partir do tempo que passou. Os intervalos alongam-se, e nunca terminam: o ecrã continua a ler
 * (devagar) enquanto estiver à vista, em vez de desistir e mostrar uma falha.
 */
export function faseDaEspera(decorridoMs: number): FaseDaEspera {
  const t = Math.max(0, decorridoMs);
  if (t < 30 * SEGUNDO) {
    return {
      id: 'inicio',
      titulo: 'A tua prova está a ser corrigida',
      mensagem: 'Entregaste a prova e já está guardada. Estamos a ler as tuas respostas com atenção.',
      conselho: null,
      intervaloMs: 3 * SEGUNDO,
    };
  }
  if (t < 2 * MINUTO) {
    return {
      id: 'a-decorrer',
      titulo: 'A correção continua a decorrer',
      mensagem: 'As respostas abertas pedem um pouco mais de cuidado. Está tudo bem, a tua prova está em segurança.',
      conselho: null,
      intervaloMs: 8 * SEGUNDO,
    };
  }
  return {
    id: 'demora',
    titulo: 'Ainda estamos a corrigir, com calma',
    mensagem: 'Corrigir bem leva tempo, e isso é normal: a tua prova está guardada e o resultado aparece assim que estiver pronto.',
    conselho: t >= 10 * MINUTO ? 'Se quiseres, fecha este ecrã e volta mais tarde: o resultado fica nas tuas provas. Se demorar muito, fala com o teu professor.' : null,
    intervaloMs: t >= 10 * MINUTO ? 30 * SEGUNDO : 15 * SEGUNDO,
  };
}

export type PassoDaEspera = { id: 'entregue' | 'a-corrigir' | 'resultado'; rotulo: string; estado: 'feito' | 'atual' | 'seguinte' };

/** Os três passos que o aluno vê: entregue (feito), a corrigir (agora) e o resultado (a seguir). */
export function passosDaEspera(): PassoDaEspera[] {
  return [
    { id: 'entregue', rotulo: 'Prova entregue', estado: 'feito' },
    { id: 'a-corrigir', rotulo: 'A corrigir', estado: 'atual' },
    { id: 'resultado', rotulo: 'Resultado', estado: 'seguinte' },
  ];
}
