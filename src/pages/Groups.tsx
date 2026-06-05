import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  fetchGroups, fetchGroupMembers,
  createGroup, joinGroup, leaveGroup, setGroup, approveMember, removeMember, deleteGroup,
} from '../lib/queries'
import type { Group, GroupMember, JoinMode } from '../lib/types'
import { initials, truncateName, MAX_NAME } from '../lib/format'

type Act = (p: Promise<unknown>, successMsg: string) => Promise<void>

export default function Groups() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const me = session?.user.id ?? ''

  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [newName, setNewName] = useState('')

  async function reload() {
    const [g, m] = await Promise.all([fetchGroups(), fetchGroupMembers()])
    setGroups(g); setMembers(m)
  }
  useEffect(() => { reload().finally(() => setLoading(false)) }, [])

  const act: Act = async (p, successMsg) => {
    setBusy(true); setErr(''); setMsg('')
    try { await p; await reload(); setMsg(successMsg) }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const membersByGroup = useMemo(() => {
    const map = new Map<string, GroupMember[]>()
    for (const m of members) { if (!map.has(m.group_id)) map.set(m.group_id, []); map.get(m.group_id)!.push(m) }
    return map
  }, [members])

  const myStatus = useMemo(() => {
    const map = new Map<string, GroupMember['status']>()
    for (const m of members) if (m.user_id === me) map.set(m.group_id, m.status)
    return map
  }, [members, me])

  const myGroups = useMemo(() => groups.filter((g) => myStatus.has(g.id)), [groups, myStatus])
  const otherGroups = useMemo(() => groups.filter((g) => !myStatus.has(g.id)), [groups, myStatus])

  async function create() {
    const name = newName.trim()
    if (!name) return
    await act(createGroup(name), t('groups.created'))
    setNewName('')
  }

  if (loading) return <div className="skeleton" style={{ height: 320 }} />

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 720 }}>
      <header>
        <span className="eyebrow">{t('account.groups')}</span>
        <h1>{t('groups.title')}</h1>
        <p className="muted">{t('groups.subtitle')}</p>
      </header>

      {/* Gruppe erstellen */}
      <section className="card pad" style={{ borderTop: '4px solid var(--petrol)' }}>
        <h3>{t('groups.create')}</h3>
        <div className="row wrap" style={{ marginTop: 12, gap: 10 }}>
          <input
            type="text" value={newName} maxLength={MAX_NAME}
            placeholder={t('groups.createPlaceholder')}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create() }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button className="btn petrol" disabled={busy || !newName.trim()} onClick={create}>{t('groups.createBtn')}</button>
        </div>
        <p className="muted" style={{ fontSize: '.78rem', marginTop: 8, marginBottom: 0 }}>{t('groups.minMembers')}</p>
      </section>

      {(msg || err) && (
        <div className={`alert ${err ? 'err' : 'ok'}`}>{err || msg}</div>
      )}

      {/* Meine Gruppen */}
      <section className="stack" style={{ gap: 12 }}>
        <h2 style={{ fontSize: '1.3rem' }}>{t('groups.mine')}</h2>
        {myGroups.length === 0 ? (
          <div className="card pad muted">{t('groups.noneMine')}</div>
        ) : (
          myGroups.map((g) => (
            <MyGroupCard
              key={g.id} group={g} me={me} busy={busy} act={act}
              members={membersByGroup.get(g.id) ?? []} myStatus={myStatus.get(g.id)!}
            />
          ))
        )}
      </section>

      {/* Andere Gruppen */}
      <section className="stack" style={{ gap: 12 }}>
        <h2 style={{ fontSize: '1.3rem' }}>{t('groups.others')}</h2>
        {otherGroups.length === 0 ? (
          <div className="card pad muted">{t('groups.noneOthers')}</div>
        ) : (
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th>{t('groups.groupCol')}</th>
                  <th className="num">{t('groups.membersShort')}</th>
                  <th>{t('groups.modeCol')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {otherGroups.map((g) => {
                  const count = (membersByGroup.get(g.id) ?? []).filter((m) => m.status === 'active').length
                  return (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 600 }}>{truncateName(g.name)}</td>
                      <td className="num">{count}</td>
                      <td><ModeBadge mode={g.join_mode} /></td>
                      <td className="num">
                        <button className="btn ghost sm" disabled={busy}
                          onClick={() => act(joinGroup(g.id), g.join_mode === 'open' ? t('groups.joined') : t('groups.applied'))}>
                          {g.join_mode === 'open' ? t('groups.join') : t('groups.apply')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function ModeBadge({ mode }: { mode: JoinMode }) {
  const { t } = useTranslation()
  return mode === 'open'
    ? <span className="badge petrol">{t('groups.modeOpen')}</span>
    : <span className="badge">{t('groups.modeApply')}</span>
}

function MemberRow({ name, isCaptain, action }: { name: string; isCaptain?: boolean; action?: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="row" style={{ gap: 10, minWidth: 0 }}>
        <span className="avatar" style={{ width: 28, height: 28, fontSize: '.72rem' }}>{initials(name)}</span>
        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncateName(name)}</span>
        {isCaptain && <span className="badge purpur">{t('groups.captain')}</span>}
      </span>
      {action}
    </div>
  )
}

function MyGroupCard({ group, members, myStatus, me, busy, act }: {
  group: Group; members: GroupMember[]; myStatus: GroupMember['status']; me: string; busy: boolean; act: Act
}) {
  const { t } = useTranslation()
  const isCaptain = group.captain_id === me
  const active = members.filter((m) => m.status === 'active')
  const pending = members.filter((m) => m.status === 'pending')
  const [name, setName] = useState(group.name)

  const accent = isCaptain ? 'var(--navy)' : 'var(--lilac)'

  return (
    <div className="card pad stack" style={{ gap: 14, borderTop: `4px solid ${accent}` }}>
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="row" style={{ gap: 10 }}>
          <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>{truncateName(group.name)}</strong>
          <ModeBadge mode={group.join_mode} />
        </span>
        <span className="row" style={{ gap: 8 }}>
          {isCaptain ? <span className="badge purpur">{t('groups.captain')}</span>
            : myStatus === 'pending' ? <span className="badge">{t('groups.pending')}</span>
            : <span className="badge petrol">{t('groups.member')}</span>}
          <span className="muted" style={{ fontSize: '.85rem' }}>{t('groups.membersN', { count: active.length })}</span>
        </span>
      </div>

      {active.length < 2 && <div className="alert info" style={{ fontSize: '.82rem' }}>{t('groups.minMembers')}</div>}

      {/* Captain: Einstellungen */}
      {isCaptain && (
        <>
          <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              {t('groups.rename')}
              <input type="text" value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="btn ghost sm" disabled={busy || !name.trim() || name.trim() === group.name}
              onClick={() => act(setGroup(group.id, name.trim(), group.join_mode), t('common.saved'))}>
              {t('common.save')}
            </button>
          </div>

          <div className="row wrap" style={{ gap: 10, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--navy)' }}>{t('groups.modeCol')}</span>
            <div className="seg sm">
              {(['open', 'apply'] as const).map((mode) => (
                <button key={mode} className={group.join_mode === mode ? 'on' : ''} disabled={busy || group.join_mode === mode}
                  onClick={() => act(setGroup(group.id, group.name, mode), t('common.saved'))}>
                  {mode === 'open' ? t('groups.modeOpen') : t('groups.modeApply')}
                </button>
              ))}
            </div>
            <span className="muted" style={{ fontSize: '.8rem' }}>
              {group.join_mode === 'open' ? t('groups.modeHintOpen') : t('groups.modeHintApply')}
            </span>
          </div>

          {/* Offene Anfragen */}
          {pending.length > 0 && (
            <div className="stack" style={{ gap: 4 }}>
              <span className="eyebrow" style={{ color: 'var(--purpur)' }}>{t('groups.pendingTitle')} ({pending.length})</span>
              {pending.map((p) => (
                <MemberRow key={p.user_id} name={p.display_name} action={
                  <span className="row" style={{ gap: 6 }}>
                    <button className="btn petrol sm" disabled={busy} onClick={() => act(approveMember(group.id, p.user_id), t('common.saved'))}>{t('groups.approve')}</button>
                    <button className="btn ghost sm" disabled={busy} onClick={() => act(removeMember(group.id, p.user_id), t('common.saved'))}>{t('groups.reject')}</button>
                  </span>
                } />
              ))}
            </div>
          )}
        </>
      )}

      {/* Mitgliederliste */}
      <div className="stack" style={{ gap: 0 }}>
        <span className="eyebrow">{t('groups.members')} ({active.length})</span>
        {active.map((m) => (
          <MemberRow key={m.user_id} name={m.display_name} isCaptain={m.user_id === group.captain_id}
            action={isCaptain && m.user_id !== group.captain_id
              ? <button className="btn ghost sm" style={{ color: 'var(--purpur)', borderColor: 'var(--purpur)' }} disabled={busy}
                  onClick={() => act(removeMember(group.id, m.user_id), t('common.saved'))}>{t('groups.remove')}</button>
              : undefined} />
        ))}
      </div>

      {/* Aktionen unten */}
      <div className="row wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
        {isCaptain ? (
          <button className="btn ghost sm" style={{ color: 'var(--purpur)', borderColor: 'var(--purpur)' }} disabled={busy}
            onClick={() => { if (window.confirm(t('groups.deleteConfirm', { name: group.name }))) act(deleteGroup(group.id), t('groups.deleted')) }}>
            {t('groups.deleteGroup')}
          </button>
        ) : myStatus === 'pending' ? (
          <button className="btn ghost sm" disabled={busy}
            onClick={() => act(leaveGroup(group.id), t('groups.withdrawn'))}>{t('groups.withdraw')}</button>
        ) : (
          <button className="btn ghost sm" style={{ color: 'var(--purpur)', borderColor: 'var(--purpur)' }} disabled={busy}
            onClick={() => { if (window.confirm(t('groups.leaveConfirm', { name: group.name }))) act(leaveGroup(group.id), t('groups.left')) }}>
            {t('groups.leave')}
          </button>
        )}
      </div>
    </div>
  )
}
