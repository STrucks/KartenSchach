import { describe, expect, it } from 'vitest'
import { RandomAgent, executeMove, pseudoMoves, seeded, selectFigureCard } from './engine'
import type { Board, GameState } from './domain'
const p=(type:'pawn'|'knight'|'bishop'|'rook'|'queen'|'king', color:'white'|'black')=>({id:type+color,type,color,moved:false})
describe('Regelengine',()=>{
 it('laesst Springer springen und blockiert Laeufer',()=>{const b:Board={b1:p('knight','white'),c3:p('pawn','white'),d4:p('bishop','white'),e5:p('pawn','white')};expect(pseudoMoves(b,'b1')).toContain('a3');expect(pseudoMoves(b,'d4')).not.toContain('f6')})
 it('erlaubt Koenigsschlag',()=>{const b:Board={a1:p('rook','white'),a8:p('king','black')};expect(executeMove(b,{from:'a1',to:'a8'}).winner).toBe('white')})
 it('wandelt Bauern um',()=>{const b:Board={a7:p('pawn','white')};expect(executeMove(b,{from:'a7',to:'a8',promotion:'queen'}).board.a8?.type).toBe('queen')})
 it('verhindert Kartenauswahl vor dem Ziehen',()=>{const state:GameState={board:{a2:p('pawn','white')},players:{white:{color:'white',figures:[{id:'pawn-card',kind:'figure',type:'pawn'}],actions:[],actionLocked:false},black:{color:'black',figures:[],actions:[],actionLocked:false}},figures:{draw:[],discard:[]},actions:{draw:[],discard:[]},current:'white',phase:'start',turn:1};expect(selectFigureCard(state,'pawn-card')).toBe(state)})
 it('priorisiert Schlagzuege fuer den Computer',async()=>{const state:GameState={board:{a8:p('rook','black'),b8:p('knight','black'),a1:p('pawn','white')},players:{white:{color:'white',figures:[],actions:[],actionLocked:false},black:{color:'black',figures:[{id:'rook-card',kind:'figure',type:'rook'},{id:'knight-card',kind:'figure',type:'knight'}],actions:[],actionLocked:false}},figures:{draw:[],discard:[]},actions:{draw:[],discard:[]},current:'black',phase:'actions',turn:1};await expect(new RandomAgent().chooseTurn(state,seeded(1))).resolves.toEqual({cardId:'rook-card',move:{from:'a8',to:'a1'}})})
})
