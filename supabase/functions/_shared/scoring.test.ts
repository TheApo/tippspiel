import { describe, it, expect } from 'vitest'
import {
  POINTS,
  tendency,
  scoreMatch,
  effectiveGoals,
  scoreBonusSingle,
  scoreBonusSet,
} from './scoring.ts'

const g = (home: number, away: number) => ({ home, away })

describe('tendency', () => {
  it('classifies results', () => {
    expect(tendency(g(2, 0))).toBe(1)
    expect(tendency(g(0, 2))).toBe(-1)
    expect(tendency(g(1, 1))).toBe(0)
  })
})

describe('scoreMatch — Sieg', () => {
  it('exaktes Ergebnis = 4', () => {
    expect(scoreMatch(g(2, 1), g(2, 1))).toBe(POINTS.EXACT)
  })
  it('richtige Tordifferenz (nicht exakt) = 3', () => {
    expect(scoreMatch(g(2, 1), g(3, 2))).toBe(POINTS.DIFFERENCE)
    expect(scoreMatch(g(1, 0), g(4, 3))).toBe(POINTS.DIFFERENCE)
  })
  it('nur Tendenz = 2', () => {
    expect(scoreMatch(g(2, 1), g(3, 0))).toBe(POINTS.TENDENCY)
    expect(scoreMatch(g(1, 0), g(5, 0))).toBe(POINTS.TENDENCY)
  })
  it('falsche Tendenz = 0', () => {
    expect(scoreMatch(g(2, 1), g(0, 1))).toBe(POINTS.MISS)
    expect(scoreMatch(g(2, 1), g(1, 1))).toBe(POINTS.MISS)
  })
})

describe('scoreMatch — Remis', () => {
  it('exaktes Remis = 4', () => {
    expect(scoreMatch(g(1, 1), g(1, 1))).toBe(POINTS.EXACT)
    expect(scoreMatch(g(0, 0), g(0, 0))).toBe(POINTS.EXACT)
  })
  it('Remis-Tendenz, nicht exakt = 2 (kein 3)', () => {
    expect(scoreMatch(g(1, 1), g(2, 2))).toBe(POINTS.TENDENCY)
    expect(scoreMatch(g(0, 0), g(3, 3))).toBe(POINTS.TENDENCY)
  })
  it('Remis getippt, Sieg passiert = 0', () => {
    expect(scoreMatch(g(1, 1), g(2, 1))).toBe(POINTS.MISS)
  })
})

describe('effectiveGoals — Elfmeter-Konvention', () => {
  it('reguläre Spielzeit unverändert', () => {
    expect(effectiveGoals(g(2, 1), 'REGULAR', 'HOME_TEAM')).toEqual(g(2, 1))
  })
  it('Verlängerung unverändert (fullTime enthält Verl.)', () => {
    expect(effectiveGoals(g(3, 2), 'EXTRA_TIME', 'HOME_TEAM')).toEqual(g(3, 2))
  })
  it('Elfmeterschießen: Heim-Sieger +1', () => {
    expect(effectiveGoals(g(1, 1), 'PENALTY_SHOOTOUT', 'HOME_TEAM')).toEqual(g(2, 1))
  })
  it('Elfmeterschießen: Auswärts-Sieger +1', () => {
    expect(effectiveGoals(g(1, 1), 'PENALTY_SHOOTOUT', 'AWAY_TEAM')).toEqual(g(1, 2))
  })
  it('Tipp 2:1 auf Elfer-Sieg Heim (gewertet 2:1) = exakt 4', () => {
    const actual = effectiveGoals(g(1, 1), 'PENALTY_SHOOTOUT', 'HOME_TEAM')
    expect(scoreMatch(g(2, 1), actual)).toBe(POINTS.EXACT)
  })
})

describe('scoreBonusSingle', () => {
  it('Treffer = 4', () => {
    expect(scoreBonusSingle('GER', 'GER')).toBe(POINTS.BONUS_PER_HIT)
  })
  it('daneben / leer = 0', () => {
    expect(scoreBonusSingle('GER', 'BRA')).toBe(0)
    expect(scoreBonusSingle(null, 'BRA')).toBe(0)
    expect(scoreBonusSingle('GER', null)).toBe(0)
  })
})

describe('scoreBonusSet — Halbfinalisten', () => {
  const actual = ['GER', 'BRA', 'FRA', 'ARG']
  it('alle 4 richtig = 16', () => {
    expect(scoreBonusSet(['ARG', 'FRA', 'GER', 'BRA'], actual)).toBe(16)
  })
  it('2 richtig = 8', () => {
    expect(scoreBonusSet(['GER', 'BRA', 'ESP', 'POR'], actual)).toBe(8)
  })
  it('keiner richtig = 0', () => {
    expect(scoreBonusSet(['ESP', 'POR', 'NED', 'ITA'], actual)).toBe(0)
  })
  it('Duplikate zählen nicht doppelt', () => {
    expect(scoreBonusSet(['GER', 'GER', 'GER', 'GER'], actual)).toBe(4)
  })
})
