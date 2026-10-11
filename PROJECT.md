# Colosseum submission draft

## Project name

MemoMatch

## Tagline

Every stablecoin invoice gets a verifiable onchain reference.

## Short description

MemoMatch helps small businesses reconcile Tempo stablecoin invoices. It attaches an opaque invoice ID to a TIP-20 payment reference and verifies the confirmed `TransferWithMemo` event against the expected token, recipient, amount, and transaction receipt.

## Project description (English)

Small businesses increasingly receive stablecoin payments, but a wallet notification is not an invoice ledger. A successful transaction can still be the wrong token, amount, recipient, or customer payment, leaving merchants to reconcile transfers by hand.

MemoMatch is an invoice desk for AlphaUSD payments on Tempo. A merchant creates an invoice and shares the receiving address, amount, and an opaque invoice reference encoded as a 32-byte TIP-20 memo. After payment, MemoMatch reads the Tempo Moderato transaction receipt and checks that a successful `TransferWithMemo` event came from the AlphaUSD contract and matches the merchant address, exact amount, and invoice memo. Only a complete match marks the invoice paid. The app keeps customer labels offchain and stores only an opaque reference in public transaction data.

The working MVP includes invoice creation, invoice-specific payment instructions, local invoice storage, and real receipt verification through Tempo's public Moderato RPC. The next step is a payer flow using Tempo Wallet/Wagmi so a customer can approve a referenced payment directly from the invoice. The prototype is for testnet evaluation and does not claim that an onchain transfer creates legal ownership or an asset-backed claim.

## 中文项目说明

小型商户开始接收稳定币，但钱包里的到账通知并不等于账单台账。即使交易成功，也可能发生币种、金额、收款地址或对应客户不匹配，商户仍要手工核对。

MemoMatch 是面向 Tempo AlphaUSD 收款的账单工具。商户创建账单后，系统生成一个不含个人信息的账单引用，并将它编码为 TIP-20 的 32-byte memo。付款完成后，MemoMatch 从 Tempo Moderato RPC 读取交易回执，核对交易成功状态、AlphaUSD 合约、收款地址、精确金额和 `TransferWithMemo` 事件中的账单引用。所有条件匹配后才会把账单标记为已支付。客户名称保存在浏览器本地，不写入公开链上 memo。

当前可运行 MVP 包含账单创建、专属付款信息、本地账单存储和基于 Tempo 测试网真实交易回执的核验。下一步可接入 Tempo Wallet/Wagmi，让付款人从账单页面直接确认带引用的转账。此原型用于测试网演示，不声称链上转账本身能创设现实资产的法律所有权或担保权益。

## Problem

Stablecoin transfers settle quickly, but invoice reconciliation is often manual. Merchants need to match a confirmed transfer to the right invoice while rejecting lookalike payments with the wrong token, destination, amount, or reference.

## Solution

Use Tempo TIP-20 `TransferWithMemo` events as a machine-checkable payment reference. A payment is credited only after the transaction receipt matches all invoice fields. Keep sensitive customer information offchain and put only a short opaque ID in the memo.

## What is built

- Create and filter invoices in a merchant dashboard.
- Generate a unique invoice ID and padded `bytes32` memo.
- Show copyable Tempo Moderato network, AlphaUSD token, amount, recipient, and memo instructions.
- Verify a transaction hash against the live Moderato RPC. Check receipt success, TIP-20 contract, `to` address, six-decimal amount, and memo before changing status.
- Keep invoices and merchant address in local browser storage; no backend or private key storage.

## Tempo usage

Tempo Moderato, AlphaUSD TIP-20, indexed `TransferWithMemo` events, 32-byte payment references, and Tempo public RPC receipt reads. Network and token values are listed in the README.

## Demo steps

1. Start the app and set a Tempo Moderato receiving address.
2. Create an invoice and open its detail view.
3. Send an AlphaUSD payment on Moderato with the displayed recipient, exact amount, and invoice memo.
4. Paste the transaction hash and verify it. Show the matching receipt and invoice status.

The included invoice rows are sample data; the sample paid transaction is not a live receipt. For judging, use a real Moderato transfer so the onchain verification path is visible.

## Tech stack

React, Vite, viem, Tempo Moderato, AlphaUSD TIP-20, browser localStorage.

## Team

Replace with the actual builder/team names and links before submitting.

## Demo URL / repository

Add the deployed demo URL and public repository URL after publishing them.

## Video pitch outline (60 seconds)

1. “A successful transfer is not enough to tell which invoice was paid.”
2. Create an invoice and show the unique payment reference.
3. Show a Moderato AlphaUSD `transferWithMemo` payment.
4. Paste the transaction hash; explain how the app matches contract, recipient, amount, memo, and receipt status.
5. Close with the value: faster reconciliation with less manual matching, while customer details remain offchain.
