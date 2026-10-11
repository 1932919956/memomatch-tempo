import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPublicClient, defineChain, formatUnits, getAddress, http, parseAbi, parseEventLogs, parseUnits, toHex } from 'viem';
import './style.css';

const RPC_URL = 'https://rpc.moderato.tempo.xyz';
const TOKEN = '0x20c0000000000000000000000000000000000001';
const EXPLORER = 'https://explore.tempo.xyz';
const tempoModerato = defineChain({
  id: 42431,
  name: 'Tempo Moderato',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Tempo Explorer', url: EXPLORER } },
});
const transferWithMemoAbi = parseAbi([
  'event TransferWithMemo(address indexed from, address indexed to, uint256 amount, bytes32 indexed memo)',
]);
const client = createPublicClient({ chain: tempoModerato, transport: http(RPC_URL) });
const STORAGE_KEY = 'memomatch-invoices-v1';
const starterInvoices = [
  { id: 'MM-2601-0042', customer: 'Northstar Studio', amount: '240.00', currency: 'AlphaUSD', due: 'Today', status: 'Awaiting', created: 'Today' },
  { id: 'MM-2601-0041', customer: 'Fieldnote Supply', amount: '86.50', currency: 'AlphaUSD', due: 'Oct 14', status: 'Awaiting', created: 'Today' },
  { id: 'MM-2601-0038', customer: 'Goodform Works', amount: '1,250.00', currency: 'AlphaUSD', due: 'Oct 12', status: 'Paid', created: 'Oct 9', tx: '0x7f2d...a941', sample: true },
  { id: 'MM-2601-0036', customer: 'Morrow Market', amount: '32.00', currency: 'AlphaUSD', due: 'Oct 11', status: 'Overdue', created: 'Oct 8' },
];

function loadInvoices() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : starterInvoices;
  } catch {
    return starterInvoices;
  }
}

function shortAddress(value) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : 'Not set';
}

function App() {
  const [invoices, setInvoices] = useState(loadInvoices);
  const [filter, setFilter] = useState('All invoices');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [recipient, setRecipient] = useState(localStorage.getItem('memomatch-recipient') || '');
  const [form, setForm] = useState({ customer: '', amount: '', due: '' });
  const [txHash, setTxHash] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => invoices.filter((invoice) => {
    const matchesFilter = filter === 'All invoices' || invoice.status === filter;
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || `${invoice.id} ${invoice.customer}`.toLowerCase().includes(needle);
    return matchesFilter && matchesQuery;
  }), [invoices, filter, query]);
  const outstanding = invoices.filter((invoice) => invoice.status !== 'Paid').reduce((sum, invoice) => sum + Number(invoice.amount), 0);
  const paid = invoices.filter((invoice) => invoice.status === 'Paid').reduce((sum, invoice) => sum + Number(invoice.amount), 0);

  function persist(next) {
    setInvoices(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function flash(text) {
    setNotice(text);
    window.clearTimeout(flash.timer);
    flash.timer = window.setTimeout(() => setNotice(''), 3000);
  }

  function createInvoice(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.customer.trim() || !Number.isFinite(amount) || amount <= 0) return;
    const id = `MM-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;
    const invoice = { id, customer: form.customer.trim(), amount: amount.toFixed(2), currency: 'AlphaUSD', due: form.due || 'No due date', created: 'Just now', status: 'Awaiting' };
    persist([invoice, ...invoices]);
    setForm({ customer: '', amount: '', due: '' });
    setModal(false);
    setSelected(invoice);
    flash('Invoice created. Set your receiving address to share payment instructions.');
  }

  async function copy(text, message = 'Copied to clipboard') {
    try {
      await navigator.clipboard.writeText(text);
      flash(message);
    } catch {
      flash('Clipboard access was blocked by this browser.');
    }
  }

  function saveRecipient(value) {
    try {
      const normalized = getAddress(value.trim());
      setRecipient(normalized);
      localStorage.setItem('memomatch-recipient', normalized);
      setBusy(false);
      flash('Receiving address saved on this device.');
    } catch {
      flash('Enter a valid Tempo wallet address.');
    }
  }

  async function verifyPayment(invoice) {
    setVerifying(true);
    try {
      const hash = txHash.trim();
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Enter a 32-byte transaction hash.');
      if (!recipient) throw new Error('Save your receiving address before checking payments.');
      const chainId = await client.getChainId();
      if (chainId !== 42431) throw new Error(`RPC returned unexpected chain ${chainId}.`);
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transaction did not succeed.');
      const expectedMemo = toHex(invoice.id, { size: 32 }).toLowerCase();
      const logs = parseEventLogs({ abi: transferWithMemoAbi, logs: receipt.logs, strict: false, eventName: 'TransferWithMemo' });
      const match = logs.find((log) => log.address.toLowerCase() === TOKEN.toLowerCase()
        && log.args.to?.toLowerCase() === recipient.toLowerCase()
        && log.args.memo?.toLowerCase() === expectedMemo
        && log.args.amount === parseUnits(invoice.amount, 6));
      if (!match) throw new Error('No matching AlphaUSD transfer found for this recipient, amount and invoice reference.');
      const next = invoices.map((item) => item.id === invoice.id ? { ...item, status: 'Paid', tx: hash, logIndex: match.logIndex, sample: false } : item);
      persist(next);
      setSelected(null);
      setTxHash('');
      flash('Payment verified on Tempo Moderato. Invoice marked paid.');
    } catch (error) {
      flash(error.shortMessage || error.message || 'Could not verify this payment.');
    } finally {
      setVerifying(false);
    }
  }

  function paymentInstructions(invoice) {
    const memo = toHex(invoice.id, { size: 32 });
    return `Tempo Moderato (chain 42431)\nToken: AlphaUSD ${TOKEN}\nRecipient: ${recipient || '[set your receiving address]'}\nAmount: ${invoice.amount} AlphaUSD\nMemo (bytes32): ${memo}\nMemo text: ${invoice.id}`;
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">M</span><span>memomatch</span></div>
      <div className="workspace-label">WORKSPACE</div>
      <button className="nav-item active"><span className="nav-icon">▤</span>Invoices<span className="nav-count">{invoices.length}</span></button>
      <button className="nav-item" onClick={() => setFilter('Paid')}><span className="nav-icon">◎</span>Payment activity</button>
      <div className="sidebar-bottom">
        <div className="network-card"><span className="network-dot"/><div><b>Tempo Moderato</b><small>Test network · AlphaUSD</small></div><span className="chevron">⌄</span></div>
        <button className="account-button" onClick={() => setBusy(true)}><span className="avatar">MM</span><span className="account-meta"><b>Merchant workspace</b><small>{recipient ? shortAddress(recipient) : 'Set receiving address'}</small></span><span className="more">•••</span></button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Invoices</div><div className="top-actions"><a href="https://docs.tempo.xyz/guide/payments/transfer-memos" target="_blank" rel="noreferrer" className="text-link">Tempo payment references ↗</a><button className="icon-button" title="Notifications">♧</button><span className="top-avatar">MM</span></div></header>
      <div className="content">
        <section className="page-heading"><div><div className="eyebrow">PAYMENTS <span className="eyebrow-dot"/> TEMPO MODERATO</div><h1>Invoice desk</h1><p>Track stablecoin invoices and reconcile confirmed payments.</p></div><button className="primary-button" onClick={() => setModal(true)}><span>＋</span> Create invoice</button></section>
        <section className="stats" aria-label="Invoice summary">
          <div className="stat"><div className="stat-label">Outstanding</div><strong>${outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong><div className="stat-foot"><span className="mini-dot orange"/> {invoices.filter((i) => i.status !== 'Paid').length} invoices awaiting payment</div></div>
          <div className="stat"><div className="stat-label">Collected</div><strong>${paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong><div className="stat-foot"><span className="mini-dot green"/> Confirmed on Tempo</div></div>
          <div className="stat stat-network"><div className="stat-label">Receiving account</div><strong className="address-value">{recipient ? shortAddress(recipient) : 'Not connected'}</strong><button className="inline-action" onClick={() => setBusy(true)}>{recipient ? 'Change address' : 'Set address'} <span>→</span></button></div>
        </section>
        <section className="table-section">
          <div className="table-heading"><div><h2>Invoices <span className="row-count">{filtered.length}</span></h2><p>Payment references are public onchain; use opaque IDs, not customer details.</p></div><button className="secondary-button" onClick={() => { setFilter('Awaiting'); flash('Open an invoice to verify its transaction hash.'); }}><span className="refresh">↻</span> Check payments</button></div>
          <div className="toolbar"><div className="tabs">{['All invoices', 'Awaiting', 'Paid', 'Overdue'].map((item) => <button key={item} className={`tab ${filter === item ? 'selected' : ''}`} onClick={() => setFilter(item)}>{item}{item === 'All invoices' && <span>{invoices.length}</span>}</button>)}</div><label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoices" aria-label="Search invoices"/><kbd>⌘ K</kbd></label></div>
          <div className="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Select all invoices" /></th><th>INVOICE</th><th>CUSTOMER</th><th>AMOUNT</th><th>STATUS</th><th>DUE DATE</th><th>CREATED</th><th></th></tr></thead><tbody>
            {filtered.map((invoice) => <tr key={invoice.id} onClick={() => setSelected(invoice)} className="invoice-row"><td><input type="checkbox" aria-label={`Select ${invoice.id}`} onClick={(e) => e.stopPropagation()} /></td><td><button className="invoice-link" onClick={(e) => { e.stopPropagation(); setSelected(invoice); }}>{invoice.id}</button>{invoice.sample && <small className="sample-tag">SAMPLE</small>}</td><td><span className="customer-avatar">{invoice.customer.slice(0, 1)}</span>{invoice.customer}</td><td><b>${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b><small className="currency">{invoice.currency}</small></td><td><span className={`status ${invoice.status.toLowerCase()}`}><i/>{invoice.status}</span></td><td className={invoice.status === 'Overdue' ? 'overdue-date' : ''}>{invoice.due}</td><td>{invoice.created}</td><td><button className="row-menu" title="Invoice actions" onClick={(e) => { e.stopPropagation(); setSelected(invoice); }}>•••</button></td></tr>)}
            {!filtered.length && <tr><td colSpan="8" className="empty-row">No invoices match this view.</td></tr>}
          </tbody></table></div>
          <div className="table-footer"><span>Showing <b>{filtered.length}</b> of <b>{invoices.length}</b> invoices</span><div className="pagination"><button disabled>←</button><button className="page-current">1</button><button disabled>→</button></div></div>
        </section>
        <footer className="footer-note"><span className="shield">✓</span><span>Payments are verified against Tempo transaction receipts. Demo rows are sample data.</span><a href="https://explore.tempo.xyz" target="_blank" rel="noreferrer">Open Tempo Explorer ↗</a></footer>
      </div>
    </main>
    {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    {modal && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setModal(false)}><section className="dialog"><div className="dialog-head"><div><div className="eyebrow">NEW PAYMENT REQUEST</div><h2>Create invoice</h2></div><button className="close-button" onClick={() => setModal(false)} aria-label="Close">×</button></div><form onSubmit={createInvoice}><label>Customer or business name<input required autoFocus maxLength="60" placeholder="e.g. Northstar Studio" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}/></label><div className="form-grid"><label>Amount<input required type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}/></label><label>Due date<input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })}/></label></div><div className="modal-network"><span className="network-dot"/><div><b>AlphaUSD on Tempo Moderato</b><small>6 decimal places · Testnet only</small></div></div><p className="form-hint">An opaque invoice reference will be attached to the payment memo. Customer details stay in this browser.</p><div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="primary-button">Create invoice <span>→</span></button></div></form></section></div>}
    {busy && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setBusy(false)}><section className="dialog"><div className="dialog-head"><div><div className="eyebrow">TEMPO MODERATO · CHAIN 42431</div><h2>Receiving account</h2></div><button className="close-button" onClick={() => setBusy(false)} aria-label="Close">×</button></div><label>Tempo wallet address<input autoFocus placeholder="0x…" defaultValue={recipient} id="recipient-field"/></label><p className="form-hint">Payments will be checked against this address, the AlphaUSD token contract and the invoice memo.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => setBusy(false)}>Cancel</button><button className="primary-button" onClick={() => saveRecipient(document.getElementById('recipient-field').value)}>Save address</button></div></section></div>}
    {selected && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}><section className="dialog detail-dialog"><div className="dialog-head"><div><div className="eyebrow">INVOICE · TEMPO MODERATO</div><h2>{selected.id}</h2></div><button className="close-button" onClick={() => setSelected(null)} aria-label="Close">×</button></div><div className="detail-top"><div><small>AMOUNT DUE</small><strong>${Number(selected.amount).toFixed(2)} <em>AlphaUSD</em></strong></div><span className={`status ${selected.status.toLowerCase()}`}><i/>{selected.status}</span></div><div className="payment-box"><div className="payment-box-head"><b>Payment details</b><button className="inline-action" onClick={() => copy(paymentInstructions(selected), 'Payment instructions copied')}>Copy all ↗</button></div><div className="payment-line"><span>Network</span><b>Tempo Moderato <small>42431</small></b></div><div className="payment-line"><span>Token</span><b>AlphaUSD <small>{shortAddress(TOKEN)}</small></b></div><div className="payment-line"><span>Recipient</span><b>{shortAddress(recipient)} <button className="copy-small" onClick={() => copy(recipient)}>Copy</button></b></div><div className="payment-line"><span>Reference memo</span><b className="mono">{selected.id} <button className="copy-small" onClick={() => copy(toHex(selected.id, { size: 32 }))}>Copy bytes32</button></b></div></div>{selected.status === 'Paid' ? <div className="verified-box"><span>✓</span><div><b>{selected.sample ? 'Sample payment' : 'Verified onchain'}</b><small>{selected.sample ? 'This row is illustrative, not a live transaction.' : selected.tx}</small></div></div> : <><label className="tx-label">Verify a payment transaction<input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x transaction hash" spellCheck="false"/></label><button className="verify-button" disabled={verifying || !txHash} onClick={() => verifyPayment(selected)}>{verifying ? 'Checking receipt…' : 'Verify on Tempo'} <span>→</span></button><p className="form-hint">The receipt must contain a successful AlphaUSD TransferWithMemo event matching this invoice, recipient and exact amount.</p></>}
      <div className="dialog-actions"><button className="secondary-button" onClick={() => setSelected(null)}>Close</button><a className="explorer-link" href={selected.tx && !selected.sample ? `${EXPLORER}/tx/${selected.tx}` : EXPLORER} target="_blank" rel="noreferrer">Tempo Explorer ↗</a></div>
    </section></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
