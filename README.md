# MemoMatch

Stablecoin invoice reconciliation for Tempo. MemoMatch creates AlphaUSD invoices with opaque payment references and verifies a submitted transaction receipt against the expected TIP-20 token, merchant address, amount, and `TransferWithMemo` reference.

Live demo: https://1932919956.github.io/memomatch-tempo/

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal. Build a static production bundle with `npm run build`.

## Demo flow

1. Set a receiving address that you control on Tempo Moderato.
2. Create an invoice with a customer label and AlphaUSD amount.
3. Open the invoice and copy the payment details. The memo is the invoice ID padded to 32 bytes.
4. Send a TIP-20 `transferWithMemo` payment on Moderato using the displayed token address, recipient, amount, and memo.
5. Paste the transaction hash into the invoice and select **Verify on Tempo**. The app reads the public receipt from the Moderato RPC and checks the successful receipt, AlphaUSD contract, recipient, exact amount, and indexed memo before marking the invoice paid.

The included starter rows are illustrative browser data. The paid starter row is explicitly marked `SAMPLE` and is not a live chain transaction. Invoice data and the merchant address are stored in local browser storage. There is no backend, custody, or private key collection. MemoMatch does not initiate payments; it verifies a transaction after the payer has approved and sent it.

## Tempo integration

- Tempo Moderato RPC: `https://rpc.moderato.tempo.xyz`
- Chain ID: `42431`
- AlphaUSD TIP-20: `0x20c0000000000000000000000000000000000001`
- Verification event: `TransferWithMemo(address indexed from, address indexed to, uint256 amount, bytes32 indexed memo)`
- Amount conversion: AlphaUSD uses 6 decimals.

The public memo contains only an opaque invoice reference. Do not put customer names, emails, or other personal information in it.

## Current scope

This hackathon MVP demonstrates invoice creation and onchain receipt reconciliation. It does not yet send payments from an embedded wallet, issue legal claims over real-world assets, provide fiat conversion, or run a hosted multi-merchant service. Test on Moderato only.

## References

- [Tempo payment references and transfer memos](https://docs.tempo.xyz/guide/payments/transfer-memos)
- [Tempo send payments](https://docs.tempo.xyz/guide/payments/send-a-payment)
- [Tempo stablecoins and TIP-20](https://docs.tempo.xyz/get-started/stablecoins)
- [Tempo Moderato explorer](https://explore.tempo.xyz)
