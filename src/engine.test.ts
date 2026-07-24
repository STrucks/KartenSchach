import { describe, expect, it } from 'vitest'
import { executeMove, pseudoMoves } from './engine'
import type { Board } from './domain'
const p=(type:'pawn'|'knight'|'bishop'|'rook'|'queen'|'king', color:'white'|'black')=>({id:type+color,type,color,moved:false})
describe('Regelengine',()=>{
 it('laesst Springer springen und blockiert Laeufer',()=>{const b:Board={b1:p('knight','white'),c3:p('pawn','white'),d4:p('bishop','white'),e5:p('pawn','white')};expect(pseudoMoves(b,'b1')).toContain('a3');expect(pseudoMoves(b,'d4')).not.toContain('f6')})
 it('erlaubt Koenigsschlag',()=>{const b:Board={a1:p('rook','white'),a8:p('king','black')};expect(executeMove(b,{from:'a1',to:'a8'}).winner).toBe('white')})
 it('wandelt Bauern um',()=>{const b:Board={a7:p('pawn','white')};expect(executeMove(b,{from:'a7',to:'a8',promotion:'queen'}).board.a8?.type).toBe('queen')})
})
