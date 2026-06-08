'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { parseUrl } from '@/lib/parseUrl';

// Uniform Iconography (Outline style, 1.5px stroke weight)
const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);

const PlayIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
);

const HistoryIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
);

const CheckCircleIcon = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
    </svg>
);

const ProhibitedIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
    </svg>
);


const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const UserIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>
);

const SaveIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
    </svg>
);

// ── Domain Rating badge ──────────────────────────────────────────────────
const DRBadge = ({ value }) => {
    if (value === null || value === undefined) {
        return <span style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', fontStyle: 'italic' }}>—</span>;
    }
    const n = Number(value);
    const bg = n >= 60 ? '#e6f4ea' : n >= 30 ? '#fef7e0' : '#f1f3f4';
    const fg = n >= 60 ? '#137333' : n >= 30 ? '#b06000' : '#5f6368';
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '24px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 700,
            backgroundColor: bg,
            color: fg,
        }}>
            {Math.round(n)}
        </span>
    );
};

// ── Reevaluation Modal ──────────────────────────────────────────────────
const ReevaluationModal = ({ advertiserName, onClose }) => {
    const [minimalDr, setMinimalDr] = useState(30);
    const [phase, setPhase] = useState('idle'); // 'idle' | 'running' | 'done' | 'error'
    const [errorMsg, setErrorMsg] = useState('');
    const [processedCount, setProcessedCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [results, setResults] = useState([]);
    const [checkedDomains, setCheckedDomains] = useState({});
    const [isUpdatingWhitelist, setIsUpdatingWhitelist] = useState(false);

    // Scroll Lock Hook
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    // Escape key listener (disabled during execution lock)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && phase !== 'running') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [phase, onClose]);

    const startPipeline = async () => {
        if (phase === 'running') return;
        setPhase('running');
        setErrorMsg('');
        setProcessedCount(0);
        setTotalCount(0);
        setResults([]);
        setCheckedDomains({});

        try {
            const startRes = await fetch('/api/reevaluate-inventory/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ advertiserName })
            });
            const startData = await startRes.json();
            if (startData.error) {
                throw new Error(startData.error);
            }

            const total = startData.total;
            setTotalCount(total);

            if (total === 0) {
                setPhase('done');
                return;
            }

            let remaining = total;
            let currentProcessed = 0;
            let allResults = [];

            while (remaining > 0) {
                const processRes = await fetch('/api/reevaluate-inventory/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ advertiserName, minimalDr })
                });

                if (!processRes.ok) {
                    const errorText = await processRes.text();
                    throw new Error(`Process request failed: ${errorText}`);
                }

                const processData = await processRes.json();
                if (processData.error) {
                    throw new Error(processData.error);
                }

                remaining = processData.remaining;
                const batchResults = processData.results || [];
                currentProcessed += batchResults.length;

                setProcessedCount(currentProcessed);
                setResults(prev => [...prev, ...batchResults]);
                allResults = [...allResults, ...batchResults];

                if (batchResults.length === 0 && remaining > 0) {
                    throw new Error('Pipeline returned 0 processed items but claims some are remaining');
                }
            }

            // Auto-check approved domains
            const approved = {};
            allResults.forEach(r => {
                approved[r.domain] = r.status === 'approved';
            });
            setCheckedDomains(approved);
            setPhase('done');
        } catch (err) {
            console.error('Reevaluation loop error:', err);
            setErrorMsg(err.message || 'An unexpected error occurred during reevaluation');
            setPhase('error');
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && phase !== 'running') {
            onClose();
        }
    };

    const updateWhitelist = async () => {
        setIsUpdatingWhitelist(true);
        try {
            const domains = Object.entries(checkedDomains)
                .filter(([_, checked]) => checked)
                .map(([domain]) => domain);

            const res = await fetch('/api/advertiser-inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: advertiserName, domains })
            });
            const data = await res.json();
            if (data.error) {
                alert('Failed to update whitelist: ' + data.error);
            } else {
                onClose();
            }
        } catch (err) {
            alert('Failed to update whitelist: ' + err.message);
        } finally {
            setIsUpdatingWhitelist(false);
        }
    };

    const progressPercentage = totalCount > 0 ? Math.min(100, Math.round((processedCount / totalCount) * 100)) : 0;

    return (
        <div 
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                animation: 'fadeIn 0.2s ease-out'
            }}
        >
            <div 
                style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    width: '90%',
                    maxWidth: '700px',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-soft)',
                    overflow: 'hidden',
                    animation: 'scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
            >
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid var(--divider)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(0,0,0,0.01)'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--foreground)' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67"/>
                            </svg>
                            Reevaluation Pipeline
                        </h2>
                        <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginTop: '2px' }}>
                            Profile: <strong style={{ color: 'var(--foreground)' }}>{advertiserName}</strong>
                        </div>
                    </div>
                    {phase !== 'running' && (
                        <button 
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                color: 'var(--foreground-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px',
                                borderRadius: '4px',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f3f4'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            &times;
                        </button>
                    )}
                </div>

                <div className="scrollbar-thin" style={{
                    padding: '1.5rem',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem'
                }}>
                    {phase === 'idle' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)' }}>
                                This pipeline will verify if the whitelisted domains for <strong>{advertiserName}</strong> still meet our safety and performance criteria:
                            </p>
                            <div style={{
                                backgroundColor: '#f8f9fa',
                                border: '1px solid var(--divider)',
                                borderRadius: '6px',
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                fontSize: '0.8125rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>
                                    <span><strong>Ads.txt Compliance:</strong> Verifies active Google DV360 entry (DIRECT or RESELLER)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>
                                    <span><strong>Domain Rating:</strong> Validates against a custom minimum DR score</span>
                                </div>
                            </div>

                            <div style={{ marginTop: '0.5rem' }}>
                                <label className="label-small" htmlFor="reeval-min-dr">Minimal DR Threshold</label>
                                <input 
                                    id="reeval-min-dr"
                                    type="number"
                                    className="input-field"
                                    value={minimalDr}
                                    onChange={e => setMinimalDr(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    min="0"
                                    max="100"
                                />
                                <span style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', display: 'block', marginTop: '0.25rem' }}>
                                    Domains with Ahrefs rating below this score will be flagged/rejected.
                                </span>
                            </div>
                        </div>
                    )}

                    {phase !== 'idle' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                                <span style={{ fontWeight: 600 }}>
                                    {phase === 'running' && 'Evaluating whitelisted domains...'}
                                    {phase === 'done' && 'Evaluation complete!'}
                                    {phase === 'error' && 'Evaluation stopped due to error'}
                                </span>
                                <span style={{ color: 'var(--foreground-muted)', fontWeight: 500 }}>
                                    {processedCount} of {totalCount} domains
                                </span>
                            </div>

                            <div style={{
                                width: '100%',
                                height: '10px',
                                backgroundColor: '#f1f3f4',
                                borderRadius: '5px',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <div style={{
                                    width: `${progressPercentage}%`,
                                    height: '100%',
                                    backgroundColor: phase === 'error' ? '#c5221f' : 'var(--accent)',
                                    borderRadius: '5px',
                                    transition: 'width 0.3s ease-out'
                                }} />
                            </div>

                            {errorMsg && (
                                <div style={{
                                    backgroundColor: '#fce8e6',
                                    border: '1px solid rgba(197, 34, 31, 0.2)',
                                    color: '#c5221f',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '6px',
                                    fontSize: '0.8125rem',
                                    lineHeight: 1.4
                                }}>
                                    <strong>Error:</strong> {errorMsg}
                                </div>
                            )}

                            {phase === 'done' && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '1rem',
                                    backgroundColor: '#f8f9fa',
                                    border: '1px solid var(--divider)',
                                    borderRadius: '6px',
                                    padding: '1rem',
                                    textAlign: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>Approved</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#137333' }}>
                                            {results.filter(r => r.status === 'approved').length}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>Rejected</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#c5221f' }}>
                                            {results.filter(r => r.status === 'rejected').length}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>Success Rate</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)' }}>
                                            {totalCount > 0 ? `${Math.round((results.filter(r => r.status === 'approved').length / totalCount) * 100)}%` : '0%'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {results.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <span className="label-small">Real-time Results</span>
                                    <div 
                                        className="scrollbar-thin"
                                        style={{
                                            border: '1px solid var(--divider)',
                                            borderRadius: '6px',
                                            maxHeight: '220px',
                                            overflowY: 'auto',
                                            fontSize: '0.8125rem'
                                        }}
                                    >
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '1px solid var(--divider)', zIndex: 1 }}>
                                                <tr>
                                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, textAlign: 'center', width: '55px' }}>Accept</th>
                                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Domain</th>
                                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, textAlign: 'center', width: '60px' }}>DR</th>
                                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, width: '100px' }}>Status</th>
                                                    <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {results.map((res, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #f1f3f4' }}>
                                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!checkedDomains[res.domain]}
                                                                onChange={e => setCheckedDomains(prev => ({ ...prev, [res.domain]: e.target.checked }))}
                                                                disabled={phase === 'running'}
                                                                style={{ width: '16px', height: '16px', cursor: phase === 'running' ? 'default' : 'pointer', accentColor: 'var(--accent)' }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{res.domain}</td>
                                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                            {res.domainRating !== null ? Math.round(res.domainRating) : '—'}
                                                        </td>
                                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                padding: '0.15rem 0.5rem',
                                                                borderRadius: '10px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 600,
                                                                backgroundColor: res.status === 'approved' ? '#e6f4ea' : '#fce8e6',
                                                                color: res.status === 'approved' ? '#137333' : '#c5221f'
                                                            }}>
                                                                {res.status === 'approved' ? 'Approved' : 'Rejected'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--foreground-muted)', fontSize: '0.75rem' }}>
                                                            {res.rejectionReason || 'Compliant'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--divider)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    backgroundColor: 'rgba(0,0,0,0.01)'
                }}>
                    {phase === 'idle' && (
                        <>
                            <button 
                                className="button-secondary"
                                onClick={onClose}
                                style={{ padding: '0.5rem 1.25rem' }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="button-primary"
                                onClick={startPipeline}
                                style={{
                                    padding: '0.5rem 1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.375rem'
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                                Start Pipeline
                            </button>
                        </>
                    )}
                    {phase === 'running' && (
                        <button 
                            className="button-primary"
                            disabled
                            style={{
                                padding: '0.5rem 1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backgroundColor: 'var(--divider)',
                                color: 'var(--foreground-muted)'
                            }}
                        >
                            <svg 
                                style={{ animation: 'spin 1s linear infinite' }} 
                                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            >
                                <line x1="12" y1="2" x2="12" y2="6"></line>
                                <line x1="12" y1="18" x2="12" y2="22"></line>
                                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                                <line x1="2" y1="12" x2="6" y2="12"></line>
                                <line x1="18" y1="12" x2="22" y2="12"></line>
                                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                            </svg>
                            Evaluating...
                        </button>
                    )}
                    {(phase === 'done' || phase === 'error') && (
                        <>
                            {phase === 'done' && (
                                <button 
                                    onClick={updateWhitelist}
                                    disabled={isUpdatingWhitelist}
                                    style={{
                                        padding: '0.5rem 1.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        backgroundColor: isUpdatingWhitelist ? 'var(--divider)' : '#137333',
                                        border: 'none',
                                        color: '#fff',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        cursor: isUpdatingWhitelist ? 'not-allowed' : 'pointer',
                                        fontSize: '0.875rem',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseOver={e => { if (!isUpdatingWhitelist) e.currentTarget.style.backgroundColor = '#0d5c2a'; }}
                                    onMouseOut={e => { if (!isUpdatingWhitelist) e.currentTarget.style.backgroundColor = '#137333'; }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
                                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                        <polyline points="7 3 7 8 15 8"></polyline>
                                    </svg>
                                    {isUpdatingWhitelist ? 'Updating...' : 'Update Whitelist'}
                                </button>
                            )}
                            <button 
                                className="button-secondary"
                                onClick={onClose}
                                style={{ padding: '0.5rem 2rem' }}
                            >
                                Close
                            </button>
                        </>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
};

export default function Home() {
    const initialPipelineState = {
        keyword: 'blog motorcycles',
        topic: '',
        minimalDr: 30,
        targetCount: 10,
        language: 'pl',
        sessionId: null,
        isRunning: false,
        logs: [],
        results: [],
        status: 'Idle',
        meta: { validated: 0, total: 0, iteration: 0 },
        isNewAdvertiser: true,
        pipelineAdvertiserName: ''
    };

    const [webState, setWebState] = useState(initialPipelineState);
    const [activeTab, setActiveTab] = useState('Web Pipeline');

    // Helper to get active pipeline state
    const current = webState;
    const setCurrent = setWebState;

    // Destructure for easy access in JSX (minimizes changes to the rest of the file)
    const { 
        keyword, topic, minimalDr, targetCount, language, sessionId, 
        isRunning, logs, results, status, meta, isNewAdvertiser, 
        pipelineAdvertiserName 
    } = current;

    // Helper setters that update the ACTIVE pipeline state
    const setKeyword = (val) => setCurrent(s => ({ ...s, keyword: val }));
    const setTopic = (val) => setCurrent(s => ({ ...s, topic: val }));
    const setMinimalDr = (val) => setCurrent(s => ({ ...s, minimalDr: val }));
    const setTargetCount = (val) => setCurrent(s => ({ ...s, targetCount: val }));
    const setLanguage = (val) => setCurrent(s => ({ ...s, language: val }));
    const setSessionId = (val) => setCurrent(s => ({ ...s, sessionId: val }));
    const setIsRunning = (val) => setCurrent(s => ({ ...s, isRunning: val }));
    const setLogs = (val) => setCurrent(s => ({ ...s, logs: typeof val === 'function' ? val(s.logs) : val }));
    const setResults = (val) => setCurrent(s => ({ ...s, results: val }));
    const setStatus = (val) => setCurrent(s => ({ ...s, status: val }));
    const setMeta = (val) => setCurrent(s => ({ ...s, meta: typeof val === 'function' ? val(s.meta) : val }));
    const setIsNewAdvertiser = (val) => setCurrent(s => ({ ...s, isNewAdvertiser: val }));
    const setPipelineAdvertiserName = (val) => setCurrent(s => ({ ...s, pipelineAdvertiserName: val }));

    const addLog = (msg) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    // Blacklist State
    const [blacklistText, setBlacklistText] = useState('');
    const [isSavingBl, setIsSavingBl] = useState(false);

    // Advertiser State
    const [advertisers, setAdvertisers] = useState([]);
    const [selectedAdvertiserId, setSelectedAdvertiserId] = useState(null);
    const [advertiserMode, setAdvertiserMode] = useState('existing'); // 'existing' | 'new'
    const [newAdvertiserName, setNewAdvertiserName] = useState('');
    const [activeAdvertiser, setActiveAdvertiser] = useState(null); // for Advertisers tab
    const [advDomainsText, setAdvDomainsText] = useState('');
    const [isSavingAdv, setIsSavingAdv] = useState(false);
    const [newAdvInputName, setNewAdvInputName] = useState(''); // for creating in Advertisers tab

    // Advertiser Inventory State (advertiser_inventory table)
    const [inventoryProfiles, setInventoryProfiles] = useState([]); // [{ name, domains[] }]
    const [selectedProfileName, setSelectedProfileName] = useState(null);
    const [editName, setEditName] = useState('');
    const [editDomains, setEditDomains] = useState('');
    const [isSavingInv, setIsSavingInv] = useState(false);
    const [isDeletingInv, setIsDeletingInv] = useState(false);
    const [isNewProfile, setIsNewProfile] = useState(false); // true = creating new

    // Reevaluation Modal State
    const [reevalModalOpen, setReevalModalOpen] = useState(false);

    const supabase = createBrowserClient();
    const logsEndRef = useRef(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Polling for table updates for both pipelines
    useEffect(() => {
        const fetchResults = async (sid, setter, tableName) => {
            try {
                const { data } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('session_id', sid)
                    .order('created_at', { ascending: false });
                if (data) setter(prev => ({ 
                    ...prev, 
                    results: data, 
                    meta: { ...prev.meta, validated: data.filter(r => r.dv360_status === 'Approved').length, total: data.length } 
                }));
            } catch (e) {
                console.error('Polling error:', e);
            }
        };

        const interval = setInterval(() => {
            if (webState.sessionId) fetchResults(webState.sessionId, setWebState, 'web_current_results');
        }, 3000);

        return () => clearInterval(interval);
    }, [webState.sessionId, supabase]);

    // Fetch Blacklist
    const fetchBlacklist = async () => {
        try {
            const data = await fetch('/api/blacklist').then(r => r.json());
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    // Seed with defaults
                    const defaults = ['youtube.com', 'reddit.com', 'facebook.com', 'youtu.be', 'instagram.com', 'twitter.com', 'x.com'];
                    await fetch('/api/blacklist/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ domains: defaults })
                    });
                    setBlacklistText(defaults.join('\n'));
                } else {
                    setBlacklistText(data.map(d => d.domain).join('\n'));
                }
            }
        } catch (e) {
            console.error('Failed to fetch blacklist:', e);
        }
    };

    useEffect(() => {
        fetchBlacklist();
        fetchAdvertisers();
        fetchInventoryProfiles();
    }, []);

    // Fetch Advertisers
    const fetchAdvertisers = async () => {
        try {
            const data = await fetch('/api/advertisers').then(r => r.json());
            if (Array.isArray(data)) setAdvertisers(data);
        } catch (e) {
            console.error('Failed to fetch advertisers:', e);
        }
    };

    // ── Advertiser Inventory (advertiser_inventory table) ────────────────────
    const fetchInventoryProfiles = async () => {
        try {
            const data = await fetch('/api/advertiser-inventory').then(r => r.json());
            if (Array.isArray(data)) setInventoryProfiles(data);
        } catch (e) {
            console.error('Failed to fetch inventory profiles:', e);
        }
    };

    const saveInventoryProfile = async () => {
        if (!editName.trim()) { alert('Please enter an advertiser name.'); return; }
        setIsSavingInv(true);
        const allDomains = editDomains
            .split(/[\n,]+/)
            .map(d => d.trim().toLowerCase().replace(/ /g, ''))
            .filter(d => d.length > 0);

        // Deduplicate exact matches client-side
        const seen = new Set();
        const domains = [];
        for (const d of allDomains) {
            if (!seen.has(d)) {
                seen.add(d);
                domains.push(d);
            }
        }

        // Sort alphabetically and update textarea immediately
        domains.sort();
        setEditDomains(domains.join('\n'));

        try {
            // If renaming an existing profile, delete the old one first to avoid duplicates
            if (!isNewProfile && selectedProfileName && selectedProfileName !== editName.trim()) {
                await fetch('/api/advertiser-inventory', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: selectedProfileName }),
                });
            }

            const res = await fetch('/api/advertiser-inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim(), domains }),
            });
            const data = await res.json();
            if (data.error) { alert(data.error); return; }
            await fetchInventoryProfiles();
            setSelectedProfileName(editName.trim());
            setIsNewProfile(false);
        } catch (e) {
            console.error('Failed to save inventory profile:', e);
        } finally {
            setIsSavingInv(false);
        }
    };

    const deleteInventoryProfile = async (name) => {
        if (!confirm(`Delete advertiser profile "${name}" and all its domains?`)) return;
        setIsDeletingInv(true);
        try {
            await fetch('/api/advertiser-inventory', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            await fetchInventoryProfiles();
            if (selectedProfileName === name) {
                setSelectedProfileName(null);
                setEditName('');
                setEditDomains('');
                setIsNewProfile(false);
            }
        } catch (e) {
            console.error('Failed to delete inventory profile:', e);
        } finally {
            setIsDeletingInv(false);
        }
    };

    const selectInventoryProfile = (profile) => {
        setSelectedProfileName(profile.name);
        setEditName(profile.name);
        setEditDomains(profile.domains.join('\n'));
        setIsNewProfile(false);
    };

    const startNewProfile = () => {
        setSelectedProfileName(null);
        setEditName('');
        setEditDomains('');
        setIsNewProfile(true);
    };

    const createAdvertiser = async (name) => {
        if (!name?.trim()) return null;
        try {
            const res = await fetch('/api/advertisers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            });
            const data = await res.json();
            if (data.error) { alert(data.error); return null; }
            await fetchAdvertisers();
            return data;
        } catch (e) {
            console.error('Failed to create advertiser:', e);
            return null;
        }
    };

    const deleteAdvertiser = async (advId) => {
        if (!confirm('Delete this advertiser and all its domains?')) return;
        try {
            await fetch('/api/advertisers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: advId })
            });
            if (activeAdvertiser?.id === advId) {
                setActiveAdvertiser(null);
                setAdvDomainsText('');
            }
            if (selectedAdvertiserId === advId) setSelectedAdvertiserId(null);
            await fetchAdvertisers();
        } catch (e) {
            console.error('Failed to delete advertiser:', e);
        }
    };

    const loadAdvertiserDomains = async (adv) => {
        setActiveAdvertiser(adv);
        try {
            const data = await fetch(`/api/advertisers/${adv.id}/domains`).then(r => r.json());
            if (Array.isArray(data)) {
                setAdvDomainsText(data.map(d => d.domain).join('\n'));
            }
        } catch (e) {
            console.error('Failed to load advertiser domains:', e);
        }
    };

    const saveAdvertiserDomains = async () => {
        if (!activeAdvertiser) return;
        setIsSavingAdv(true);
        const domains = advDomainsText
            .split(/[\n,]+/)
            .map(d => d.trim().toLowerCase())
            .filter(d => d.length > 0);
        try {
            await fetch(`/api/advertisers/${activeAdvertiser.id}/domains/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domains })
            });
            await fetchAdvertisers();
        } catch (e) {
            console.error('Failed to save advertiser domains:', e);
        } finally {
            setIsSavingAdv(false);
        }
    };

    const handleBlacklistSingle = async (domain, id) => {
        try {
            // 1. Add to persistent blacklist
            await fetch('/api/blacklist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, reason: 'Manual blacklist from results' })
            });

            // 2. Update web_current_results in DB
            await supabase
                .from('web_current_results')
                .update({ dv360_status: 'Blacklisted', rejection_reason: 'Manually blacklisted' })
                .eq('id', id);

            // 3. Update local state
            setResults(prev => prev.map(r => r.id === id ? { ...r, dv360_status: 'Blacklisted', rejection_reason: 'Manually blacklisted' } : r));
            
            // 4. Update meta validated count
            const validated = results.filter(r => r.id !== id && r.dv360_status === 'Approved').length;
            setMeta(m => ({ ...m, validated }));

            addLog(`🚫 Blacklisted: ${domain}`);
            
            // Re-fetch blacklist text to keep it in sync
            fetchBlacklist();
        } catch (e) {
            console.error('Failed to blacklist domain:', e);
            addLog(`❌ Failed to blacklist: ${domain}`);
        }
    };

    const saveBlacklist = async () => {
        setIsSavingBl(true);
        const allDomains = blacklistText
            .split(/[\n,]+/)
            .map(d => d.trim().toLowerCase().replace(/ /g, ''))
            .filter(d => d.length > 0);

        // Deduplicate exact matches client-side
        const seen = new Set();
        const domains = [];
        for (const d of allDomains) {
            if (!seen.has(d)) {
                seen.add(d);
                domains.push(d);
            }
        }

        // Sort alphabetically and update textarea immediately
        domains.sort();
        setBlacklistText(domains.join('\n'));
        
        try {
            await fetch('/api/blacklist/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domains })
            });
            await fetchBlacklist();
        } catch (e) {
            console.error('Failed to save blacklist', e);
        } finally {
            setIsSavingBl(false);
        }
    };

    const handleSaveToAdvertiser = async (domain) => {
        const targetId = selectedAdvertiserId;
        if (!targetId) { alert('Please select an advertiser in Pipeline Controls first.'); return; }
        try {
            await fetch(`/api/advertisers/${targetId}/domains`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain })
            });
            await fetchAdvertisers();
            addLog(`💾 Saved ${domain} to advertiser profile.`);
        } catch (e) {
            console.error('Failed to save domain to advertiser:', e);
        }
    };

    const startLoop = async () => {
        // Capture the pipeline type and state at start
        const setter = setWebState;
        const getPState = () => webState; 
        
        const stateAtStart = getPState();
        if (stateAtStart.isRunning) return;

        // Functional update helpers
        const updateP = (updates) => setter(prev => ({ ...prev, ...updates }));
        const addPLog = (msg) => setter(prev => ({ 
            ...prev, 
            logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${msg}`] 
        }));

        updateP({ isRunning: true, logs: [], results: [] });
        const sid = crypto.randomUUID();
        updateP({ sessionId: sid, meta: { validated: 0, total: 0, iteration: 1 } });

        let currentKeyword = stateAtStart.keyword;
        const previousKeywords = [];
        let quotaMet = false;

        // Resolve advertiser Name
        let advName = null;
        if (!stateAtStart.isNewAdvertiser && stateAtStart.pipelineAdvertiserName) {
            advName = stateAtStart.pipelineAdvertiserName;
            addPLog(`👤 Excluding domains for advertiser: ${advName}`);
        } else {
            addPLog(`👤 Global search (no specific advertiser domains excluded)`);
        }

        addPLog(`🚀 Starting session: ${sid}`);

        try {
            while (!quotaMet) {
                setter(prev => ({ ...prev, meta: { ...prev.meta, iteration: previousKeywords.length + 1 } }));

                addPLog(`--- Iteration ${previousKeywords.length + 1}: searching "${currentKeyword}" ---`);

                updateP({ status: `Searching Internal Database...` });
                const internalRes = await fetch('/api/search-internal', {
                    method: 'POST',
                    body: JSON.stringify({ keyword: currentKeyword, topic: stateAtStart.topic, language: stateAtStart.language, sessionId: sid, advertiserName: advName }),
                }).then(r => r.json());

                if (internalRes.count > 0) {
                    addPLog(`✅ Found ${internalRes.count} pre-approved internal results.`);
                }

                updateP({ status: `Searching Web: ${currentKeyword}` });
                const searchRes = await fetch('/api/search', {
                    method: 'POST',
                    body: JSON.stringify({ keyword: currentKeyword, language: stateAtStart.language, sessionId: sid, advertiserName: advName }),
                }).then(r => r.json());

                if (searchRes.error) throw new Error(searchRes.error);
                addPLog(`✅ Found ${searchRes.count} web results. SearchId: ${searchRes.searchId}`);

                updateP({ status: 'Checking blacklists...' });
                const blRes = await fetch('/api/check-blacklist', {
                    method: 'POST',
                    body: JSON.stringify({ searchId: searchRes.searchId }),
                }).then(r => r.json());
                addPLog(`🚫 Blacklist check: ${blRes.blacklistedCount} domains dropped.`);

                updateP({ status: 'Verifying ads.txt files...' });
                let remaining = 1;
                while (remaining > 0) {
                    const verifyRes = await fetch('/api/verify-ads-txt', {
                        method: 'POST',
                        body: JSON.stringify({ sessionId: sid }),
                    }).then(r => r.json());
                    remaining = verifyRes.remaining;
                    addPLog(`⏳ Verified ads.txt batch. Remaining: ${remaining}`);
                }

                updateP({ status: 'Verifying Domain Ratings / Subscribers...' });
                const drRes = await fetch('/api/domain-rating', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        sessionId: sid, 
                        minimalDr: stateAtStart.minimalDr, 
                        keyword: currentKeyword, 
                        topic: stateAtStart.topic 
                    }),
                }).then(r => r.json());
                addPLog(`📈 DR check: processed ${drRes.domains} domains.`);

                updateP({ status: 'Evaluating quota...' });
                const quotaRes = await fetch('/api/check-quota', {
                    method: 'POST',
                    body: JSON.stringify({ sessionId: sid, requiredCount: stateAtStart.targetCount }),
                }).then(r => r.json());

                addPLog(`📊 Quota: ${quotaRes.validatedCount}/${stateAtStart.targetCount} validated URLs.`);

                if (quotaRes.isMet) {
                    quotaMet = true;
                    addPLog('✨ SUCCESS: Target count reached!');
                } else {
                    addPLog('🔄 Quota not met. Mutating keyword...');
                    previousKeywords.push(currentKeyword);

                    updateP({ status: 'Mutating keyword with Gemini...' });
                    const mutRes = await fetch('/api/mutate-keyword', {
                        method: 'POST',
                        body: JSON.stringify({ keyword: currentKeyword, previousKeywords }),
                    }).then(r => r.json());

                    if (mutRes.error) throw new Error(`Keyword Mutation Failed: ${mutRes.error}`);
                    if (!mutRes.newKeyword) throw new Error('Received empty keyword from mutation service');

                    currentKeyword = mutRes.newKeyword;
                    addPLog(`💡 New keyword: "${currentKeyword}"`);
                }
            }
        } catch (err) {
            console.error('Loop Error:', err);
            addPLog(`❌ Error: ${err.message}`);
        } finally {
            updateP({ isRunning: false, status: 'Completed' });
        }
    };

    const copyApprovedToClipboard = async () => {
        const approved = results
            .filter(r => r.dv360_status === 'Approved')
            .map(r => (r.display_path || parseUrl(r.full_url)?.display_path || r.full_url))
            .join('\n');
            
        if (!approved) {
            alert('No approved domains found to copy.');
            return;
        }

        try {
            await navigator.clipboard.writeText(approved);
            addLog(`📋 Copied ${approved.split('\n').length} approved domains to clipboard.`);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            alert('Failed to copy to clipboard.');
        }
    };

    const renderFreshnessBadge = () => {
        if (isNewProfile || !selectedProfileName) return null;
        const profile = inventoryProfiles.find(p => p.name === selectedProfileName);
        if (!profile || !profile.oldestCreatedAt) return null;
        
        const then = new Date(profile.oldestCreatedAt);
        const now = new Date();
        const diffDays = Math.ceil(Math.abs(now - then) / (1000 * 60 * 60 * 24));
        const diffMonths = Math.round(diffDays / 30);
        
        let text = '1 month ago';
        let bgColor = '#f1f3f4';
        let fgColor = '#5f6368'; // light grey
        
        if (diffMonths > 3) {
            text = '6 months ago';
            bgColor = '#fce8e6';
            fgColor = '#c5221f'; // red
        } else if (diffMonths > 1) {
            text = '3 months ago';
            bgColor = '#fef7e0';
            fgColor = '#b06000'; // yellow
        }

        return (
            <div style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: bgColor,
                color: fgColor,
            }}>
                {text}
            </div>
        );
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Top Navigation - F-Pattern */}
            <header style={{ 
                height: '64px', 
                backgroundColor: 'var(--surface)', 
                borderBottom: '1px solid var(--divider)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 2rem',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            backgroundColor: 'var(--accent)', 
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <SearchIcon />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.02em', color: 'var(--foreground)' }}>Antigravity</span>
                    </div>
                    
                    <nav style={{ display: 'flex', gap: '1.5rem', color: 'var(--foreground-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
                        {['Web Pipeline', 'Advertisers', 'Blacklist'].map(tab => (
                            <a 
                                key={tab}
                                href="#" 
                                onClick={(e) => { e.preventDefault(); setActiveTab(tab); }}
                                style={{ 
                                    color: activeTab === tab ? 'var(--accent)' : 'inherit', 
                                    borderBottom: activeTab === tab ? '2px solid var(--accent)' : 'none', 
                                    padding: '1.25rem 0',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {tab}
                            </a>
                        ))}
                    </nav>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Current Session</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{sessionId?.slice(0, 8) || 'No active session'}</div>
                    </div>
                    <div className="divider-v" style={{ height: '32px' }}></div>
                    <button className="button-primary" style={{ borderRadius: '20px', padding: '0.5rem 1.25rem' }}>Share Results</button>
                </div>
            </header>

            <main style={{ flex: 1, padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                {/* Status Banner */}
                <div style={{ 
                    marginBottom: '2rem', 
                    padding: '1rem 1.5rem', 
                    backgroundColor: isRunning ? 'rgba(88, 166, 92, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    border: '1px solid',
                    borderColor: isRunning ? 'rgba(88, 166, 92, 0.2)' : 'var(--divider)',
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: isRunning ? 'var(--accent)' : 'var(--foreground-muted)',
                            boxShadow: isRunning ? '0 0 0 4px rgba(88, 166, 92, 0.1)' : 'none'
                        }}></div>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>System status: <span style={{ color: isRunning ? 'var(--accent)' : 'var(--foreground)' }}>{status}</span></span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)' }}>
                        <strong>Iteration:</strong> {meta.iteration} • <strong>Validated:</strong> {meta.validated}/{targetCount}
                    </div>
                </div>

                {(activeTab === 'Web Pipeline') ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem' }}>
                        {/* Controls Sidebar */}
                        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <section className="card" style={{ boxShadow: 'var(--shadow-subtle)', padding: '1.5rem' }}>
                                <h3 className="label-small" style={{ marginBottom: '1.5rem' }}>Pipeline Controls</h3>
                                
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label className="label-small">Seed Keyword</label>
                                    <input 
                                        className="input-field"
                                        type="text"
                                        value={keyword}
                                        onChange={(e) => setKeyword(e.target.value)}
                                        disabled={isRunning}
                                        placeholder="e.g. blog motorcycles"
                                    />
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label className="label-small">Minimal DR</label>
                                    <input 
                                        className="input-field"
                                        type="number"
                                        value={minimalDr}
                                        onChange={(e) => setMinimalDr(e.target.value)}
                                        disabled={isRunning}
                                    />
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label className="label-small">Target Count</label>
                                    <input 
                                        className="input-field"
                                        type="number"
                                        value={targetCount}
                                        onChange={(e) => setTargetCount(e.target.value)}
                                        disabled={isRunning}
                                    />
                                </div>


                                <div style={{ marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <input 
                                            type="checkbox" 
                                            id="new-advertiser-toggle"
                                            checked={isNewAdvertiser} 
                                            onChange={(e) => setIsNewAdvertiser(e.target.checked)}
                                            disabled={isRunning}
                                        />
                                        <label htmlFor="new-advertiser-toggle" className="label-small" style={{ marginBottom: 0, cursor: 'pointer' }}>
                                            New Advertiser
                                        </label>
                                    </div>
                                    <label className="label-small" style={{ opacity: isNewAdvertiser ? 0.5 : 1, display: 'block', marginBottom: '0.25rem' }}>Advertiser Profile</label>
                                    <select 
                                        className="input-field"
                                        value={pipelineAdvertiserName}
                                        onChange={(e) => setPipelineAdvertiserName(e.target.value)}
                                        disabled={isRunning || isNewAdvertiser}
                                    >
                                        <option value="">-- Select Advertiser --</option>
                                        {inventoryProfiles.map(p => (
                                            <option key={p.name} value={p.name}>{p.name} ({p.domains.length} domains)</option>
                                        ))}
                                    </select>
                                </div>

                                <button 
                                    className="button-primary" 
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}
                                    onClick={startLoop}
                                    disabled={isRunning}
                                >
                                    <PlayIcon />
                                    {isRunning ? 'Processing...' : 'Start Pipeline'}
                                </button>
                            </section>

                            <section className="card" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', maxHeight: '500px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <HistoryIcon />
                                    <h3 className="label-small" style={{ marginBottom: 0 }}>Execution Logs</h3>
                                </div>
                                <div className="scrollbar-thin" style={{ 
                                    flex: 1, 
                                    overflowY: 'auto', 
                                    fontSize: '0.75rem', 
                                    color: 'var(--foreground-muted)',
                                    fontFamily: 'var(--font-mono, monospace)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem'
                                }}>
                                    {logs.map((log, i) => (
                                        <div key={i} style={{ borderLeft: '2px solid var(--divider)', paddingLeft: '0.75rem' }}>{log}</div>
                                    ))}
                                    <div ref={logsEndRef} />
                                    {logs.length === 0 && <div style={{ fontStyle: 'italic', opacity: 0.5 }}>System idle. Waiting for start...</div>}
                                </div>
                            </section>
                        </aside>

                        {/* Main Results Workspace */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* Stats Dashboard */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                                {[
                                    { label: 'Validated Domains', val: meta.validated, total: targetCount, color: 'var(--accent)' },
                                    { label: 'Retrieved URLs', val: meta.total, color: 'var(--foreground)' },
                                    { label: 'Current Iteration', val: meta.iteration, color: 'var(--foreground)' }
                                ].map((stat, i) => (
                                    <div key={i} className="card" style={{ padding: '1.25rem', borderLeft: `4px solid ${stat.color || 'var(--divider)'}` }}>
                                        <div className="label-small">{stat.label}</div>
                                        <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                                            {stat.val}
                                            {stat.total && <span style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', fontWeight: 400 }}> / {stat.total}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                             {/* Results Table */}
                            <section className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 className="label-small" style={{ marginBottom: 0 }}>
                                        Real-time Domain Inventory
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>{results.length} total entries found</div>
                                        <button 
                                            className="button-secondary" 
                                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                            onClick={copyApprovedToClipboard}
                                            disabled={results.filter(r => r.dv360_status === 'Approved').length === 0}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                            Copy Approved
                                        </button>
                                    </div>
                                </div>
                                <div className="scrollbar-thin" style={{ overflow: 'auto', maxHeight: '600px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                                        <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', borderBottom: '1px solid var(--divider)', zIndex: 1 }}>
                                            <tr>
                                                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>
                                                    Domain / Folder
                                                </th>
                                                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>
                                                    Meta Title
                                                </th>
                                                <th style={{ padding: '1rem 0.75rem', fontWeight: 600, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }} title="Domain Rating (Ahrefs)">
                                                    DR ↓
                                                </th>
                                                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>Status</th>
                                                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>Verification Note</th>
                                                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--foreground-muted)' }}>Black-list</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map(row => (
                                                <tr key={row.id} style={{ borderBottom: '1px solid #f1f3f4', transition: 'background-color 0.1s' }}>
                                                    <td style={{ padding: '1rem 1.5rem', maxWidth: '300px' }}>
                                                        <a 
                                                            href={row.full_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
                                                        >
                                                            {row.display_path || parseUrl(row.full_url)?.display_path || row.full_url}
                                                        </a>
                                                    </td>
                                                    <td style={{ padding: '1rem 1.5rem', color: 'var(--foreground-muted)' }}>
                                                        <div style={{ 
                                                            maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem' 
                                                        }} title={row.title}>
                                                            {row.title || <span style={{ color: 'var(--foreground-muted)', fontStyle: 'italic' }}>No title</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                                                        <DRBadge value={row.domain_rating} />
                                                    </td>
                                                    <td style={{ padding: '1rem 1.5rem' }}>
                                                        <div style={{ 
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.375rem',
                                                            padding: '0.25rem 0.625rem',
                                                            borderRadius: '12px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            backgroundColor: 
                                                                row.dv360_status === 'Approved' ? '#e6f4ea' :
                                                                row.dv360_status === 'Rejected' ? '#fce8e6' :
                                                                '#fef7e0',
                                                            color: 
                                                                row.dv360_status === 'Approved' ? '#137333' :
                                                                row.dv360_status === 'Rejected' ? '#c5221f' :
                                                                '#b06000'
                                                        }}>
                                                            {row.dv360_status === 'Approved' && <CheckCircleIcon />}
                                                            {row.dv360_status}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem 1.5rem', color: 'var(--foreground-muted)', fontSize: '0.75rem' }}>
                                                        <div style={{ maxWidth: '200px' }}>{row.rejection_reason || 'Compliant domain'}</div>
                                                    </td>
                                                    <td style={{ padding: '1rem 1.5rem' }}>
                                                        {row.dv360_status !== 'Blacklisted' && (
                                                            <button 
                                                                onClick={() => handleBlacklistSingle(row.root_domain, row.id)}
                                                                title="Blacklist domain"
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: 'var(--foreground-muted)',
                                                                    cursor: 'pointer',
                                                                    padding: '4px',
                                                                    borderRadius: '4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseOver={(e) => e.currentTarget.style.color = '#c5221f'}
                                                                onMouseOut={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
                                                            >
                                                                <ProhibitedIcon />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {results.length === 0 && (
                                                <tr>
                                                    <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--foreground-muted)' }}>
                                                        <div style={{ opacity: 0.5, marginBottom: '0.5rem' }}>No data collected for this session yet.</div>
                                                        <div style={{ fontSize: '0.75rem' }}>Start the pipeline to begin the search and validation loop.</div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>
                    </div>
                ) : activeTab === 'Blacklist' ? (
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <section className="card" style={{ padding: '2rem' }}>
                            <div style={{ marginBottom: '1.5rem', borderBottom: '2px solid var(--accent)', paddingBottom: '1rem', display: 'inline-block' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Exclude</h3>
                            </div>
                            
                            <div style={{ border: '1px solid var(--divider)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                                <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', marginBottom: '1rem' }}>
                                    Enter a list of domains to exclude, either one item to a line or separated by commas.
                                </p>
                                
                                <textarea
                                    className="input-field scrollbar-thin"
                                    value={blacklistText}
                                    onChange={(e) => setBlacklistText(e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        minHeight: '400px', 
                                        resize: 'vertical',
                                        fontFamily: 'var(--font-mono, monospace)',
                                        fontSize: '0.875rem',
                                        lineHeight: 1.5,
                                        padding: '0.75rem',
                                        border: '1px solid var(--divider)',
                                        borderRadius: '4px'
                                    }}
                                    placeholder="youtube.com&#10;reddit.com&#10;facebook.com"
                                />
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                                        {blacklistText.split(/[\n,]+/).filter(d => d.trim().length > 0).length} domains listed
                                    </div>
                                    <button 
                                        className="button-primary" 
                                        onClick={saveBlacklist}
                                        disabled={isSavingBl}
                                        style={{ padding: '0.5rem 2rem' }}
                                    >
                                        {isSavingBl ? 'Saving...' : 'Save Blacklist'}
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                ) : activeTab === 'Advertisers' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem', alignItems: 'start' }}>

                        {/* Left: Profile List */}
                        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button
                                id="adv-inv-new-btn"
                                className="button-primary"
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem' }}
                                onClick={startNewProfile}
                            >
                                <PlusIcon /> Create New Advertiser
                            </button>

                            <section className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '200px' }}>
                                <span className="label-small" style={{ marginBottom: '0.25rem' }}>Advertiser Profiles</span>
                                {inventoryProfiles.length === 0 && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', fontStyle: 'italic', padding: '1rem 0', textAlign: 'center' }}>
                                        No profiles yet. Create your first one.
                                    </div>
                                )}
                                {inventoryProfiles.map(profile => (
                                    <div
                                        key={profile.name}
                                        id={`adv-inv-profile-${profile.name.replace(/\s+/g, '-').toLowerCase()}`}
                                        className={`advertiser-item${selectedProfileName === profile.name && !isNewProfile ? ' active' : ''}`}
                                        onClick={() => selectInventoryProfile(profile)}
                                    >
                                        <div>
                                            <div className="name">{profile.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: '2px' }}>
                                                {profile.domains.length} domain{profile.domains.length !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                        <button
                                            className="button-danger"
                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                            onClick={(e) => { e.stopPropagation(); deleteInventoryProfile(profile.name); }}
                                            disabled={isDeletingInv}
                                            title="Delete advertiser profile"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                ))}
                            </section>
                        </aside>

                        {/* Right: Profile Editor */}
                        <section className="card" style={{ padding: '2rem' }}>
                            {!isNewProfile && !selectedProfileName ? (
                                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--foreground-muted)' }}>
                                    <UserIcon />
                                    <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Select an advertiser profile from the list, or create a new one.</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ marginBottom: '1.5rem', borderBottom: '2px solid var(--accent)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                                            {isNewProfile ? '✨ New Advertiser Profile' : `Editing: ${selectedProfileName}`}
                                        </h3>
                                        {renderFreshnessBadge()}
                                    </div>

                                    {/* Name Field */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label className="label-small" htmlFor="adv-inv-name">Name</label>
                                        <input
                                            id="adv-inv-name"
                                            className="input-field"
                                            type="text"
                                            placeholder="e.g. Acme Corporation"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                        />
                                        <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: '0.35rem' }}>
                                            The advertiser's display name. Used as the unique identifier in the database.
                                        </div>
                                    </div>

                                    {/* Whitelist Field */}
                                    <div style={{ marginBottom: '2rem' }}>
                                        <label className="label-small" htmlFor="adv-inv-whitelist">Whitelist</label>
                                        <textarea
                                            id="adv-inv-whitelist"
                                            className="input-field scrollbar-thin"
                                            placeholder={`example.com\nblog.example.com\nanotherdomain.pl`}
                                            value={editDomains}
                                            onChange={e => setEditDomains(e.target.value)}
                                            style={{
                                                minHeight: '320px',
                                                resize: 'vertical',
                                                fontFamily: 'var(--font-mono, monospace)',
                                                fontSize: '0.875rem',
                                                lineHeight: 1.6,
                                                padding: '0.75rem',
                                            }}
                                        />
                                        <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: '0.35rem' }}>
                                            Domains this advertiser works with — one per line or comma-separated.
                                            <strong style={{ color: 'var(--foreground)' }}> {editDomains.split(/[\n,]+/).filter(d => d.trim().length > 0).length} domains listed.</strong>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <button
                                            id="adv-inv-save-btn"
                                            className="button-primary"
                                            onClick={saveInventoryProfile}
                                            disabled={isSavingInv || !editName.trim()}
                                            style={{ padding: '0.6rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                            <SaveIcon />
                                            {isSavingInv ? 'Saving...' : 'Save Whitelist'}
                                        </button>
                                        <button
                                            className="button-secondary"
                                            onClick={() => { setSelectedProfileName(null); setIsNewProfile(false); setEditName(''); setEditDomains(''); }}
                                            style={{ padding: '0.6rem 1.25rem' }}
                                        >
                                            Cancel
                                        </button>
                                        {selectedProfileName && !isNewProfile && (
                                            <button
                                                id="adv-inv-reevaluate-btn"
                                                className="button-primary"
                                                onClick={() => setReevalModalOpen(true)}
                                                style={{ 
                                                    padding: '0.6rem 1.5rem', 
                                                    backgroundColor: '#137333',
                                                    border: 'none',
                                                    color: 'white',
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onMouseOver={e => e.currentTarget.style.backgroundColor = '#0d5c2a'}
                                                onMouseOut={e => e.currentTarget.style.backgroundColor = '#137333'}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67"/>
                                                </svg>
                                                Reevaluation
                                            </button>
                                        )}
                                        {selectedProfileName && !isNewProfile && (
                                            <button
                                                className="button-danger"
                                                onClick={() => deleteInventoryProfile(selectedProfileName)}
                                                disabled={isDeletingInv}
                                                style={{ marginLeft: 'auto', padding: '0.6rem 1.25rem' }}
                                            >
                                                {isDeletingInv ? 'Deleting...' : 'Delete Profile'}
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </section>
                    </div>
                ) : (
                    <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        <h3>{activeTab} Content</h3>
                        <p>This section is currently under development.</p>
                    </div>
                )}
            </main>

            <footer style={{ 
                padding: '1.5rem 2rem', 
                borderTop: '1px solid var(--divider)', 
                backgroundColor: 'var(--surface)',
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--foreground-muted)',
                fontSize: '0.75rem'
            }}>
                <div>© 2026 Antigravity Systems • Internal Domain Search Pipeline</div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <span>System v1.0.4</span>
                    <span>•</span>
                    <span>Supabase Connected</span>
                    <span>•</span>
                    <span>Gemini AI Active</span>
                </div>
            </footer>

            {/* Reevaluation Modal Popup */}
            {reevalModalOpen && selectedProfileName && (
                <ReevaluationModal 
                    advertiserName={selectedProfileName} 
                    onClose={() => {
                        setReevalModalOpen(false);
                        fetchInventoryProfiles();
                    }} 
                />
            )}
        </div>
    );
}
