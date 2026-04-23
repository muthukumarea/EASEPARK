import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getAuditLogs } from '../../services/api';

const STATUS_BADGE = { success:'badge-success', failure:'badge-danger', warning:'badge-warning' };

const ACTION_MAP = {
  Auth:     ['OTP_SENT','OTP_VERIFIED','OTP_FAILED','OTP_EXPIRED','OTP_MAX_ATTEMPTS','LOGIN_SUCCESS','USER_CREATED'],
  Booking:  ['BOOKING_INITIATED','BOOKING_CONFIRMED','BOOKING_CANCELLED','BOOKING_SLOT_CONFLICT'],
  Payment:  ['PAYMENT_ORDER_CREATED','PAYMENT_SUCCESS','PAYMENT_CANCELLED','PAYMENT_FAILED','PAYMENT_SIGNATURE_INVALID'],
  Security: ['UNAUTHORIZED_ACCESS','INVALID_TOKEN','ROLE_VIOLATION','RATE_LIMIT_HIT'],
};

const COLOR_MAP = {
  Auth:'var(--blue)', Booking:'var(--teal)', Payment:'var(--accent2)', Security:'var(--danger)'
};
const getColor = action => {
  for (const [cat, actions] of Object.entries(ACTION_MAP)) {
    if (actions.includes(action)) return COLOR_MAP[cat];
  }
  return 'var(--muted)';
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action:'', status:'', page:1, limit:50 });
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: filters.page, limit: filters.limit };
      if (filters.action) params.action = filters.action;
      if (filters.status) params.status = filters.status;
      const r = await getAuditLogs(params);
      setLogs(r.data.data.logs);
      setTotal(r.data.data.pagination.total);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setF = patch => setFilters(f => ({ ...f, ...patch, page: 1 }));

  return (
    <div className="page fade-up">
      <div className="page-head-row">
        <div className="page-head" style={{ marginBottom:0 }}>
          <h1>🔐 Audit Logs</h1>
          <p>Complete security trail — {total} total entries</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {/* Category filter */}
      <div style={{ margin:'18px 0 10px', display:'flex', gap:8, flexWrap:'wrap' }}>
        {Object.entries(ACTION_MAP).map(([cat, actions]) => (
          <div key={cat} style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>{cat}:</span>
            {actions.map(a => (
              <button key={a} onClick={() => setF({ action: filters.action === a ? '' : a })}
                style={{
                  padding:'3px 10px', borderRadius:20, border:`1.5px solid ${COLOR_MAP[cat]}`,
                  fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  background: filters.action === a ? COLOR_MAP[cat] : 'transparent',
                  color: filters.action === a ? '#fff' : COLOR_MAP[cat],
                  transition:'all 0.15s',
                }}>
                {a.replace(/_/g,' ')}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div style={{ display:'flex', gap:6, marginBottom:18 }}>
        {['','success','failure','warning'].map(s => (
          <button key={s} className={`btn btn-sm ${filters.status===s?'btn-primary':'btn-ghost'}`}
            onClick={() => setF({ status: s })}>
            {s || 'All statuses'}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="tbl-wrap">
          {loading ? <p style={{ padding:24 }} className="text-muted">Loading audit logs...</p>
          : logs.length === 0 ? (
            <div className="empty"><div className="empty-icon">🔐</div><h3>No logs found</h3><p>Try a different filter</p></div>
          ) : (
            <table>
              <thead>
                <tr><th>#</th><th>Time</th><th>Action</th><th>User</th><th>Entity</th><th>IP</th><th>Status</th><th>Details</th></tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <React.Fragment key={log.id}>
                    <tr onClick={() => setExpanded(expanded === log.id ? null : log.id)} style={{ cursor:'pointer' }}>
                      <td className="text-muted" style={{ fontSize:11 }}>{log.id}</td>
                      <td style={{ fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>
                        {new Date(log.created_at).toLocaleString('en-IN',{ hour12:false })}
                      </td>
                      <td>
                        <span style={{
                          fontFamily:'monospace', fontSize:11, fontWeight:700,
                          color: getColor(log.action),
                          background: getColor(log.action).replace('var(','').replace(')','') + '18' ,
                          padding:'2px 8px', borderRadius:4,
                          backgroundColor: getColor(log.action) + '22',
                        }}>{log.action}</span>
                      </td>
                      <td style={{ fontSize:12 }}>{log.user_email || <span className="text-muted">—</span>}</td>
                      <td style={{ fontSize:12 }}>{log.entity_type ? `${log.entity_type} #${log.entity_id}` : <span className="text-muted">—</span>}</td>
                      <td style={{ fontSize:11, fontFamily:'monospace', color:'var(--muted)' }}>{log.ip_address || '—'}</td>
                      <td><span className={`badge ${STATUS_BADGE[log.status]||'badge-gray'}`}>{log.status}</span></td>
                      <td style={{ fontSize:12, color:'var(--muted)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.details || '—'}</td>
                    </tr>
                    {expanded === log.id && (
                      <tr>
                        <td colSpan={8} style={{ background:'#fafbfd', padding:'14px 18px' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, fontSize:12 }}>
                            {log.old_values && (
                              <div>
                                <strong className="text-muted">Old Values</strong>
                                <pre style={{ marginTop:6, background:'#fff', padding:10, borderRadius:8, border:'1px solid var(--border)', fontSize:11, overflow:'auto' }}>
                                  {JSON.stringify(JSON.parse(log.old_values), null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.new_values && (
                              <div>
                                <strong className="text-muted">New Values</strong>
                                <pre style={{ marginTop:6, background:'#fff', padding:10, borderRadius:8, border:'1px solid var(--border)', fontSize:11, overflow:'auto' }}>
                                  {JSON.stringify(JSON.parse(log.new_values), null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.user_agent && (
                              <div style={{ gridColumn:'1/-1' }}>
                                <strong className="text-muted">User Agent</strong>
                                <p style={{ marginTop:4, color:'var(--light)', wordBreak:'break-all', fontSize:11 }}>{log.user_agent}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {total > filters.limit && (
        <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:18, alignItems:'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={filters.page===1}
            onClick={() => setFilters(f => ({ ...f, page: f.page-1 }))}>← Prev</button>
          <span className="text-muted" style={{ fontSize:13 }}>
            Page {filters.page} of {Math.ceil(total/filters.limit)}
          </span>
          <button className="btn btn-ghost btn-sm" disabled={filters.page>=Math.ceil(total/filters.limit)}
            onClick={() => setFilters(f => ({ ...f, page: f.page+1 }))}>Next →</button>
        </div>
      )}
    </div>
  );
}
